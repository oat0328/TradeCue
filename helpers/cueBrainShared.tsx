import { sendPushNotifications } from "@floot/push";
import { db } from "./db";
import { effectiveMembership } from "./effectiveMembership";
import { calculateCueSignal } from "./cueSignal";
import { calculateMarketStructure } from "./marketStructure";
import { buildCueDailyOutlook,type CueDailyOutlook } from "./dailyOutlook";
import { stockMarketMode } from "./marketClock";
import {snapshotChangePercent} from "./marketQuote";
import { CORE_STOCKS, OMEGA_EXECUTION_STOCKS, liquidStockCandidate } from "./stockUniverse";
import { omegaBreadth,omegaConfidence,omegaGrade,omegaLongSetupScore,omegaMarketBias,omegaMarketMode,omegaPropTrainingReady,omegaShortSetupScore } from "./omegaStrategy";
import { cueTrainingGate } from "./trainingGate";
import { userKeys,webullRead,webullRows,webullSnapshot } from "./webullClient";
import { webullBarsBySymbol } from "./webullBars";
import {omegaHuntRanking} from "./omegaHuntRanking";
import {omegaDataAgreement} from "./omegaDataAgreement";
import type { HunterRow } from "../endpoints/hunter/scan_GET.schema";

export type CueBrainUser={id:number;role:string;displayName:string;email:string};

type MarketRow={
  symbol:string;
  name:string;
  price:number;
  changePercent:number|null;
  relativeVolume:number|null;
  marketValue:number|null;
  peTtm:number|null;
  sourceTags:string[];
};

function finite(value:unknown):number|null{
  const n=Number(value);
  return value!==null&&value!==""&&Number.isFinite(n)?n:null;
}
function ratioPercent(value:unknown):number|null{
  const n=finite(value);
  if(n==null)return null;
  return Math.abs(n)<=2?n*100:n;
}
function marketRows(raw:unknown,tag:string):MarketRow[]{
  return webullRows(raw).map(row=>({
    symbol:String(row.symbol??"").toUpperCase(),
    name:String(row.name??""),
    price:finite(row.price??row.close??row.latest_price??row.last_price)??0,
    changePercent:snapshotChangePercent(row),
    relativeVolume:finite(row.relative_volume_10d),
    marketValue:finite(row.market_value),
    peTtm:finite(row.pe_ttm),
    sourceTags:[tag],
  })).filter(row=>/^[A-Z0-9.-]{1,15}$/.test(row.symbol)&&row.price>0);
}
function mergeRows(groups:MarketRow[][]){
  const map=new Map<string,MarketRow>();
  for(const group of groups)for(const row of group){
    const old=map.get(row.symbol);
    if(!old){map.set(row.symbol,row);continue;}
    map.set(row.symbol,{
      symbol:row.symbol,
      name:old.name||row.name,
      price:row.price||old.price,
      changePercent:row.changePercent??old.changePercent,
      relativeVolume:row.relativeVolume??old.relativeVolume,
      marketValue:row.marketValue??old.marketValue,
      peTtm:row.peTtm??old.peTtm,
      sourceTags:[...new Set([...old.sourceTags,...row.sourceTags])],
    });
  }
  return [...map.values()];
}
function fresh(time:string|null,minutes:number){
  return Boolean(time&&Number.isFinite(Date.parse(time))&&Math.max(0,(Date.now()-Date.parse(time))/60000)<=minutes);
}
function score(signal:ReturnType<typeof calculateCueSignal>){return signal.available?signal.score:null;}
function dateKey(date=new Date()){
  const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/Los_Angeles",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);
  const get=(type:string)=>parts.find(p=>p.type===type)?.value??"";
  return get("year")+"-"+get("month")+"-"+get("day");
}

export async function activeCueUsers():Promise<CueBrainUser[]>{
  const users=await db.selectFrom("users").select(["id","role","displayName","email"]).execute();
  const output:CueBrainUser[]=[];
  for(const user of users){
    try{
      const membership=await effectiveMembership(user.id,user.role==="admin");
      if(membership.accessActive&&membership.tier!=="scout")output.push(user);
    }catch{}
  }
  return output;
}

export { serverMacroRisk } from "./macroRiskServer";

