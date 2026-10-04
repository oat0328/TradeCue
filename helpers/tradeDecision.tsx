import type { CueSignal, CueSignalUnavailable } from "./cueSignal";

export type TradeDecisionState =
  | "ENTER_NOW"
  | "WAIT"
  | "DO_NOT_CHASE"
  | "STAY_AWAY"
  | "HOLD"
  | "TAKE_PARTIAL"
  | "TAKE_PROFIT"
  | "EXIT_REVIEW"
  | "EXIT_NOW"
  | "MARKET_CLOSED"
  | "DATA_CHECK";

export type TradeDecision = {
  state: TradeDecisionState;
  headline: string;
  instruction: string;
  entry: { low:number; high:number } | null;
  stop: number | null;
  targets: { t1:number; t2:number; t3:number } | null;
};

export function buildTradeDecision(input:{
  signal:CueSignal|CueSignalUnavailable;
  intelligenceAction?:"ENTRY_READY"|"WAIT"|"AVOID"|null;
  currentPrice:number|null|undefined;
  fresh:boolean;
  hasPosition:boolean;
  marketActive:boolean;
  marketLabel:string;
}):TradeDecision{
  const {signal,intelligenceAction,currentPrice,fresh,hasPosition,marketActive,marketLabel}=input;

  if(!signal.available || currentPrice==null || !Number.isFinite(currentPrice)){
    return {state:"DATA_CHECK",headline:"DATA CHECK",instruction:"TradeCUE needs valid current Webull candles before it can issue an entry/exit instruction.",entry:null,stop:null,targets:null};
  }

  const plan=signal.plan;
  const common={
    entry:plan?{low:plan.entryLow,high:plan.entryHigh}:null,
    stop:plan?.stop??null,
    targets:plan?{t1:plan.target1,t2:plan.target2,t3:plan.target3}:null,
  };

  if(!marketActive){
    return {
      state:"MARKET_CLOSED",
      headline:marketLabel==="WEEKEND PREP"?"MONDAY PREP":"MARKET CLOSED",
      instruction:"Use this setup for planning only. Do not treat last-session prices as a new live stock entry.",
      ...common,
    };
  }

  if(!fresh){
    return {state:"WAIT",headline:"WAIT",instruction:"Latest intraday data is stale. Wait for a fresh Webull candle before acting.",...common};
  }

  if(hasPosition){
    if(plan && currentPrice<=plan.stop){
      return {state:"EXIT_NOW",headline:"EXIT NOW",instruction:"Current price is at or below the active technical stop. Review/execute the planned exit; do not widen the stop to avoid a loss.",...common};
    }
    if(signal.state==="AVOID"||intelligenceAction==="AVOID"){
      return {state:"EXIT_REVIEW",headline:"EXIT REVIEW",instruction:"Trend/confirmation has weakened into AVOID conditions. Review the position immediately against your stop and trade thesis.",...common};
    }
    if(plan && currentPrice>=plan.target3){
      return {state:"TAKE_PROFIT",headline:"TAKE PROFIT",instruction:"Price has reached or exceeded TP3. Lock in the planned gain or manage only a deliberately retained runner.",...common};
    }
    if(plan && currentPrice>=plan.target2){
      return {state:"TAKE_PARTIAL",headline:"TAKE PARTIAL",instruction:"Price has reached TP2. Consider taking additional profit and tightening protection on the remainder.",...common};
    }
    if(plan && currentPrice>=plan.target1){
      return {state:"TAKE_PARTIAL",headline:"TP1 HIT",instruction:"Price has reached TP1. Consider taking partial profit and protecting the remaining position near breakeven/structure.",...common};
    }
    return {state:"HOLD",headline:"HOLD / MANAGE",instruction:"The position has not hit the technical stop or targets and the setup has not degraded into AVOID. Continue monitoring.",...common};
  }

  if(signal.state==="AVOID"||intelligenceAction==="AVOID"){
    return {state:"STAY_AWAY",headline:"STAY AWAY",instruction:"Current technical conditions are weak enough that TradeCUE does not want a new long entry.",...common};
  }

  if(!plan){
    return {state:"WAIT",headline:"WAIT",instruction:"No valid entry/stop plan exists yet. Wait for a cleaner structure.",...common};
  }

  if(currentPrice<plan.entryLow){
    return {state:"WAIT",headline:"WAIT FOR RECLAIM",instruction:"Price is below the planned entry zone. Wait for price to reclaim the zone with fresh confirmation instead of guessing the bottom.",...common};
  }

  if(currentPrice>plan.entryHigh){
    return {state:"DO_NOT_CHASE",headline:"DO NOT CHASE",instruction:"Price is above the planned entry zone. Wait for a pullback/retest rather than buying extended.",...common};
  }

  if(signal.state==="BUY"&&intelligenceAction==="ENTRY_READY"){
    return {state:"ENTER_NOW",headline:"ENTRY READY NOW",instruction:"Price is inside the planned entry zone and fresh multi-timeframe confirmation is aligned. Use the planned stop and risk-sized share count.",...common};
  }

  return {state:"WAIT",headline:"WAIT",instruction:"Price is near the setup area, but TradeCUE does not yet have full multi-timeframe entry confirmation.",...common};
}
