import type { WebullBar } from "./webullBars";
import { calculateMarketStructure } from "./marketStructure";

export type CueSignalState = "BUY" | "WAIT" | "AVOID";
export type CueSignalOptions={protectedTargetR?:number};
export type CandlePressure={
  strongBuyerControl:boolean;
  strongSellerControl:boolean;
  indecisionWarning:boolean;
  bodyRatio:number;
  upperWickRatio:number;
  lowerWickRatio:number;
};

export type CueSignal = {
  available: true;
  version: "technical-v0.1";
  state: CueSignalState;
  setupStage: "PRICE_ACTION_BEARISH"|"PRICE_ACTION_NOT_BULLISH"|"BELOW_EMA20"|"EMA20_NOT_RISING"|"VWAP_UNAVAILABLE"|"BELOW_VWAP"|"VOLUME_NOT_RISING"|"WAIT_PULLBACK"|"WAIT_GREEN"|"TOO_EXTENDED"|"TARGET_UNREALISTIC"|"ENTRY_READY";
  score: number;
  componentScores: {
    trend: number;
    momentum: number;
    volume: number;
    setup: number;
    risk: number;
  };
  metrics: {
    close: number;
    ema9: number;
    ema20: number;
    vwap: number|null;
    rsi14: number;
    atr14: number;
    atrPercent: number;
    relativeVolume: number;
    support20: number;
    resistance20: number;
    extensionAtr: number;
    target2Atr: number|null;
    protectedTargetR:number;
    strongBuyerControl:boolean;
    strongSellerControl:boolean;
    indecisionWarning:boolean;
    ema20Rising: boolean;
    ema20Falling: boolean;
    aboveEma20: boolean;
    belowEma20: boolean;
    aboveVwap: boolean;
    belowVwap: boolean;
    volumeIncreasing: boolean;
    pullback: boolean;
    bounce: boolean;
    greenConfirmation: boolean;
    redConfirmation: boolean;
    pullbackLow: number;
    priceActionTrend: "BULLISH"|"BEARISH"|"RANGE";
    priceActionPattern: string;
  };
  plan: {
    entryLow: number;
    entryHigh: number;
    stop: number;
    target1: number;
    target2: number;
    target3: number;
  } | null;
  flags: string[];
  explanation: string[];
};

export type CueSignalUnavailable = {
  available: false;
  reason: string;
};

function clamp(value:number,min=0,max=100){return Math.max(min,Math.min(max,value));}
function round(value:number,decimals=2){const p=10**decimals;return Math.round(value*p)/p;}

export function classifyCandlePressure(bar:{open:number;high:number;low:number;close:number}):CandlePressure{
  const range=Math.max(0,bar.high-bar.low);
  if(!Number.isFinite(range)||range<=0)return {strongBuyerControl:false,strongSellerControl:false,indecisionWarning:false,bodyRatio:0,upperWickRatio:0,lowerWickRatio:0};
  const body=Math.abs(bar.close-bar.open);
  const upper=Math.max(0,bar.high-Math.max(bar.open,bar.close));
  const lower=Math.max(0,Math.min(bar.open,bar.close)-bar.low);
  const bodyRatio=body/range,upperWickRatio=upper/range,lowerWickRatio=lower/range;
  const strongBuyerControl=bar.close>bar.open&&bodyRatio>=.65&&lowerWickRatio<=.08;
  const strongSellerControl=bar.close<bar.open&&bodyRatio>=.65&&upperWickRatio<=.08;
  const indecisionWarning=bodyRatio<=.28&&upperWickRatio>=.20&&lowerWickRatio>=.20;
  return {strongBuyerControl,strongSellerControl,indecisionWarning,bodyRatio,upperWickRatio,lowerWickRatio};
}

function ema(values:number[],period:number){
  if(values.length<period)return null;
  const k=2/(period+1);
  let value=values.slice(0,period).reduce((a,b)=>a+b,0)/period;
  for(let i=period;i<values.length;i++) value=values[i]*k+value*(1-k);
  return value;
}

function rsi(values:number[],period=14){
  if(values.length<=period)return null;
  let gains=0,losses=0;
  for(let i=1;i<=period;i++){
    const diff=values[i]-values[i-1];
    if(diff>=0)gains+=diff;else losses-=diff;
  }
  let avgGain=gains/period,avgLoss=losses/period;
  for(let i=period+1;i<values.length;i++){
    const diff=values[i]-values[i-1];
    const gain=Math.max(diff,0),loss=Math.max(-diff,0);
    avgGain=(avgGain*(period-1)+gain)/period;
    avgLoss=(avgLoss*(period-1)+loss)/period;
  }
  if(avgLoss===0)return 100;
  const rs=avgGain/avgLoss;
  return 100-100/(1+rs);
}

