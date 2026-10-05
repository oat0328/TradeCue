import { sendPushNotifications } from "@floot/push";
import { db } from "./db";
import { effectiveMembership } from "./effectiveMembership";
import { calculateCueSignal } from "./cueSignal";
import { buildCueDailyOutlook,type CueDailyOutlook } from "./dailyOutlook";
import { stockMarketMode } from "./marketClock";
import { userKeys,webullRead,webullRows,webullSnapshot } from "./webullClient";
import { webullBarsBySymbol } from "./webullBars";
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
    price:finite(row.price??row.close)??0,
    changePercent:ratioPercent(row.change_ratio),
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
  const [activeRaw,gainersRaw,watchRows,snapshot]=await Promise.all([
    webullRead(keys,"/market-data/screeners/top-actives/list",{category:"US_STOCK",rank_type:"RELATIVE_VOLUME_10D",sort_by:"RELATIVE_VOLUME_10D",direction:"DESC"}),
    webullRead(keys,"/market-data/screeners/gainers-losers/list",{category:"US_STOCK",rank_type:"DAY_1",sort_by:"CHANGE_RATIO",direction:"DESC"}),
    db.selectFrom("watchlistItems").select(["symbol"]).where("userId","=",user.id).orderBy("sortOrder").limit(8).execute(),
    webullSnapshot(keys),
  ]);

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

  const universe=mergeRows([marketRows(activeRaw,"ACTIVE"),marketRows(gainersRaw,"MOMENTUM"),watchMarket])
    .filter(row=>row.price>=3)
    .filter(row=>!/(acquisition|acqui\b|blank check|warrant|rights?\b|units?\b)/i.test(row.name))
    .sort((a,b)=>{
      const source=(b.sourceTags.length-a.sourceTags.length)*20;
      if(source!==0)return source;
      const rv=(b.relativeVolume??0)-(a.relativeVolume??0);
      if(rv!==0)return rv;
      return Math.abs(b.changePercent??0)-Math.abs(a.changePercent??0);
    })
    .slice(0,16);

  const symbols=universe.map(row=>row.symbol);
  if(!symbols.length)return {rows:[],marketMode:stockMarketMode(),openPositions:snapshot.positions.length,buyingPower:Number(snapshot.balance.buyingPower??0),dayPnl:Number(snapshot.balance.dayPnl??NaN)};
  const [barsRaw,qqqRaw]=await Promise.all([
    webullRead(keys,"/market-data/stocks/bars/list",{},{
      symbols,category:"US_STOCK",timespan:"M5",count:"480",real_time_required:true,trading_sessions:"OVN,PRE,RTH,ATH",
    }),
    webullRead(keys,"/market-data/stocks/snapshots/list",{symbols:"QQQ",category:"US_STOCK",extend_hour_required:"true"}),
  ]);
  const qqq=webullRows(qqqRaw)[0]??{};
  const marketChangePercent=ratioPercent(qqq.change_ratio);
  const maps=[webullBarsBySymbol(barsRaw,0),webullBarsBySymbol(barsRaw,15),webullBarsBySymbol(barsRaw,60)];

  const rows=universe.map((row):HunterRow=>{
    const frameDefs=[{map:maps[0],minutes:20},{map:maps[1],minutes:45},{map:maps[2],minutes:180}];
    const frames=frameDefs.map(def=>{
      const bars=(def.map[row.symbol]??[]).slice(-120);
      const latestBarTime=bars.at(-1)?.time??null;
      return {bars,latestBarTime,fresh:fresh(latestBarTime,def.minutes),signal:calculateCueSignal(bars)};
    });
    const fast=frames[0],confirm=frames[1],context=frames[2];
    const scores=frames.map(frame=>score(frame.signal));
    const composite=scores.every(value=>value!=null)?Math.round((scores[0] as number)*.5+(scores[1] as number)*.3+(scores[2] as number)*.2):scores[0];
    const fastBuy=fast.signal.available&&fast.signal.state==="BUY"&&fast.fresh&&Boolean(fast.signal.plan);
    const confirmBuy=confirm.signal.available&&confirm.signal.state==="BUY"&&confirm.fresh;
    const contextOk=context.signal.available&&context.signal.state!=="AVOID"&&context.fresh;
    const marketOk=marketChangePercent==null||marketChangePercent>-1.5;
    const entryReady=fastBuy&&confirmBuy&&contextOk&&marketOk&&(composite??0)>=78;
    const bullishFrames=frames.filter(frame=>frame.signal.available&&frame.signal.state==="BUY").length;
    const action=entryReady?"ENTRY_READY" as const:(composite??0)>=70?"WATCH" as const:"WAIT" as const;
    return {
      ...row,
      cueState:fast.signal.available?fast.signal.state:null,
      action,
      cueScore:composite,
      fresh:frames.every(frame=>frame.fresh),
      latestBarTime:fast.latestBarTime,
      affordableShares:null,
      budgetFit:null,
      plan:entryReady&&fast.signal.available?fast.signal.plan:null,
      flags:fast.signal.available?fast.signal.flags:[],
      whyNow:[bullishFrames+"/3 timeframes bullish","5m "+(scores[0]??"—")+" · 15m "+(scores[1]??"—")+" · 1H "+(scores[2]??"—")],
      timeframeScores:{fiveMin:scores[0],fifteenMin:scores[1],oneHour:scores[2],bullishFrames},
      marketChangePercent,
      opportunityType:row.sourceTags.includes("MOMENTUM")?"MOMENTUM":"SETUP_WATCH",
    };
  }).sort((a,b)=>(b.cueScore??0)-(a.cueScore??0)).slice(0,limit);

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

