export type PositionCommanderAction="HOLD"|"RAISE STOP"|"TAKE 25%"|"TAKE 50%"|"EXIT"|"DATA CHECK";

export function positionCommander(input:{
  fresh:boolean;
  forceFlat:boolean;
  stopHit:boolean;
  targetHit:boolean;
  currentR:number|null;
  peakR?:number|null;
  technicalState:"BUY"|"WAIT"|"AVOID"|null;
  structureTrend:"BULLISH"|"BEARISH"|"RANGE"|null;
  latestStructureEvent:string|null;
  aboveEma20:boolean|null;
  aboveVwap:boolean|null;
  entryPrice:number|null;
}):{action:PositionCommanderAction;suggestedStop:number|null;reason:string}{
  if(input.forceFlat)return {action:"EXIT",suggestedStop:null,reason:"Configured day-trade flat time has been reached."};
  if(!input.fresh)return {action:"DATA CHECK",suggestedStop:null,reason:"Fresh 5-minute data is unavailable; Omega will not make a management decision from stale candles."};
  if(input.stopHit)return {action:"EXIT",suggestedStop:null,reason:"The original stop/invalidation level has been reached."};
  if(input.targetHit)return {action:"EXIT",suggestedStop:null,reason:"The protected profit target has been reached."};
  if(input.technicalState==="AVOID"||input.structureTrend==="BEARISH"||input.latestStructureEvent==="BOS_DOWN"){
    return {action:"EXIT",suggestedStop:null,reason:"5-minute structure has broken bearish; protect the paper account instead of hoping for a recovery."};
  }
  const r=input.currentR;
  if(r!=null&&Number.isFinite(r)&&input.peakR!=null&&Number.isFinite(input.peakR)&&input.peakR>=1.5&&r<=input.peakR-.75){
    return {action:"EXIT",suggestedStop:null,reason:"Profit protection: the trade reached "+input.peakR.toFixed(2)+"R on observed closes and has given back at least 0.75R. Exit through the guarded paper path."};
  }
  if(r!=null&&r>=1.5&&input.technicalState!=="BUY"){
    return {action:"TAKE 50%",suggestedStop:input.entryPrice,reason:"Trade has reached at least +1.5R but momentum is no longer a fresh BUY; bank half and protect the remainder at break-even."};
  }
  if(r!=null&&r>=1&&input.entryPrice!=null){
    return {action:"RAISE STOP",suggestedStop:input.entryPrice,reason:"Trade has earned at least +1R; move protection to break-even while the trend remains constructive."};
  }
  if(r!=null&&r>=.75&&input.technicalState==="WAIT"){
    return {action:"TAKE 25%",suggestedStop:input.entryPrice,reason:"Trade is positive but momentum has cooled; secure a small partial and reduce give-back risk."};
  }
  if(input.technicalState==="BUY"&&input.structureTrend==="BULLISH"&&input.aboveEma20&&input.aboveVwap){
    return {action:"HOLD",suggestedStop:null,reason:"Trend, structure, EMA20 and VWAP still support the position."};
  }
  return {action:"HOLD",suggestedStop:null,reason:"No exit trigger is present; continue monitoring the protected paper position."};
}