function atr(bars:WebullBar[],period=14){
  if(bars.length<=period)return null;
  const tr:number[]=[];
  for(let i=1;i<bars.length;i++){
    const current=bars[i],previous=bars[i-1];
    tr.push(Math.max(
      current.high-current.low,
      Math.abs(current.high-previous.close),
      Math.abs(current.low-previous.close),
    ));
  }
  let value=tr.slice(0,period).reduce((a,b)=>a+b,0)/period;
  for(let i=period;i<tr.length;i++) value=(value*(period-1)+tr[i])/period;
  return value;
}

function momentumScore(rsiValue:number){
  if(rsiValue>75)return 50;
  if(rsiValue>=65)return 80;
  if(rsiValue>=50)return 80+(rsiValue-50)/15*20;
  if(rsiValue>=40)return 50+(rsiValue-40)/10*30;
  if(rsiValue>=30)return 30+(rsiValue-30)/10*20;
  return 20;
}

function etParts(time:string|undefined){
  if(!time||!Number.isFinite(Date.parse(time)))return null;
  const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(new Date(time));
  const get=(type:string)=>parts.find(part=>part.type===type)?.value??"";
  return {date:get("year")+"-"+get("month")+"-"+get("day"),minutes:Number(get("hour"))*60+Number(get("minute"))};
}

function regularSessionVwap(bars:WebullBar[],referenceTime:string|undefined){
  const ref=etParts(referenceTime);
  if(!ref)return null;
  let volume=0,weighted=0;
  for(const bar of bars){
    const p=etParts(bar.time);
    if(!p||p.date!==ref.date||p.minutes<570||p.minutes>=960||bar.volume<=0)continue;
    const typical=(bar.high+bar.low+bar.close)/3;
    volume+=bar.volume;
    weighted+=typical*bar.volume;
  }
  return volume>0?weighted/volume:null;
}

