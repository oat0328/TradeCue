import type { WebullBar } from "./webullBars";

export type CueSignalState = "BUY" | "WAIT" | "AVOID";

export type CueSignal = {
  available: true;
  version: "technical-v0.1";
  state: CueSignalState;
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
    rsi14: number;
    atr14: number;
    atrPercent: number;
    relativeVolume: number;
    support20: number;
    resistance20: number;
    extensionAtr: number;
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

export function calculateCueSignal(input:WebullBar[]):CueSignal|CueSignalUnavailable{
  const bars=input
    .filter(bar=>[bar.open,bar.high,bar.low,bar.close,bar.volume].every(Number.isFinite))
    .slice(-200);
  if(bars.length<30)return {available:false,reason:"At least 30 valid candles are required for the technical signal."};

  const closes=bars.map(bar=>bar.close);
  const volumes=bars.map(bar=>bar.volume);
  const last=bars[bars.length-1];
  const ema9Value=ema(closes,9);
  const ema20Value=ema(closes,20);
  const ema20Past=ema(closes.slice(0,-5),20);
  const rsiValue=rsi(closes,14);
  const atrValue=atr(bars,14);
  if(ema9Value==null||ema20Value==null||ema20Past==null||rsiValue==null||atrValue==null||atrValue<=0){
    return {available:false,reason:"The indicator set could not be calculated from the available candles."};
  }

  let volumeIndex=bars.length-1;
  while(volumeIndex>0&&bars[volumeIndex].volume<=0)volumeIndex--;
  const volumeBar=bars[volumeIndex];
  const priorVolumes=bars.slice(Math.max(0,volumeIndex-20),volumeIndex).map(bar=>bar.volume).filter(value=>value>0);
  const avgVolume=priorVolumes.length?priorVolumes.reduce((a,b)=>a+b,0)/priorVolumes.length:0;
  const relativeVolume=avgVolume>0?volumeBar.volume/avgVolume:0;
  const volumeLag=bars.length-1-volumeIndex;
  const recent=bars.slice(-20);
  const support20=Math.min(...recent.map(bar=>bar.low));
  const resistance20=Math.max(...recent.map(bar=>bar.high));
  const extensionAtr=(last.close-ema9Value)/atrValue;
  const atrPercent=atrValue/last.close*100;

  let trend=50;
  trend+=last.close>ema9Value?20:-20;
  trend+=ema9Value>ema20Value?15:-15;
  trend+=ema20Value>ema20Past?15:-15;
  trend=clamp(trend);

  const momentum=clamp(momentumScore(rsiValue));
  const volume=clamp(40+(relativeVolume-1)*50);

  let setup=last.close>=ema20Value?70:30;
  const absoluteExtension=Math.abs(extensionAtr);
  if(last.close>=ema20Value){
    setup=absoluteExtension<=.5?92:absoluteExtension<=1?78:absoluteExtension<=1.5?58:28;
  }
  if(rsiValue>75)setup-=15;
  setup=clamp(setup);

  const risk=clamp(
    atrPercent<=1?85:
    atrPercent<=2?75:
    atrPercent<=3?62:
    atrPercent<=5?45:30
  );

  const score=round(trend*.30+momentum*.20+volume*.15+setup*.25+risk*.10,0);
  const extended=extensionAtr>1.5||rsiValue>75;
  const state:CueSignalState=
    score>=75&&trend>=65&&setup>=65&&!extended?"BUY":
    score>=50&&trend>=45?"WAIT":"AVOID";

  const flags:string[]=[];
  if(extended)flags.push("Extended from the short-term mean");
  if(volumeLag>0)flags.push("Volume uses the last completed non-zero bar");
  if(relativeVolume>=1.5)flags.push("Elevated relative volume");
  if(last.close>ema20Value)flags.push("Price above EMA 20");
  else flags.push("Price below EMA 20");
  if(ema9Value>ema20Value)flags.push("EMA 9 above EMA 20");
  else flags.push("EMA 9 below EMA 20");
  if(rsiValue>70)flags.push("RSI elevated");
  if(rsiValue<40)flags.push("Momentum weak");

  const entryLow=ema9Value-.25*atrValue;
  const entryHigh=ema9Value+.25*atrValue;
  const stop=Math.min(support20-.10*atrValue,entryLow-1.20*atrValue);
  const riskDistance=entryHigh-stop;
  const plan=riskDistance>0&&trend>=45?{
    entryLow:round(entryLow),
    entryHigh:round(entryHigh),
    stop:round(stop),
    target1:round(entryHigh+riskDistance),
    target2:round(entryHigh+riskDistance*2),
    target3:round(entryHigh+riskDistance*3),
  }:null;

  const explanation=[
    `Trend score ${round(trend,0)}/100 from close vs EMA 9, EMA 9 vs EMA 20, and EMA 20 slope.`,
    `Momentum score ${round(momentum,0)}/100 from RSI(14) at ${round(rsiValue,1)}.`,
    `Volume score ${round(volume,0)}/100 from ${volumeLag>0?"the last completed non-zero bar":"the latest bar"} at ${round(relativeVolume,2)}× the prior completed-bar average.`,
    `Setup score ${round(setup,0)}/100 from distance to EMA 9 and whether price is above EMA 20.`,
    `Risk score ${round(risk,0)}/100 from ATR(14) equal to ${round(atrPercent,2)}% of price.`,
  ];

  return {
    available:true,
    version:"technical-v0.1",
    state,
    score,
    componentScores:{trend:round(trend,0),momentum:round(momentum,0),volume:round(volume,0),setup:round(setup,0),risk:round(risk,0)},
    metrics:{
      close:round(last.close),
      ema9:round(ema9Value),
      ema20:round(ema20Value),
      rsi14:round(rsiValue,1),
      atr14:round(atrValue),
      atrPercent:round(atrPercent,2),
      relativeVolume:round(relativeVolume,2),
      support20:round(support20),
      resistance20:round(resistance20),
      extensionAtr:round(extensionAtr,2),
    },
    plan,
    flags,
    explanation,
  };
}

