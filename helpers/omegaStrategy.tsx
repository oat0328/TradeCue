export type OmegaGrade="A+"|"A"|"B"|"NO_TRADE";
export type OmegaMarketBias="BULLISH"|"BEARISH"|"NEUTRAL";
export type OmegaMarketMode="TREND_DAY"|"RANGE_DAY"|"REVERSAL_DAY"|"CHOPPY_DAY";

export const OMEGA_EXECUTION_SYMBOLS=["SPY","QQQ","TSLA","NVDA","AAPL","MSFT","AMD","META","AMZN","GOOG"] as const;

export function omegaLongSetupScore(input:{
  aboveEma20:boolean;
  ema20Rising:boolean;
  aboveVwap:boolean;
  volumeConfirmed:boolean;
  pullback:boolean;
  confirmation:boolean;
  marketAligned:boolean;
}){
  return (input.aboveEma20?2:0)
    +(input.ema20Rising?2:0)
    +(input.aboveVwap?1:0)
    +(input.volumeConfirmed?1:0)
    +(input.pullback?2:0)
    +(input.confirmation?2:0)
    +(input.marketAligned?2:0);
}

export function omegaShortSetupScore(input:{
  belowEma20:boolean;
  ema20Falling:boolean;
  belowVwap:boolean;
  volumeConfirmed:boolean;
  bounce:boolean;
  confirmation:boolean;
  marketAligned:boolean;
}){
  return (input.belowEma20?2:0)
    +(input.ema20Falling?2:0)
    +(input.belowVwap?1:0)
    +(input.volumeConfirmed?1:0)
    +(input.bounce?2:0)
    +(input.confirmation?2:0)
    +(input.marketAligned?2:0);
}

export function omegaGrade(score:number):OmegaGrade{
  if(score>=10)return "A+";
  if(score>=8)return "A";
  if(score>=6)return "B";
  return "NO_TRADE";
}

export function omegaConfidence(score:number){
  if(score>=8)return Math.min(100,Math.round(70+(score-8)*7.5));
  return Math.max(0,Math.round(score/8*69));
}

export function omegaConfidenceLabel(confidence:number){
  if(confidence>=95)return "ELITE";
  if(confidence>=90)return "EXCELLENT";
  if(confidence>=80)return "STRONG";
  if(confidence>=70)return "ACCEPTABLE";
  return "NO_TRADE";
}

export function omegaPropTrainingReady(input:{
  fiveMinBuy:boolean;
  setupGrade:OmegaGrade;
  confidence:number;
  marketBias:OmegaMarketBias;
  fifteenBullish:boolean;
  fifteenBearish:boolean;
  oneHourBullish:boolean;
  oneHourBearish:boolean;
}){
  if(!input.fiveMinBuy)return false;
  if(input.marketBias==="BEARISH")return false;
  if(input.setupGrade!=="A"&&input.setupGrade!=="A+")return false;
  if(input.confidence<70)return false;
  if(input.fifteenBearish||input.oneHourBearish)return false;
  if(input.setupGrade==="A+"&&input.confidence>=85)return true;
  return input.fifteenBullish||input.oneHourBullish;
}

export function omegaBreadth(changes:Array<number|null|undefined>){
  const finite=changes.filter((v):v is number=>v!=null&&Number.isFinite(v));
  const advancing=finite.filter(v=>v>0).length;
  const declining=finite.filter(v=>v<0).length;
  const unchanged=finite.length-advancing-declining;
  const breadthScore=finite.length?Math.round(advancing/finite.length*100):50;
  const advanceDeclineRatio=declining>0?advancing/declining:advancing>0?advancing:null;
  return {advancing,declining,unchanged,breadthScore,advanceDeclineRatio};
}

export function omegaMarketBias(input:{spyChange:number|null;qqqChange:number|null;breadthScore:number}):OmegaMarketBias{
  if(input.spyChange!=null&&input.qqqChange!=null&&input.spyChange>0&&input.qqqChange>0&&input.breadthScore>=55)return "BULLISH";
  if(input.spyChange!=null&&input.qqqChange!=null&&input.spyChange<0&&input.qqqChange<0&&input.breadthScore<=45)return "BEARISH";
  return "NEUTRAL";
}

export function omegaMarketMode(input:{
  bias:OmegaMarketBias;
  breadthScore:number;
  spyChange:number|null;
  qqqChange:number|null;
}):OmegaMarketMode{
  const spy=Math.abs(input.spyChange??0);
  const qqq=Math.abs(input.qqqChange??0);
  const impulse=Math.max(spy,qqq);
  if(input.bias!=="NEUTRAL"&&impulse>=0.8)return "TREND_DAY";
  if(input.bias==="NEUTRAL"&&input.breadthScore>=42&&input.breadthScore<=58&&impulse<0.7)return "RANGE_DAY";
  if(input.bias==="NEUTRAL"&&impulse>=1.2)return "REVERSAL_DAY";
  return "CHOPPY_DAY";
}

export function omegaHealthScore(input:{
  execution:boolean;
  data:boolean;
  scanner:boolean;
  strategy:boolean;
  risk:boolean;
  reporting:boolean;
}){
  return (input.execution?20:0)
    +(input.data?20:0)
    +(input.scanner?15:0)
    +(input.strategy?15:0)
    +(input.risk?20:0)
    +(input.reporting?10:0);
}

export function omegaHealthLabel(score:number){
  if(score>=95)return "ELITE";
  if(score>=85)return "HEALTHY";
  if(score>=75)return "WARNING";
  return "CRITICAL";
}

export function omegaTradingReady(score:number,criticalErrors:number){
  return score>90&&criticalErrors===0;
}