export async function scanForBrain(user:CueBrainUser,limit=12):Promise<{rows:HunterRow[];marketMode:string;openPositions:number;buyingPower:number;dayPnl:number|null}>{
  const keys=await userKeys(user);
  const [activeRaw,gainersRaw,watchRows,snapshot,learning]=await Promise.all([
    webullRead(keys,"/market-data/screeners/top-actives/list",{category:"US_STOCK",rank_type:"RELATIVE_VOLUME_10D",sort_by:"RELATIVE_VOLUME_10D",direction:"DESC"}),
    webullRead(keys,"/market-data/screeners/gainers-losers/list",{category:"US_STOCK",rank_type:"DAY_1",sort_by:"CHANGE_RATIO",direction:"DESC"}),
    db.selectFrom("watchlistItems").select(["symbol"]).where("userId","=",user.id).orderBy("sortOrder").limit(8).execute(),
    webullSnapshot(keys),
    db.selectFrom("cueLearningProfiles").select(["tradeCount","expectancy","profitFactor","maxLosingStreak"]).where("userId","=",user.id).where("setup","=","ALL").executeTakeFirst(),
  ]);
  const trainingGate=cueTrainingGate({
    tradeCount:Number(learning?.tradeCount??0),
    expectancy:learning?.expectancy==null?null:Number(learning.expectancy),
    profitFactor:learning?.profitFactor==null?null:Number(learning.profitFactor),
    maxLosingStreak:Number(learning?.maxLosingStreak??0),
  });
  const propTraining=trainingGate.phase==="CALIBRATING";

  const watchSymbols=watchRows.map(row=>row.symbol.toUpperCase()).filter(symbol=>/^[A-Z0-9.-]{1,15}$/.test(symbol));
  let watchMarket:MarketRow[]=[];
  if(watchSymbols.length){
    try{
      const raw=await webullRead(keys,"/market-data/stocks/snapshots/list",{symbols:watchSymbols.join(","),category:"US_STOCK",extend_hour_required:"true"});
      watchMarket=webullRows(raw).map(row=>({
        symbol:String(row.symbol??"").toUpperCase(),
        name:String(row.name??""),
        price:finite(row.price??row.close)??0,
        changePercent:ratioPercent(row.change_ratio),
        relativeVolume:null,marketValue:null,peTtm:null,sourceTags:["WATCHLIST"],
      })).filter(row=>row.symbol&&row.price>0);
    }catch{}
  }

  const coreRaw=await webullRead(keys,"/market-data/stocks/snapshots/list",{symbols:CORE_STOCKS.join(","),category:"US_STOCK",extend_hour_required:"true"});
  const universe=mergeRows([marketRows(coreRaw,"CORE_LIQUID"),marketRows(activeRaw,"ACTIVE"),marketRows(gainersRaw,"MOMENTUM"),watchMarket])
    .filter(liquidStockCandidate)
    .filter(row=>!/(acquisition|acqui\b|blank check|warrant|rights?\b|units?\b)/i.test(row.name))
    .sort((a,b)=>{
      const source=(b.sourceTags.length-a.sourceTags.length)*20;
      if(source!==0)return source;
      const rv=(b.relativeVolume??0)-(a.relativeVolume??0);
      if(rv!==0)return rv;
      return Math.abs(b.changePercent??0)-Math.abs(a.changePercent??0);
    })
    .slice(0,32);

  const symbols=universe.map(row=>row.symbol);
  if(!symbols.length)return {rows:[],marketMode:stockMarketMode(),openPositions:snapshot.positions.length,buyingPower:Number(snapshot.balance.buyingPower??0),dayPnl:Number(snapshot.balance.dayPnl??NaN)};
  const [barBatches,benchRaw,quoteBatches]=await Promise.all([
    Promise.all([symbols.slice(0,16),symbols.slice(16)].filter(batch=>batch.length).map(batch=>
      webullRead(keys,"/market-data/stocks/bars/list",{},{
        symbols:batch,category:"US_STOCK",timespan:"M5",count:"480",real_time_required:true,trading_sessions:"OVN,PRE,RTH,ATH",
      }))),
    webullRead(keys,"/market-data/stocks/snapshots/list",{symbols:"SPY,QQQ",category:"US_STOCK",extend_hour_required:"true"}),
    Promise.all([symbols.slice(0,16),symbols.slice(16)].filter(batch=>batch.length).map(batch=>webullRead(keys,"/market-data/stocks/snapshots/list",{symbols:batch.join(","),category:"US_STOCK",extend_hour_required:"true"}))),
  ]);
  const currentQuotes=new Map(quoteBatches.flatMap(raw=>webullRows(raw)).map(quote=>[String(quote.symbol??"").toUpperCase(),finite(quote.price??quote.close??quote.latest_price??quote.last_price)]));
  const bench=webullRows(benchRaw);
  const spyChangePercent=ratioPercent((bench.find(row=>String(row.symbol??"").toUpperCase()==="SPY")??{}).change_ratio);
  const marketChangePercent=ratioPercent((bench.find(row=>String(row.symbol??"").toUpperCase()==="QQQ")??{}).change_ratio);
  const breadth=omegaBreadth(universe.map(row=>row.changePercent));
  const marketBias=omegaMarketBias({spyChange:spyChangePercent,qqqChange:marketChangePercent,breadthScore:breadth.breadthScore});
  const omegaDayMode=omegaMarketMode({bias:marketBias,breadthScore:breadth.breadthScore,spyChange:spyChangePercent,qqqChange:marketChangePercent});
  const maps=[0,15,60].map(minutes=>Object.assign({},...barBatches.map(raw=>webullBarsBySymbol(raw,minutes))));

  const rows=universe.map((row):HunterRow=>{
    const frameDefs=[{map:maps[0],minutes:20},{map:maps[1],minutes:45},{map:maps[2],minutes:180}];
    const frames=frameDefs.map((def,index)=>{
      const bars=(def.map[row.symbol]??[]).slice(-120);
      const latestBarTime=bars.at(-1)?.time??null;
      return {bars,latestBarTime,fresh:fresh(latestBarTime,def.minutes),signal:calculateCueSignal(bars,index===0&&propTraining?{protectedTargetR:1.5}:undefined)};
    });
    const fast=frames[0],confirm=frames[1],context=frames[2];
    const currentPrice=currentQuotes.get(row.symbol)??null;
    const dataAgreement=omegaDataAgreement({quotePrice:currentPrice,barPrice:fast.bars.at(-1)?.close??null,barTimes:fast.bars.map((bar:{time:string})=>bar.time)});
    const fastStructure=calculateMarketStructure(fast.bars);
    const scores=frames.map(frame=>score(frame.signal));
    const executionScore=scores[0];
    const fastBuy=fast.signal.available&&fast.signal.state==="BUY"&&fast.fresh&&Boolean(fast.signal.plan);
    const fifteenBullish=Boolean(confirm.signal.available&&confirm.signal.metrics.priceActionTrend==="BULLISH"&&confirm.signal.metrics.aboveEma20&&confirm.signal.metrics.ema20Rising);
    const oneHourBullish=Boolean(context.signal.available&&context.signal.metrics.priceActionTrend==="BULLISH"&&context.signal.metrics.aboveEma20&&context.signal.metrics.ema20Rising);
    const fifteenBearish=Boolean(confirm.signal.available&&confirm.signal.metrics.priceActionTrend==="BEARISH"&&confirm.signal.metrics.belowEma20&&confirm.signal.metrics.ema20Falling);
    const oneHourBearish=Boolean(context.signal.available&&context.signal.metrics.priceActionTrend==="BEARISH"&&context.signal.metrics.belowEma20&&context.signal.metrics.ema20Falling);
    const marketOk=marketBias==="BULLISH";
    const setupScore12=fast.signal.available?omegaLongSetupScore({
      aboveEma20:fast.signal.metrics.aboveEma20,
      ema20Rising:fast.signal.metrics.ema20Rising,
      aboveVwap:fast.signal.metrics.aboveVwap,
      volumeConfirmed:fast.signal.metrics.volumeIncreasing,
      pullback:fast.signal.metrics.pullback,
      confirmation:fast.signal.metrics.greenConfirmation,
      marketAligned:marketOk,
    }):0;
    const setupGrade=omegaGrade(setupScore12);
    const confidence=omegaConfidence(setupScore12);
    const shadowShortScore12=fast.signal.available?omegaShortSetupScore({
      belowEma20:fast.signal.metrics.belowEma20,
      ema20Falling:fast.signal.metrics.ema20Falling,
      belowVwap:fast.signal.metrics.belowVwap,
      volumeConfirmed:fast.signal.metrics.volumeIncreasing,
      bounce:fast.signal.metrics.bounce,
      confirmation:fast.signal.metrics.redConfirmation,
      marketAligned:marketBias==="BEARISH",
    }):0;
    const shadowShortGrade=omegaGrade(shadowShortScore12);
    const shadowShortConfidence=omegaConfidence(shadowShortScore12);
    const shadowShortReady=Boolean(
      stockMarketMode()==="RTH"&&fast.fresh&&fast.signal.available&&
      fast.signal.metrics.priceActionTrend==="BEARISH"&&fifteenBearish&&oneHourBearish&&
      marketBias==="BEARISH"&&(shadowShortGrade==="A"||shadowShortGrade==="A+")&&shadowShortConfidence>=70
    );
    const allFramesFresh=frames.every(frame=>frame.fresh);
    const strictEntryReady=allFramesFresh&&fastBuy&&marketOk&&fifteenBullish&&oneHourBullish&&(setupGrade==="A"||setupGrade==="A+")&&confidence>=70;
    const trainingEntryReady=allFramesFresh&&omegaPropTrainingReady({
      fiveMinBuy:fastBuy,setupGrade,confidence,marketBias,
      fifteenBullish,fifteenBearish,oneHourBullish,oneHourBearish,
    });
    const entryReady=dataAgreement.state==="AGREED"&&(propTraining?trainingEntryReady:strictEntryReady);
    const bullishFrames=frames.filter(frame=>frame.signal.available&&frame.signal.metrics.priceActionTrend==="BULLISH"&&frame.signal.metrics.aboveEma20&&frame.signal.metrics.ema20Rising).length;
    const executionAllowed=propTraining
      ?true
      :OMEGA_EXECUTION_STOCKS.includes(row.symbol as typeof OMEGA_EXECUTION_STOCKS[number]);
    const action=entryReady&&executionAllowed?"ENTRY_READY" as const:(executionScore??0)>=70?"WATCH" as const:"WAIT" as const;
    const strictRejectedReasons=[
      ...(!oneHourBullish?["1H_NOT_BULLISH"]:[]),...(!fifteenBullish?["15M_NOT_BULLISH"]:[]),...(!fastBuy?["5M_NOT_QUALIFIED"]:[]),
      ...(!marketOk?["MARKET_NOT_BULLISH"]:[]),...(!(setupGrade==="A"||setupGrade==="A+")?["GRADE_BELOW_A"]:[]),
      ...(!allFramesFresh?["STALE_TIMEFRAME"]:[]),...(!executionAllowed?["OUTSIDE_EXECUTION_UNIVERSE"]:[])
    ];
    const trainingRejectedReasons=[
      ...(!fastBuy?["5M_NOT_QUALIFIED"]:[]),
      ...(marketBias==="BEARISH"?["MARKET_BEARISH"]:[]),
      ...((fifteenBearish||oneHourBearish)?["HIGHER_TIMEFRAME_BEARISH"]:[]),
      ...((setupGrade==="A"&&!fifteenBullish&&!oneHourBullish)?["A_GRADE_NEEDS_HIGHER_TIMEFRAME_SUPPORT"]:[]),
      ...(!(setupGrade==="A"||setupGrade==="A+")?["GRADE_BELOW_A"]:[]),
      ...(!allFramesFresh?["STALE_TIMEFRAME"]:[]),...(!executionAllowed?["OUTSIDE_PROP_TRAINING_UNIVERSE"]:[])
    ];
    return {
      ...row,
      price:currentPrice??row.price,
      dataAgreement,
      cueState:fast.signal.available?fast.signal.state:null,
      action,
      cueScore:executionScore,
      omegaEvidence:{
        oneHourBullish,fifteenBullish,fiveMinQualified:fastBuy,executionAllowed,
        gateMode:propTraining?"PROP_TRAINING":"STRICT_GREEN",
        strictEntryReady,trainingEntryReady,
        rejectedReasons:[...(propTraining?trainingRejectedReasons:strictRejectedReasons),...dataAgreement.blockers],
      },
      setupScore12,
      setupGrade,
      confidence,
      shadowShortScore12,
      shadowShortGrade,
      shadowShortConfidence,
      shadowShortReady,
      marketAlignment:marketBias,
      omegaMarketMode:omegaDayMode,
      latestStructureEvent:fastStructure.latestEvent?.kind??null,
      fresh:allFramesFresh,
      latestBarTime:fast.latestBarTime,
      affordableShares:null,
      budgetFit:null,
      plan:entryReady&&fast.signal.available?fast.signal.plan:null,
      flags:[...(fast.signal.available?fast.signal.flags:[]),...dataAgreement.blockers],
      whyNow:[
        fast.signal.available?"5m "+fast.signal.setupStage.replaceAll("_"," "):"5m data unavailable",
        "Omega "+setupGrade+" · "+setupScore12+"/12 · "+confidence+"% confidence",
        propTraining?"Gate PROP TRAINING · first 30 resolved trades":"Gate STRICT GREEN",
        "MTF context · "+bullishFrames+"/3 frames bullish",
        "Market "+marketBias+" · "+omegaDayMode.replaceAll("_"," "),
        executionAllowed?(propTraining?"Prop training universe · eligible":"Execution whitelist · eligible"):"Discovery only · outside active execution universe",
      ],
      timeframeScores:{fiveMin:scores[0],fifteenMin:scores[1],oneHour:scores[2],bullishFrames},
      marketChangePercent,
      opportunityType:row.sourceTags.includes("MOMENTUM")?"MOMENTUM":"SETUP_WATCH",
    };
  }).sort(omegaHuntRanking).slice(0,limit);

  const dayPnlNumber=Number(snapshot.balance.dayPnl??NaN);
  return {
    rows,
    marketMode:stockMarketMode(),
    openPositions:snapshot.positions.filter(position=>Number(position.quantity??0)>0).length,
    buyingPower:Number(snapshot.balance.buyingPower??0),
    dayPnl:Number.isFinite(dayPnlNumber)?dayPnlNumber:null,
  };
}

