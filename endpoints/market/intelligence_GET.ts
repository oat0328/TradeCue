import { apiUser,apiJson,apiFailure } from "../../helpers/apiAccess";
import { calculateCueSignal } from "../../helpers/cueSignal";
import { userKeys,webullRead,webullRows } from "../../helpers/webullClient";
import { webullBars } from "../../helpers/webullBars";
import { classifyIntelligence } from "../../helpers/hunterRules";
import { schema } from "./intelligence_GET.schema";

const frames=[
  {label:"5m",timespan:"M5",freshMinutes:20,weight:.40},
  {label:"15m",timespan:"M15",freshMinutes:45,weight:.25},
  {label:"1H",timespan:"M60",freshMinutes:180,weight:.20},
  {label:"1D",timespan:"D",freshMinutes:4320,weight:.15},
] as const;

function finite(value:unknown):number|null{
  const number=Number(value);
  return value!==null&&value!==""&&Number.isFinite(number)?number:null;
}
function pct(value:unknown):number|null{
  const number=finite(value);
  if(number==null)return null;
  return Math.abs(number)<=2?number*100:number;
}

export async function handle(request:Request){
  try{
    const user=await apiUser(request);
    const {symbol}=schema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const keys=await userKeys(user);

    const [frameResults,spyRaw]=await Promise.all([
      Promise.all(frames.map(async(frame)=>{
        const raw=await webullRead(keys,"/market-data/stocks/bars/list",{},{
          symbols:[symbol],
          category:"US_STOCK",
          timespan:frame.timespan,
          count:"120",
          real_time_required:true,
          trading_sessions:"PRE,RTH,ATH",
        });
        const bars=webullBars(raw).slice(-120);
        const signal=calculateCueSignal(bars);
        const latest=bars.at(-1);
        const ageMinutes=latest?.time&&Number.isFinite(Date.parse(latest.time))
          ? Math.max(0,(Date.now()-Date.parse(latest.time))/60000)
          : Number.POSITIVE_INFINITY;
        return {
          label:frame.label,
          state:signal.available?signal.state:null,
          score:signal.available?signal.score:null,
          fresh:ageMinutes<=frame.freshMinutes,
          lastBarTime:latest?.time??null,
          weight:frame.weight,
        };
      })),
      webullRead(keys,"/market-data/stocks/snapshots/list",{symbols:"SPY",category:"US_STOCK",extend_hour_required:"true"}),
    ]);

    const available=frameResults.filter(frame=>frame.score!=null);
    const weightTotal=available.reduce((sum,frame)=>sum+frame.weight,0);
    const compositeScore=weightTotal
      ? Math.round(available.reduce((sum,frame)=>sum+(frame.score??0)*frame.weight,0)/weightTotal)
      : null;
    const bullishFrames=available.filter(frame=>frame.state==="BUY").length;
    const spy=webullRows(spyRaw)[0];
    const marketChangePercent=pct(spy?.change_ratio);
    const fast=frameResults[0];
    const confirm=frameResults[1];

    const action=classifyIntelligence({
      fastState:fast.state,
      confirmState:confirm.state,
      fastFresh:fast.fresh,
      confirmFresh:confirm.fresh,
      compositeScore,
      marketChangePercent,
    });

    const reasons:string[]=[];
    reasons.push(bullishFrames+"/"+available.length+" tracked timeframes are bullish");
    if(compositeScore!=null)reasons.push("Composite technical score "+compositeScore+"/100");
    if(marketChangePercent!=null)reasons.push("SPY "+(marketChangePercent>=0?"+":"")+marketChangePercent.toFixed(2)+"%");
    if(!fast.fresh)reasons.push("5m data is stale");
    if(fast.state!==confirm.state)reasons.push("5m and 15m are not aligned");
    if(action==="ENTRY_READY")reasons.push("5m + 15m confirmation is aligned");
    if(action==="AVOID")reasons.push("5m + 15m both read AVOID");

    return apiJson({
      symbol,
      generatedAt:new Date(),
      compositeScore,
      alignment:bullishFrames+"/"+available.length,
      bullishFrames,
      availableFrames:available.length,
      marketChangePercent,
      action,
      frames:frameResults.map(({weight,...frame})=>frame),
      reasons,
    });
  }catch(error){
    return apiFailure(error);
  }
}

