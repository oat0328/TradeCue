import { db } from "./db";
import { ApiError } from "./apiAccess";
import { calculateCueSignal } from "./cueSignal";
import { webullRead, webullSnapshot, type WebullKeys } from "./webullClient";
import { webullBars } from "./webullBars";

export type RiskOrderInput={
  accountId:string;
  symbol:string;
  side:"BUY"|"SELL";
  orderType:"MARKET"|"LIMIT";
  quantity:number;
  limitPrice?:number;
  tradeMode?:"day_trade"|"swing"|"long_term";
};

function numberValue(value:unknown){
  const number=Number(value);
  return Number.isFinite(number)?number:null;
}
function pacificParts(date=new Date()){
  const parts=new Intl.DateTimeFormat("en-US",{
    timeZone:"America/Los_Angeles",
    year:"numeric",month:"2-digit",day:"2-digit",
    hour:"2-digit",minute:"2-digit",hour12:false,
  }).formatToParts(date);
  const get=(type:string)=>parts.find(part=>part.type===type)?.value??"";
  return {
    dateKey:get("year")+"-"+get("month")+"-"+get("day"),
    minutes:Number(get("hour"))*60+Number(get("minute")),
  };
}
export function isPastPacificCutoff(cutoff:string,date=new Date()){
  const [hourText,minuteText]=cutoff.split(":");
  const cutoffMinutes=Number(hourText)*60+Number(minuteText);
  if(!Number.isFinite(cutoffMinutes))return false;
  return pacificParts(date).minutes>=cutoffMinutes;
}
function samePacificDay(a:Date,b:Date){return pacificParts(a).dateKey===pacificParts(b).dateKey;}
function activeOrderStatus(status:string){
  const value=status.toLowerCase();
  return !["cancel","reject","fail","expire"].some(term=>value.includes(term));
}

export async function enforcePaperOrderRisk(args:{
  userId:number;
  keys:WebullKeys;
  input:RiskOrderInput;
}){
  const {userId,keys,input}=args;
  const profile=await db.selectFrom("riskProfiles").selectAll().where("userId","=",userId).executeTakeFirst();
  if(!profile)throw new ApiError(409,"Risk Firewall is not configured for this account.");

  const snapshot=await webullSnapshot(keys,input.accountId);
  const held=Number(snapshot.positions.find(position=>position.symbol.toUpperCase()===input.symbol.toUpperCase())?.quantity??0);

  if(input.side==="SELL"){
    if(profile.longOnly&&input.quantity>held){
      throw new ApiError(403,"Risk Firewall blocked this SELL because TradeCUE is long-only and the order exceeds the shares currently held.");
    }
    return {
      allowed:true as const,
      mode:"exit" as const,
      heldShares:held,
      plannedRisk:null,
      referencePrice:null,
      stop:null,
      signalScore:null,
      fresh:null,
    };
  }

  const maxDailyLoss=Number(profile.maxDailyLoss);
  const dayPnl=numberValue(snapshot.balance.dayPnl);
  if(Number.isFinite(maxDailyLoss)&&maxDailyLoss>0&&dayPnl!=null&&dayPnl<=-maxDailyLoss){
    throw new ApiError(403,"Risk Firewall blocked new BUY orders because today's loss limit has been reached.");
  }

  const recent=await db.selectFrom("paperOrders")
    .select(["createdAt","side","status"])
    .where("userId","=",userId)
    .where("createdAt",">",new Date(Date.now()-36*60*60*1000))
    .execute();
  const tradesToday=recent.filter(order=>
    order.side==="BUY"&&activeOrderStatus(order.status)&&samePacificDay(new Date(order.createdAt as any),new Date())
  ).length;
  if(tradesToday>=profile.maxTradesPerDay){
    throw new ApiError(403,"Risk Firewall blocked this BUY because the maximum trades-per-day limit has been reached.");
  }

  const tradeMode=input.tradeMode??"day_trade";
  if(tradeMode==="day_trade"&&isPastPacificCutoff(profile.dayTradeFlatTimePt)){
    throw new ApiError(403,"Risk Firewall blocked a new day-trade entry after the configured "+profile.dayTradeFlatTimePt+" PM/AM PT cutoff.");
  }

  const raw=await webullRead(keys,"/market-data/stocks/bars/list",{},{
    symbols:[input.symbol],
    category:"US_STOCK",
    timespan:"M5",
    count:"160",
    real_time_required:true,
    trading_sessions:"PRE,RTH,ATH",
  });
  const bars=webullBars(raw).slice(-160);
  const latest=bars.at(-1);
  const latestAgeMinutes=latest?.time&&Number.isFinite(Date.parse(latest.time))
    ? Math.max(0,(Date.now()-Date.parse(latest.time))/60000)
    : Number.POSITIVE_INFINITY;
  const fresh=latestAgeMinutes<=20;
  const signal=calculateCueSignal(bars);

  if(profile.safeModeEnabled&&!fresh){
    throw new ApiError(403,"Risk Firewall blocked this BUY because the latest 5-minute market data is stale.");
  }
  if(!signal.available){
    throw new ApiError(403,"Risk Firewall cannot verify this BUY because TradeCUE does not have enough valid candles.");
  }
  if(profile.requireGreenConfirmation&&signal.state!=="BUY"){
    throw new ApiError(403,"Risk Firewall requires a fresh CUE BUY setup before opening a new long position.");
  }
  if(profile.noChaseEnabled&&(signal.metrics.extensionAtr>1.5||signal.flags.some(flag=>flag.toLowerCase().includes("extended")))){
    throw new ApiError(403,"Risk Firewall blocked this BUY because price is extended and No-Chase is enabled.");
  }
  if(!signal.plan){
    throw new ApiError(403,"Risk Firewall cannot size this BUY because TradeCUE has no valid stop plan for the current setup.");
  }

  const referencePrice=input.orderType==="LIMIT"&&input.limitPrice!=null?input.limitPrice:latest?.close;
  if(referencePrice==null||!Number.isFinite(referencePrice)){
    throw new ApiError(403,"Risk Firewall cannot verify the order price.");
  }
  const perShareRisk=Math.max(0,referencePrice-signal.plan.stop);
  const plannedRisk=perShareRisk*input.quantity;
  const maxRisk=Number(profile.maxRiskPerTrade);
  if(perShareRisk<=0){
    throw new ApiError(403,"Risk Firewall rejected the setup because the calculated stop is not below the planned long entry.");
  }
  if(Number.isFinite(maxRisk)&&maxRisk>0&&plannedRisk>maxRisk+0.0001){
    throw new ApiError(403,"Risk Firewall blocked this BUY: planned risk $"+plannedRisk.toFixed(2)+" exceeds your $"+maxRisk.toFixed(2)+" max risk per trade.");
  }

  return {
    allowed:true as const,
    mode:tradeMode,
    heldShares:held,
    plannedRisk:Number(plannedRisk.toFixed(2)),
    referencePrice:Number(referencePrice.toFixed(4)),
    stop:signal.plan.stop,
    signalScore:signal.score,
    signalState:signal.state,
    fresh,
    dayPnl,
    tradesToday,
  };
}