export async function saveDailyOutlook(user:CueBrainUser,type:"premarket"|"postmarket"|"weekend",scan:Awaited<ReturnType<typeof scanForBrain>>,macroState:string){
  const controls=await db.selectFrom("cueAutomationControls").selectAll().where("userId","=",user.id).executeTakeFirst();
  const outlook=buildCueDailyOutlook({
    marketMode:scan.marketMode,
    rows:scan.rows,
    macroState,
    maxPositions:controls?.maxAutoPositions??3,
    openPositions:scan.openPositions,
  });
  const sessionDate=dateKey();
  await db.insertInto("cueDailyOutlooks").values({
    userId:user.id,
    sessionDate,
    outlookType:type,
    marketMode:scan.marketMode,
    bias:outlook.bias,
    headline:outlook.headline,
    summary:outlook.summary,
    watchSymbols:outlook.watch,
    plan:{buyTrigger:outlook.buyTrigger,stayOut:outlook.stayOut,openPlan:outlook.openPlan,buyingPower:scan.buyingPower,dayPnl:scan.dayPnl},
    updatedAt:new Date(),
  }).onConflict(oc=>oc.columns(["userId","sessionDate","outlookType"]).doUpdateSet({
    marketMode:scan.marketMode,
    bias:outlook.bias,
    headline:outlook.headline,
    summary:outlook.summary,
    watchSymbols:outlook.watch,
    plan:{buyTrigger:outlook.buyTrigger,stayOut:outlook.stayOut,openPlan:outlook.openPlan,buyingPower:scan.buyingPower,dayPnl:scan.dayPnl},
    updatedAt:new Date(),
  })).execute();
  return outlook;
}

export async function pushUser(userId:number,title:string,body:string,tag:string){
  const rows=await db.selectFrom("pushSubscriptions").select(["id","subscription"]).where("userId","=",userId).execute();
  if(!rows.length)return {sent:0,failed:0};
  const results=await sendPushNotifications(rows.map(row=>row.subscription as any),{
    title,body,url:"/workstation",tag,data:{type:"cue-brain"},
  });
  const gone=rows.filter((_,index)=>results[index]?.gone);
  if(gone.length)await db.deleteFrom("pushSubscriptions").where("id","in",gone.map(row=>row.id)).execute();
  return {sent:results.filter(result=>result.success).length,failed:results.filter(result=>!result.success).length};
}

export function shortOutlookBody(outlook:CueDailyOutlook){
  const watch=outlook.watch.length?" Watch: "+outlook.watch.join(", ")+".":"";
  return outlook.headline+watch+" "+outlook.openPlan;
}