export function calculateCueSignal(input:WebullBar[],options:CueSignalOptions={}):CueSignal|CueSignalUnavailable{
  const bars=input
    .filter(bar=>[bar.open,bar.high,bar.low,bar.close,bar.volume].every(Number.isFinite))
    .slice(-200);
  if(bars.length<30)return {available:false,reason:"At least 30 valid candles are required for the technical signal."};

  const closes=bars.map(bar=>bar.close);
  const last=bars[bars.length-1];
  const confirm=bars[bars.length-2];
  const beforeConfirm=bars[bars.length-3];
  const completedBars=bars.slice(0,-1);
  const structure=calculateMarketStructure(completedBars);
  const completedCloses=completedBars.map(bar=>bar.close);
  const ema9Value=ema(completedCloses,9);
  const ema20Value=ema(completedCloses,20);
  const ema20Past=ema(completedCloses.slice(0,-5),20);
  const rsiValue=rsi(completedCloses,14);
  const atrValue=atr(completedBars,14);
  if(ema9Value==null||ema20Value==null||ema20Past==null||rsiValue==null||atrValue==null||atrValue<=0){
    return {available:false,reason:"The indicator set could not be calculated from the available candles."};
  }

  let volumeIndex=bars.length-2;
  while(volumeIndex>0&&bars[volumeIndex].volume<=0)volumeIndex--;
  const volumeBar=bars[volumeIndex];
  const priorVolumes=bars.slice(Math.max(0,volumeIndex-20),volumeIndex).map(bar=>bar.volume).filter(value=>value>0);
  const avgVolume=priorVolumes.length?priorVolumes.reduce((a,b)=>a+b,0)/priorVolumes.length:0;
  const relativeVolume=avgVolume>0?volumeBar.volume/avgVolume:0;
  const volumeLag=bars.length-1-volumeIndex;
  const recent=completedBars.slice(-20);
  const support20=Math.min(...recent.map(bar=>bar.low));
  const resistance20=Math.max(...recent.map(bar=>bar.high));
  const extensionAtr=(confirm.close-ema20Value)/atrValue;
  const atrPercent=atrValue/confirm.close*100;
  const ema20Rising=ema20Value>ema20Past;
  const ema20Falling=ema20Value<ema20Past;
  const aboveEma20=confirm.close>ema20Value;
  const belowEma20=confirm.close<ema20Value;
  const pullbackWindow=bars.slice(Math.max(0,bars.length-8),bars.length-2);
  const pullbackTolerance=.35*atrValue;
  const pullbackBars=pullbackWindow.filter(bar=>bar.low<=ema20Value+pullbackTolerance&&bar.close>=ema20Value-.20*atrValue);
  const pullback=pullbackBars.length>0;
  const pullbackLow=pullbackBars.length?Math.min(...pullbackBars.map(bar=>bar.low)):Math.min(...pullbackWindow.map(bar=>bar.low));
  const bounceBars=pullbackWindow.filter(bar=>bar.high>=ema20Value-pullbackTolerance&&bar.close<=ema20Value+.20*atrValue);
  const bounce=bounceBars.length>0;
  const confirmPressure=classifyCandlePressure(confirm);
  const greenConfirmation=Boolean(
    confirm&&beforeConfirm&&
    confirm.close>confirm.open&&
    (confirm.close>beforeConfirm.close||confirmPressure.strongBuyerControl)&&
    confirm.close>ema20Value&&
    !confirmPressure.indecisionWarning&&
    !confirmPressure.strongSellerControl
  );
  const redConfirmation=Boolean(
    confirm&&beforeConfirm&&
    confirm.close<confirm.open&&
    confirm.close<beforeConfirm.close&&
    confirm.close<ema20Value
  );
  const vwapValue=regularSessionVwap(completedBars,confirm.time);
  const aboveVwap=vwapValue!=null&&confirm.close>vwapValue;
  const belowVwap=vwapValue!=null&&confirm.close<vwapValue;
  const priorConfirmVolumes=completedBars.slice(-6,-1).map(bar=>bar.volume).filter(value=>value>0);
  const priorConfirmAvg=priorConfirmVolumes.length?priorConfirmVolumes.reduce((a,b)=>a+b,0)/priorConfirmVolumes.length:0;
  const volumeIncreasing=priorConfirmAvg>0&&confirm.volume>=priorConfirmAvg;

  const bearishPriceAction=structure.trend==="BEARISH"||confirmPressure.strongSellerControl;
  const bullishPriceAction=structure.trend==="BULLISH";
  const trend=clamp(Math.min(!bullishPriceAction?40:100,(aboveEma20?60:20)+(ema20Rising?40:0)));

  const momentum=clamp(momentumScore(rsiValue));
  const volume=clamp(40+(relativeVolume-1)*50);

  const absoluteExtension=Math.abs(extensionAtr);
  let setup=!aboveEma20?20:!pullback?55:!greenConfirmation?75:100;
  if(!bullishPriceAction||!aboveVwap||!volumeIncreasing)setup=Math.min(setup,35);
  if(absoluteExtension>1.25)setup=Math.min(setup,35);
  setup=clamp(setup);

  const risk=clamp(
    atrPercent<=1?85:
    atrPercent<=2?75:
    atrPercent<=3?62:
    atrPercent<=5?45:30
  );

  const score=round(trend*.35+setup*.40+volume*.10+risk*.15,0);
  const extended=extensionAtr>1.25;
  const entryLow=confirm.close;
  const entryHigh=confirm.high+.05*atrValue;
  const stop=pullbackLow-.10*atrValue;
  const riskDistance=entryHigh-stop;
  const protectedTargetR=clamp(options.protectedTargetR??2,1.5,2);
  const target2Atr=riskDistance>0?(riskDistance*protectedTargetR)/atrValue:null;
  const targetRealistic=target2Atr!=null&&target2Atr<=4;
  const setupStage:CueSignal["setupStage"]=
    bearishPriceAction?"PRICE_ACTION_BEARISH":
    !bullishPriceAction?"PRICE_ACTION_NOT_BULLISH":
    !aboveEma20?"BELOW_EMA20":
    !ema20Rising?"EMA20_NOT_RISING":
    vwapValue==null?"VWAP_UNAVAILABLE":
    !aboveVwap?"BELOW_VWAP":
    !volumeIncreasing?"VOLUME_NOT_RISING":
    extended?"TOO_EXTENDED":
    !pullback?"WAIT_PULLBACK":
    !greenConfirmation?"WAIT_GREEN":
    !targetRealistic?"TARGET_UNREALISTIC":
    "ENTRY_READY";
  const state:CueSignalState=
    setupStage==="ENTRY_READY"?"BUY":
    setupStage==="PRICE_ACTION_BEARISH"?"AVOID":
    aboveEma20?"WAIT":"AVOID";

  const flags:string[]=[];
  if(extended)flags.push("Too extended above EMA 20 — wait for a pullback");
  if(confirmPressure.strongBuyerControl)flags.push("Strong green buyer-control candle: large body with little/no lower wick — bullish confirmation.");
  if(confirmPressure.strongSellerControl)flags.push("Strong red seller-control candle: large body with little/no upper wick — do not catch a falling knife.");
  if(confirmPressure.indecisionWarning)flags.push("Warning candle: small body with wicks on both sides — momentum is undecided; wait for the next completed confirmation.");
  if(bearishPriceAction)flags.push("Price action is bearish: lower highs + lower lows — no long entry");
  else if(!bullishPriceAction)flags.push("Price action is not yet a clean higher-high + higher-low uptrend");
  if(volumeLag>0)flags.push("Volume uses the last completed non-zero bar");
  if(relativeVolume>=1.5)flags.push("Elevated relative volume");
  if(confirm.close>ema20Value)flags.push("Price above EMA 20");
  else flags.push("Price below EMA 20");
  if(ema20Rising)flags.push("EMA 20 is rising");
  else flags.push("EMA 20 is flat or falling");
  if(vwapValue==null)flags.push("RTH VWAP unavailable — no A+ long entry");
  else flags.push(aboveVwap?"Price above VWAP":"Price below VWAP");
  flags.push(volumeIncreasing?"Confirmation volume is increasing":"Confirmation volume is not increasing");
  flags.push(pullback?"Pullback touched the EMA 20 area":"No qualifying pullback yet");
  flags.push(greenConfirmation?"Completed green confirmation candle":"Waiting for completed green confirmation candle");
  if(target2Atr!=null)flags.push(targetRealistic?protectedTargetR+"R protected target fits current ATR":protectedTargetR+"R protected target is too far for current ATR");
  if(rsiValue>70)flags.push("RSI elevated");
  if(rsiValue<40)flags.push("Momentum weak");

  const plan=riskDistance>0&&targetRealistic&&setupStage==="ENTRY_READY"?{
    entryLow:round(entryLow),
    entryHigh:round(entryHigh),
    stop:round(stop),
    target1:round(entryHigh+riskDistance),
    target2:round(entryHigh+riskDistance*protectedTargetR),
    target3:round(entryHigh+riskDistance*3),
  }:null;

  const explanation=[
    `Price action is ${structure.trend.toLowerCase()} (${structure.pattern}); A+ longs require a bullish higher-high + higher-low structure.`,
    `EMA 20 is ${round(ema20Value)} and is ${ema20Rising?"rising":"not rising"}; price is ${aboveEma20?"above":"below"} it.`,
    vwapValue==null?"Regular-session VWAP is unavailable.":`RTH VWAP is ${round(vwapValue)}; price is ${aboveVwap?"above":"below"} VWAP.`,
    volumeIncreasing?"The confirmation candle volume is at or above the prior five completed candles average.":"Confirmation volume has not expanded versus the prior five completed candles.",
    pullback?`A recent candle pulled back into the EMA 20 area; pullback low is ${round(pullbackLow)}.`:"No valid pullback into the EMA 20 area has formed yet.",
    greenConfirmation?`The last completed candle is green and closed back above the prior close and EMA 20.`:"A completed green confirmation candle has not appeared yet.",
    `Relative volume is ${round(relativeVolume,2)}× the recent completed-bar average; volume is context, not the trigger.`,
    plan?`Risk is defined from entry ${round(entryHigh)} to stop ${round(stop)}, with targets at 1R, ${protectedTargetR}R protected and 3R extended.`:"A complete stop/target plan is not available yet.",
  ];

  return {
    available:true,
    version:"technical-v0.1",
    state,
    setupStage,
    score,
    componentScores:{trend:round(trend,0),momentum:round(momentum,0),volume:round(volume,0),setup:round(setup,0),risk:round(risk,0)},
    metrics:{
      close:round(last.close),
      ema9:round(ema9Value),
      ema20:round(ema20Value),
      vwap:vwapValue==null?null:round(vwapValue),
      rsi14:round(rsiValue,1),
      atr14:round(atrValue),
      atrPercent:round(atrPercent,2),
      relativeVolume:round(relativeVolume,2),
      support20:round(support20),
      resistance20:round(resistance20),
      extensionAtr:round(extensionAtr,2),
      target2Atr:target2Atr==null?null:round(target2Atr,2),
      protectedTargetR,
      strongBuyerControl:confirmPressure.strongBuyerControl,
      strongSellerControl:confirmPressure.strongSellerControl,
      indecisionWarning:confirmPressure.indecisionWarning,
      ema20Rising,
      ema20Falling,
      aboveEma20,
      belowEma20,
      aboveVwap,
      belowVwap,
      volumeIncreasing,
      pullback,
      bounce,
      greenConfirmation,
      redConfirmation,
      pullbackLow:round(pullbackLow),
      priceActionTrend:structure.trend,
      priceActionPattern:structure.pattern,
    },
    plan,
    flags,
    explanation,
  };
}
