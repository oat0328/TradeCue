import { apiUser, apiJson, apiFailure, ApiError } from "../../helpers/apiAccess";
import { db } from "../../helpers/db";
import { effectiveMembership } from "../../helpers/effectiveMembership";
import { calculateCueSignal } from "../../helpers/cueSignal";
import { calculateMarketStructure } from "../../helpers/marketStructure";
import { userKeys, webullRead, webullRows } from "../../helpers/webullClient";
import { webullBarsBySymbol } from "../../helpers/webullBars";
import { classifyHunterCandidate } from "../../helpers/hunterRules";
import {snapshotChangePercent} from "../../helpers/marketQuote";
import { discoveryPriority,axiomReadiness } from "../../helpers/axiomSelection";
import { OMEGA_EXECUTION_STOCKS,CORE_STOCKS, liquidStockCandidate } from "../../helpers/stockUniverse";
import { omegaBreadth,omegaConfidence,omegaGrade,omegaLongSetupScore,omegaMarketBias,omegaMarketMode,omegaShortSetupScore } from "../../helpers/omegaStrategy";
import { schema } from "./scan_GET.schema";

type MarketRow = {
  symbol:string;
  name:string;
  price:number;
  changePercent:number|null;
  relativeVolume:number|null;
  volume:number|null;
  marketValue:number|null;
  peTtm:number|null;
  sourceTags:string[];
};

type FrameResult={
  timeframe:"5m"|"15m"|"1H";
  fresh:boolean;
  latestBarTime:string|null;
  signal:ReturnType<typeof calculateCueSignal>;
};

function finite(value:unknown):number|null{
  const number=Number(value);
  return value!==null&&value!==""&&Number.isFinite(number)?number:null;
}

function ratioPercent(value:unknown):number|null{
  const number=finite(value);
  if(number==null)return null;
  return Math.abs(number)<=2?number*100:number;
}

function marketRows(raw:unknown,tag:string):MarketRow[]{
  return webullRows(raw).map((row)=>({
    symbol:String(row.symbol??"").toUpperCase(),
    name:String(row.name??""),
    price:finite(row.price??row.close??row.latest_price??row.last_price)??0,
    changePercent:snapshotChangePercent(row),
    relativeVolume:finite(row.relative_volume_10d),
    volume:finite(row.volume??row.trade_volume??row.total_volume),
    marketValue:finite(row.market_value),
    peTtm:finite(row.pe_ttm),
    sourceTags:[tag],
  })).filter((row)=>/^[A-Z0-9.-]{1,15}$/.test(row.symbol)&&row.price>0);
}

function mergeRows(groups:MarketRow[][]){
  const map=new Map<string,MarketRow>();
  for(const group of groups){
    for(const row of group){
      const old=map.get(row.symbol);
      if(!old){
        map.set(row.symbol,row);
        continue;
      }
      map.set(row.symbol,{
        symbol:row.symbol,
        name:old.name||row.name,
        price:row.price||old.price,
        changePercent:row.changePercent??old.changePercent,
        relativeVolume:row.relativeVolume??old.relativeVolume,
        volume:row.volume??old.volume,
        marketValue:row.marketValue??old.marketValue,
        peTtm:row.peTtm??old.peTtm,
        sourceTags:[...new Set([...old.sourceTags,...row.sourceTags])],
      });
    }
  }
  return [...map.values()];
}

async function inBatches<T,R>(items:T[],size:number,worker:(item:T)=>Promise<R>):Promise<R[]>{
  const output:R[]=[];
  for(let index=0;index<items.length;index+=size){
    const batch=await Promise.allSettled(items.slice(index,index+size).map(worker));
    for(const result of batch)if(result.status==="fulfilled")output.push(result.value);
  }
  return output;
}

function frameFresh(latestTime:string|null,thresholdMinutes:number){
  if(!latestTime||!Number.isFinite(Date.parse(latestTime)))return false;
  return Math.max(0,(Date.now()-Date.parse(latestTime))/60000)<=thresholdMinutes;
}

function score(signal:ReturnType<typeof calculateCueSignal>){
  return signal.available?signal.score:null;
}

