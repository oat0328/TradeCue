export type HunterAction="ENTRY_READY"|"WATCH"|"WAIT";
export function classifyHunterCandidate(input:{
  signalAvailable:boolean;
  fresh:boolean;
  state:"BUY"|"WAIT"|"AVOID"|null;
  score:number|null;
  trend:number|null;
  setup:number|null;
  volume:number|null;
  hasPlan:boolean;
  minScore:number;
}):HunterAction{
  if(!input.signalAvailable||!input.fresh||input.score==null)return "WAIT";
  const entryReady=
    input.state==="BUY"&&
    input.hasPlan&&
    input.score>=Math.max(input.minScore,75)&&
    (input.trend??0)>=70&&
    (input.setup??0)>=70&&
    (input.volume??0)>=50;
  if(entryReady)return "ENTRY_READY";
  if(input.state!=="AVOID"&&input.score>=input.minScore)return "WATCH";
  return "WAIT";
}

export type IntelligenceAction="ENTRY_READY"|"WAIT"|"AVOID";
export function classifyIntelligence(input:{
  fastState:"BUY"|"WAIT"|"AVOID"|null;
  confirmState:"BUY"|"WAIT"|"AVOID"|null;
  fastFresh:boolean;
  confirmFresh:boolean;
  compositeScore:number|null;
  marketChangePercent:number|null;
}):IntelligenceAction{
  if(input.fastState==="AVOID"&&input.confirmState==="AVOID"&&input.fastFresh&&input.confirmFresh)return "AVOID";
  if(
    input.fastState==="BUY"&&
    input.confirmState==="BUY"&&
    input.fastFresh&&
    input.confirmFresh&&
    (input.compositeScore??0)>=75&&
    (input.marketChangePercent==null||input.marketChangePercent>-1.5)
  )return "ENTRY_READY";
  return "WAIT";
}

