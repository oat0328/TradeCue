import { apiUser, apiJson, apiFailure, ApiError } from "../../helpers/apiAccess";
import { effectiveMembership } from "../../helpers/effectiveMembership";
import { calculateCueSignal } from "../../helpers/cueSignal";
import { userKeys, webullRead, webullRows } from "../../helpers/webullClient";
import { webullBars } from "../../helpers/webullBars";
import { classifyHunterCandidate } from "../../helpers/hunterRules";
import { schema } from "./scan_GET.schema";

type MarketRow = {
  symbol:string;
  name:string;
  price:number;
  changePercent:number|null;
  relativeVolume:number|null;
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
    price:finite(row.price??row.close)??0,
    changePercent:ratioPercent(row.change_ratio),
    relativeVolume:finite(row.relative_volume_10d),
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

export async function handle(request:Request){
  try{
    const user=await apiUser(request);
    const membership=await effectiveMembership(user.id,user.role==="admin");
    if(!membership.accessActive||membership.tier==="scout"){
      throw new ApiError(403,"Cue Hunter requires an active Copilot or Autopilot membership.");
    }

    const input=schema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const keys=await userKeys(user);

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
    }else{
      groups=[marketRows(await loadPullbacks(),"PULLBACK")];
    }

    const benchmarkRaw=await webullRead(keys,"/market-data/stocks/snapshots/list",{
      symbols:"QQQ",
      category:"US_STOCK",
      extend_hour_required:"true",
    });
    const benchmark=webullRows(benchmarkRaw)[0]??{};
    const marketChangePercent=ratioPercent(benchmark.change_ratio);

    const universe=mergeRows(groups);
    const evaluationLimit=Math.min(16,Math.max(input.limit+3,12));
    const filtered=universe
      .filter((row)=>row.price>=1)
      .filter((row)=>input.maxPrice==null||row.price<=input.maxPrice)
      .filter((row)=>input.budget==null||row.price<=input.budget)
      .filter((row)=>row.marketValue==null||row.marketValue>=10_000_000)
      .sort((a,b)=>{
        const source=(b.sourceTags.length-a.sourceTags.length)*20;
        if(source!==0)return source;
        const rvol=(b.relativeVolume??0)-(a.relativeVolume??0);
        if(rvol!==0)return rvol;
        return Math.abs(b.changePercent??0)-Math.abs(a.changePercent??0);
      })
      .slice(0,evaluationLimit);

    const evaluated=await inBatches(filtered,3,async(row)=>{
      const frameSpecs=[
        {timeframe:"5m" as const,timespan:"M5",freshMinutes:20},
        {timeframe:"15m" as const,timespan:"M15",freshMinutes:45},
        {timeframe:"1H" as const,timespan:"M60",freshMinutes:180},
      ];

      const frames:FrameResult[]=await Promise.all(frameSpecs.map(async(spec)=>{
        const barsRaw=await webullRead(keys,"/market-data/stocks/bars/list",{},{
          symbols:[row.symbol],
          category:"US_STOCK",
          timespan:spec.timespan,
          count:"100",
          real_time_required:true,
          trading_sessions:"PRE,RTH,ATH",
        });
        const bars=webullBars(barsRaw).slice(-100);
        const latestBarTime=bars.at(-1)?.time??null;
        return {
          timeframe:spec.timeframe,
          fresh:frameFresh(latestBarTime,spec.freshMinutes),
          latestBarTime,
          signal:calculateCueSignal(bars),
        };
      }));

      const fast=frames[0],confirm=frames[1],context=frames[2];
      const fastSignal=fast.signal;
      const confirmSignal=confirm.signal;
      const contextSignal=context.signal;

      const fastScore=score(fastSignal);
      const confirmScore=score(confirmSignal);
      const contextScore=score(contextSignal);
      const compositeScore=fastScore!=null&&confirmScore!=null&&contextScore!=null
        ? Math.round(fastScore*.50+confirmScore*.30+contextScore*.20)
        : fastScore;

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

      const confirmBuy=confirmSignal.available&&confirmSignal.state==="BUY"&&confirm.fresh;
      const contextOk=contextSignal.available&&contextSignal.state!=="AVOID"&&context.fresh;
      const marketOk=marketChangePercent==null||marketChangePercent>-1.5;
      const entryReady=
        fastAction==="ENTRY_READY"&&
        confirmBuy&&
        contextOk&&
        marketOk&&
        (compositeScore??0)>=Math.max(78,input.minScore);

      const constructiveFrames=frames.filter(frame=>frame.signal.available&&frame.signal.state==="BUY").length;
      const avoidingFrames=frames.filter(frame=>frame.signal.available&&frame.signal.state==="AVOID").length;
      const action=entryReady
        ? "ENTRY_READY" as const
        : (compositeScore??0)>=input.minScore&&avoidingFrames<2&&fastSignal.available&&fastSignal.state!=="AVOID"
          ? "WATCH" as const
          : "WAIT" as const;

      const affordableShares=input.budget?Math.floor(input.budget/row.price):null;
      const budgetFit=input.budget?affordableShares!>=1:null;
      const whyNow:string[]=[
        constructiveFrames+"/3 timeframes bullish",
        "5m "+(fastScore??"—")+" · 15m "+(confirmScore??"—")+" · 1H "+(contextScore??"—"),
      ];
      if(row.relativeVolume!=null)whyNow.push("RVOL "+row.relativeVolume.toFixed(2)+"×");
      if(marketChangePercent!=null)whyNow.push("QQQ "+(marketChangePercent>=0?"+":"")+marketChangePercent.toFixed(2)+"%");
      if(!fast.fresh)whyNow.push("5m data stale");

      return {
        ...row,
        cueState:fastSignal.available?fastSignal.state:null,
        action,
        cueScore:compositeScore,
        fresh:fast.fresh&&confirm.fresh&&context.fresh,
        latestBarTime:fast.latestBarTime,
        affordableShares,
        budgetFit,
        plan:entryReady&&fastSignal.available?fastSignal.plan:null,
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
      };
    });

    const actionRank={ENTRY_READY:0,WATCH:1,WAIT:2} as const;
    const rows=evaluated
      .filter((row)=>row.cueScore!=null&&row.cueScore>=input.minScore)
      .sort((a,b)=>{
        const action=actionRank[a.action]-actionRank[b.action];
        if(action!==0)return action;
        const score=(b.cueScore??0)-(a.cueScore??0);
        if(score!==0)return score;
        return (b.relativeVolume??0)-(a.relativeVolume??0);
      })
      .slice(0,input.limit);

    return apiJson({
      mode:input.mode,
      source:"webull-paper",
      universeCount:universe.length,
      evaluatedCount:evaluated.length,
      generatedAt:new Date(),
      rows,
      marketContext:{symbol:"QQQ",changePercent:marketChangePercent},
      note:"Auto Hunt scans Webull every 60 seconds while the workstation is open. Entry Ready requires fresh 5m + 15m confirmation, acceptable 1H context, volume/setup quality and market context. It identifies opportunities, not guaranteed profits.",
    });
  }catch(error){
    return apiFailure(error);
  }
}