function currentMarketMode(){
  const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",weekday:"short",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(new Date());
  const get=(type:string)=>parts.find(part=>part.type===type)?.value??"";
  const weekday=get("weekday");
  const total=Number(get("hour"))*60+Number(get("minute"));
  if(weekday==="Sun"&&total>=20*60)return "OVERNIGHT";
  if(weekday==="Sat"||weekday==="Sun"||(weekday==="Fri"&&total>=20*60))return "WEEKEND_PREP";
  if(total<4*60)return "OVERNIGHT";
  if(total<9*60+30)return "PREMARKET";
  if(total<16*60)return "RTH";
  if(total<20*60)return "AFTER_HOURS";
  return "OVERNIGHT";
}

export async function handle(request:Request){
  try{
    const user=await apiUser(request);
    const membership=await effectiveMembership(user.id,user.role==="admin");
    if(!membership.accessActive||membership.tier==="scout"){
      throw new ApiError(403,"Cue Hunter requires an active Copilot or Autopilot membership.");
    }

    const input=schema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const keys=await userKeys(user);
    const marketMode=currentMarketMode();

    const loadActive=()=>webullRead(keys,"/market-data/screeners/top-actives/list",{
      category:"US_STOCK",
      rank_type:"RELATIVE_VOLUME_10D",
      sort_by:"RELATIVE_VOLUME_10D",
      direction:"DESC",
    });
    const loadGainers=()=>webullRead(keys,"/market-data/screeners/gainers-losers/list",{
      category:"US_STOCK",
      rank_type:"DAY_1",
      sort_by:"CHANGE_RATIO",
      direction:"DESC",
    });
    const loadPullbacks=()=>webullRead(keys,"/market-data/screeners/gainers-losers/list",{
      category:"US_STOCK",
      rank_type:"DAY_1",
      sort_by:"CHANGE_RATIO",
      direction:"ASC",
    });

    let groups:MarketRow[][]=[];
    if(input.mode==="auto"){
      const [active,gainers,pullbacks]=await Promise.all([loadActive(),loadGainers(),loadPullbacks()]);
      groups=[
        marketRows(active,"ACTIVE"),
        marketRows(gainers,"MOMENTUM"),
        marketRows(pullbacks,"PULLBACK"),
      ];
    }else if(input.mode==="active"){
      groups=[marketRows(await loadActive(),"ACTIVE")];
    }else if(input.mode==="momentum"){
      groups=[marketRows(await loadGainers(),"MOMENTUM")];
    }else if(input.mode==="portfolio"||input.mode==="bearish"){
      groups=[marketRows(await loadPullbacks(),input.mode==="portfolio"?"PORTFOLIO_PULLBACK":"BEARISH")];
    }else{
      groups=[marketRows(await loadPullbacks(),"PULLBACK")];
    }

    const benchmarkRaw=await webullRead(keys,"/market-data/stocks/snapshots/list",{
      symbols:"SPY,QQQ",
      category:"US_STOCK",
      extend_hour_required:"true",
    });
    const benchmarkRows=webullRows(benchmarkRaw);
    const spyChangePercent=snapshotChangePercent(benchmarkRows.find(row=>String(row.symbol??"").toUpperCase()==="SPY")??{});
    const marketChangePercent=snapshotChangePercent(benchmarkRows.find(row=>String(row.symbol??"").toUpperCase()==="QQQ")??{});

    const coreRaw=await webullRead(keys,"/market-data/stocks/snapshots/list",{symbols:CORE_STOCKS.join(","),category:"US_STOCK",extend_hour_required:"true"});
    groups.push(marketRows(coreRaw,"CORE_LIQUID"));
    const universe=mergeRows(groups);
    const breadth=omegaBreadth(universe.map(row=>row.changePercent));
    const marketBias=omegaMarketBias({spyChange:spyChangePercent,qqqChange:marketChangePercent,breadthScore:breadth.breadthScore});
    const omegaDayMode=omegaMarketMode({bias:marketBias,breadthScore:breadth.breadthScore,spyChange:spyChangePercent,qqqChange:marketChangePercent});
    const evaluationLimit=Math.min(16,Math.max(input.limit+3,12));
    const lowQualityName=/(acquisition|acqui\b|blank check|warrant|rights?\b|units?\b)/i;
    const filtered=universe
      .filter(liquidStockCandidate)
      .filter((row)=>input.maxPrice==null||row.price<=input.maxPrice)
      // Budget affects order sizing, not which major stocks are researched.
      .filter((row)=>row.marketValue==null||row.marketValue>=(input.mode==="portfolio"?1_000_000_000:50_000_000))
      .filter((row)=>input.mode!=="portfolio"||row.peTtm==null||row.peTtm>0)
      .filter((row)=>input.mode!=="bearish"||row.changePercent==null||row.changePercent<0)
      .filter((row)=>input.mode!=="auto"||!lowQualityName.test(row.name))
      .filter((row)=>input.mode!=="auto"||row.changePercent==null||(row.changePercent>=-6&&row.changePercent<=15))
      .filter((row)=>input.mode!=="auto"||row.relativeVolume==null||row.relativeVolume>=1)
      .sort((a,b)=>discoveryPriority(b)-discoveryPriority(a))
      .slice(0,evaluationLimit);

    const frameSpecs=[
      {timeframe:"5m" as const,aggregateMinutes:0,freshMinutes:20},
      {timeframe:"15m" as const,aggregateMinutes:15,freshMinutes:45},
      {timeframe:"1H" as const,aggregateMinutes:60,freshMinutes:180},
    ];
    const symbols=filtered.map(row=>row.symbol);
    const baseBarsRaw=symbols.length?await webullRead(keys,"/market-data/stocks/bars/list",{},{
        symbols,
        category:"US_STOCK",
        timespan:"M5",
        count:"480",
        real_time_required:true,
        trading_sessions:"OVN,PRE,RTH,ATH",
      }):null;
    const frameMaps=frameSpecs.map(spec=>baseBarsRaw?webullBarsBySymbol(baseBarsRaw,spec.aggregateMinutes):{});
    let newHighs=0,newLows=0;
    for(const symbol of symbols){
      const bars=(frameMaps[0]?.[symbol]??[]).slice(-21);
      if(bars.length<21)continue;
      const latest=bars.at(-1)!;
      const prior=bars.slice(0,-1);
      if(latest.high>Math.max(...prior.map(bar=>bar.high)))newHighs++;
      if(latest.low<Math.min(...prior.map(bar=>bar.low)))newLows++;
    }

    const evaluated=filtered.map(row=>{
      const frames:FrameResult[]=frameSpecs.map((spec,index)=>{
        const bars=(frameMaps[index]?.[row.symbol]??[]).slice(-100);
        const latestBarTime=bars.at(-1)?.time??null;
        return {
          timeframe:spec.timeframe,
          fresh:frameFresh(latestBarTime,spec.freshMinutes),
          latestBarTime,
          signal:calculateCueSignal(bars),
        };
      });

      const fast=frames[0],confirm=frames[1],context=frames[2];
      const fastSignal=fast.signal;
      const confirmSignal=confirm.signal;
      const contextSignal=context.signal;
      const fastStructure=calculateMarketStructure((frameMaps[0]?.[row.symbol]??[]).slice(-120));

      const fastScore=score(fastSignal);
      const confirmScore=score(confirmSignal);
      const contextScore=score(contextSignal);
      const compositeScore=fastScore!=null&&confirmScore!=null&&contextScore!=null
        ? Math.round(fastScore*.50+confirmScore*.30+contextScore*.20)
        : fastScore;
      const executionScore=fastScore;
      const fifteenBullish=Boolean(confirmSignal.available&&confirmSignal.metrics.priceActionTrend==="BULLISH"&&confirmSignal.metrics.aboveEma20&&confirmSignal.metrics.ema20Rising);
      const oneHourBullish=Boolean(contextSignal.available&&contextSignal.metrics.priceActionTrend==="BULLISH"&&contextSignal.metrics.aboveEma20&&contextSignal.metrics.ema20Rising);
      const fifteenBearish=Boolean(confirmSignal.available&&confirmSignal.metrics.priceActionTrend==="BEARISH"&&confirmSignal.metrics.belowEma20&&confirmSignal.metrics.ema20Falling);
      const oneHourBearish=Boolean(contextSignal.available&&contextSignal.metrics.priceActionTrend==="BEARISH"&&contextSignal.metrics.belowEma20&&contextSignal.metrics.ema20Falling);
      const marketAligned=marketBias==="BULLISH";
      const setupScore12=fastSignal.available?omegaLongSetupScore({
        aboveEma20:fastSignal.metrics.aboveEma20,
        ema20Rising:fastSignal.metrics.ema20Rising,
        aboveVwap:fastSignal.metrics.aboveVwap,
        volumeConfirmed:fastSignal.metrics.volumeIncreasing,
        pullback:fastSignal.metrics.pullback,
        confirmation:fastSignal.metrics.greenConfirmation,
        marketAligned,
      }):0;
      const setupGrade=omegaGrade(setupScore12);
      const confidence=omegaConfidence(setupScore12);
      const shadowShortScore12=fastSignal.available?omegaShortSetupScore({
        belowEma20:fastSignal.metrics.belowEma20,
        ema20Falling:fastSignal.metrics.ema20Falling,
        belowVwap:fastSignal.metrics.belowVwap,
        volumeConfirmed:fastSignal.metrics.volumeIncreasing,
        bounce:fastSignal.metrics.bounce,
        confirmation:fastSignal.metrics.redConfirmation,
        marketAligned:marketBias==="BEARISH",
      }):0;
      const shadowShortGrade=omegaGrade(shadowShortScore12);
      const shadowShortConfidence=omegaConfidence(shadowShortScore12);
      const shadowShortReady=Boolean(
        marketMode==="RTH"&&fast.fresh&&
        fastSignal.available&&fastSignal.metrics.priceActionTrend==="BEARISH"&&
        fifteenBearish&&oneHourBearish&&marketBias==="BEARISH"&&
        (shadowShortGrade==="A"||shadowShortGrade==="A+")&&shadowShortConfidence>=70
      );

      const fastAction=classifyHunterCandidate({
        signalAvailable:fastSignal.available,
        fresh:fast.fresh,
        state:fastSignal.available?fastSignal.state:null,
        score:fastScore,
        trend:fastSignal.available?fastSignal.componentScores.trend:null,
        setup:fastSignal.available?fastSignal.componentScores.setup:null,
        volume:fastSignal.available?fastSignal.componentScores.volume:null,
        hasPlan:fastSignal.available&&Boolean(fastSignal.plan),
        minScore:input.minScore,
      });

      const marketOk=marketAligned;
      const entryReady=
        fastAction==="ENTRY_READY"&&
        marketOk&&
        fifteenBullish&&
        oneHourBullish&&
        (setupGrade==="A"||setupGrade==="A+")&&
        confidence>=70;

      const constructiveFrames=frames.filter(frame=>frame.signal.available&&frame.signal.metrics.priceActionTrend==="BULLISH"&&frame.signal.metrics.aboveEma20&&frame.signal.metrics.ema20Rising).length;
      const avoidingFrames=frames.filter(frame=>frame.signal.available&&frame.signal.state==="AVOID").length;
      const recentBars=(frameMaps[0]?.[row.symbol]??[]).slice(-6);
      const dollarVolume=recentBars.length===6&&recentBars.every(bar=>Number.isFinite(bar.volume)&&bar.volume>=0)?recentBars.reduce((sum,bar)=>sum+bar.close*bar.volume,0):null;
      const baseAction=axiomReadiness({
        regularSession:marketMode==="RTH",
        fresh:fast.fresh,
        dollarVolume,
        technicalReady:entryReady,
        watchable:(executionScore??0)>=input.minScore&&fastSignal.available&&fastSignal.state!=="AVOID",
      });
      const action=input.mode==="auto"&&!OMEGA_EXECUTION_STOCKS.includes(row.symbol as typeof OMEGA_EXECUTION_STOCKS[number])&&baseAction==="ENTRY_READY"
        ?"WATCH" as const
        :baseAction;

      const affordableShares=input.budget?Math.floor(input.budget/row.price):null;
      const budgetFit=input.budget?affordableShares!>=1:null;
      const whyNow:string[]=[
        fastSignal.available?"5m "+fastSignal.setupStage.replaceAll("_"," "):"5m data unavailable",
        "Discovery: "+row.sourceTags.join(" + "),
      ];
      whyNow.unshift("Omega "+setupGrade+" · "+setupScore12+"/12 · "+confidence+"% confidence");
      whyNow.unshift("Market "+marketBias+" · "+omegaDayMode.replaceAll("_"," "));
      whyNow.push("MTF: 1H "+(oneHourBullish?"bullish":"not bullish")+" · 15m "+(fifteenBullish?"bullish":"not bullish"));
      whyNow.unshift(dollarVolume==null?"Volume evidence unavailable":dollarVolume<1_000_000?"Thin recent activity · wait":"Recent 30m traded value $"+(dollarVolume/1_000_000).toFixed(1)+"M");
      if(input.mode==="auto"&&!OMEGA_EXECUTION_STOCKS.includes(row.symbol as typeof OMEGA_EXECUTION_STOCKS[number]))whyNow.unshift("Discovery only · outside Omega training execution list");
      if(row.relativeVolume!=null)whyNow.push("RVOL "+row.relativeVolume.toFixed(2)+"×");
      if(marketChangePercent!=null)whyNow.push("QQQ "+(marketChangePercent>=0?"+":"")+marketChangePercent.toFixed(2)+"%");
      else whyNow.unshift("Market confirmation unavailable · no entry");
      if(marketMode==="WEEKEND_PREP")whyNow.push("Weekend prep · rank only, no entry signal");
      else if(!fast.fresh)whyNow.push("5m data stale");

      const opportunityType=
        input.mode==="portfolio"?"PORTFOLIO_WATCH" as const:
        input.mode==="bearish"?"BEARISH_WATCH" as const:
        row.sourceTags.includes("MOMENTUM")?"MOMENTUM" as const:
        "SETUP_WATCH" as const;

      return {
        ...row,
        cueState:fastSignal.available?fastSignal.state:null,
        action,
        cueScore:executionScore,
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
        fresh:fast.fresh,
        latestBarTime:fast.latestBarTime,
        affordableShares,
        budgetFit,
        plan:action==="ENTRY_READY"&&fastSignal.available?fastSignal.plan:null,
        flags:fastSignal.available?fastSignal.flags:[],
        sourceTags:row.sourceTags,
        whyNow:whyNow.slice(0,4),
        timeframeScores:{
          fiveMin:fastScore,
          fifteenMin:confirmScore,
          oneHour:contextScore,
          bullishFrames:constructiveFrames,
        },
        marketChangePercent,
        opportunityType,
      };
    });

    const actionRank={ENTRY_READY:0,WATCH:1,WAIT:2} as const;
    const rows=evaluated
      .filter((row)=>{
        if(input.mode==="bearish")return row.changePercent!=null&&row.changePercent<0;
        if(input.mode==="portfolio")return row.changePercent==null||row.changePercent<=0;
        return (row.cueScore!=null&&row.cueScore>=input.minScore)||row.shadowShortGrade==="A"||row.shadowShortGrade==="A+";
      })
      .sort((a,b)=>{
        if(input.mode==="bearish")return (a.changePercent??0)-(b.changePercent??0);
        if(input.mode==="portfolio"){
          const cap=(b.marketValue??0)-(a.marketValue??0);
          if(cap!==0)return cap;
        }
        const action=actionRank[a.action]-actionRank[b.action];
        if(action!==0)return action;
        const score=(b.cueScore??0)-(a.cueScore??0);
        if(score!==0)return score;
        return (b.relativeVolume??0)-(a.relativeVolume??0);
      })
      .slice(0,input.limit);

    const leaderRows=universe.filter(row=>
      row.price>20&&
      (row.volume??0)>=1_000_000&&
      (row.relativeVolume??0)>=1.5&&
      row.changePercent!=null&&
      Math.abs(row.changePercent)>=2
    );
    const compactLeader=(row:MarketRow)=>({
      symbol:row.symbol,name:row.name,price:row.price,changePercent:row.changePercent,
      relativeVolume:row.relativeVolume,volume:row.volume,
    });
    const leaders={
      topGainers:leaderRows.filter(row=>(row.changePercent??0)>0).sort((a,b)=>(b.changePercent??0)-(a.changePercent??0)).slice(0,5).map(compactLeader),
      topLosers:leaderRows.filter(row=>(row.changePercent??0)<0).sort((a,b)=>(a.changePercent??0)-(b.changePercent??0)).slice(0,5).map(compactLeader),
      topBuyTeam:rows.filter(row=>row.setupGrade==="A+"||row.setupGrade==="A").sort((a,b)=>b.setupScore12-a.setupScore12).slice(0,5).map(row=>row.symbol),
      topSellTeam:rows.filter(row=>row.shadowShortGrade==="A+"||row.shadowShortGrade==="A").sort((a,b)=>b.shadowShortScore12-a.shadowShortScore12).slice(0,5).map(row=>row.symbol),
      breakoutCandidates:rows.filter(row=>row.latestStructureEvent==="BOS_UP").slice(0,5).map(row=>row.symbol),
      retestCandidates:rows.filter(row=>row.latestStructureEvent==="BOS_UP"&&row.setupScore12>=8).slice(0,5).map(row=>row.symbol),
      reversalCandidates:rows.filter(row=>row.latestStructureEvent==="SWEEP_LOW"||row.latestStructureEvent==="SWEEP_HIGH").slice(0,5).map(row=>row.symbol),
    };

    if(input.mode==="auto"){
      for(const row of rows.slice(0,5)){
        if(!row.latestBarTime)continue;
        const observationId=row.symbol+":"+row.latestBarTime;
        const exists=await db.selectFrom("cueAuditLog").select(["id"])
          .where("userId","=",user.id)
          .where("action","=","axiom_strategy_observation")
          .where("entityType","=","strategy_observation")
          .where("entityId","=",observationId)
          .executeTakeFirst();
        if(exists)continue;
        await db.insertInto("cueAuditLog").values({
          userId:user.id,
          action:"axiom_strategy_observation",
          entityType:"strategy_observation",
          entityId:observationId,
          details:{
            symbol:row.symbol,
            marketMode,
            action:row.action,
            cueScore:row.cueScore,
            setupScore12:row.setupScore12,
            setupGrade:row.setupGrade,
            confidence:row.confidence,
            shadowShortScore12:row.shadowShortScore12,
            shadowShortGrade:row.shadowShortGrade,
            shadowShortConfidence:row.shadowShortConfidence,
            shadowShortReady:row.shadowShortReady,
            marketAlignment:row.marketAlignment,
            omegaMarketMode:row.omegaMarketMode,
            sourceTags:row.sourceTags,
            whyNow:row.whyNow,
            timeframeScores:row.timeframeScores,
            plan:row.plan,
            latestBarTime:row.latestBarTime,
          },
        }).execute();
      }
    }

    return apiJson({
      mode:input.mode,
      source:"webull-paper",
      universeCount:universe.length,
      evaluatedCount:evaluated.length,
      generatedAt:new Date(),
      rows,
      marketMode,
      marketContext:{
        symbol:"QQQ",
        changePercent:marketChangePercent,
        spyChangePercent,
        bias:marketBias,
        omegaMarketMode:omegaDayMode,
        breadthScore:breadth.breadthScore,
        advancing:breadth.advancing,
        declining:breadth.declining,
        newHighs,
        newLows,
        advanceDeclineRatio:breadth.advanceDeclineRatio,
      },
      leaders,
      note:"Omega scans Webull Top Gainers, Most Active names, the core liquid universe and watchlist candidates. Automatic PaperTrade entries require 1H bullish + 15m bullish + a qualified 5m A/A+ setup with market alignment.",
    });
  }catch(error){
    return apiFailure(error);
  }
}
