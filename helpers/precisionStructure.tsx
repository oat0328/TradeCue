import type {WebullBar} from "./webullBars";
import {calculateMarketStructure} from "./marketStructure";

export type PrecisionSetupType="CONTINUATION"|"REVERSAL"|"NONE";
export type PrecisionStage=
  "INSUFFICIENT_DATA"|
  "BEARISH_CONTEXT"|
  "WAIT_STRUCTURE"|
  "WAIT_PULLBACK"|
  "WAIT_CONFIRMATION"|
  "ENTRY_READY"|
  "TARGET_UNREALISTIC";

export type PrecisionTradePlan={
  entryLow:number;
  entryHigh:number;
  stop:number;
  target1:number;
  target2:number;
  target3:number;
};

export type PrecisionStructureSignal={
  available:true;
  version:"precision-structure-v0.1";
  state:"BUY"|"WAIT"|"AVOID";
  setupType:PrecisionSetupType;
  stage:PrecisionStage;
  direction:"LONG"|"BEARISH_STUDY";
  score:number;
  plan:PrecisionTradePlan|null;
  watchPlan:PrecisionTradePlan|null;
  metrics:{
    trend:"BULLISH"|"BEARISH"|"RANGE";
    pattern:string;
    bosUp:boolean;
    bosDown:boolean;
    sweepLow:boolean;
    sweepHigh:boolean;
    momentumShift:boolean;
    confirmation:boolean;
    volumeIncreasing:boolean;
    atr14:number;
    fib618:number|null;
    fib786:number|null;
    mitigationLow:number|null;
    mitigationHigh:number|null;
    bosPrice:number|null;
    swingLow:number|null;
    swingHigh:number|null;
    currentPrice:number;
    rewardRisk2:number|null;
  };
  flags:string[];
  explanation:string[];
};

export type PrecisionStructureUnavailable={available:false;reason:string};

type Pivot={index:number;price:number;kind:"high"|"low"};

function round(value:number,decimals=2){
  const p=10**decimals;
  return Math.round(value*p)/p;
}
function clamp(value:number,min=0,max=100){return Math.max(min,Math.min(max,value));}

function pivots(bars:WebullBar[]):Pivot[]{
  const out:Pivot[]=[];
  for(let i=2;i<bars.length-2;i++){
    const b=bars[i];
    if(b.high>bars[i-1].high&&b.high>=bars[i-2].high&&b.high>=bars[i+1].high&&b.high>bars[i+2].high){
      out.push({index:i,price:b.high,kind:"high"});
    }
    if(b.low<bars[i-1].low&&b.low<=bars[i-2].low&&b.low<=bars[i+1].low&&b.low<bars[i+2].low){
      out.push({index:i,price:b.low,kind:"low"});
    }
  }
  return out.sort((a,b)=>a.index-b.index);
}

function atr(bars:WebullBar[],period=14){
  if(bars.length<=period)return null;
  const tr:number[]=[];
  for(let i=1;i<bars.length;i++){
    tr.push(Math.max(
      bars[i].high-bars[i].low,
      Math.abs(bars[i].high-bars[i-1].close),
      Math.abs(bars[i].low-bars[i-1].close),
    ));
  }
  let value=tr.slice(0,period).reduce((a,b)=>a+b,0)/period;
  for(let i=period;i<tr.length;i++)value=(value*(period-1)+tr[i])/period;
  return value;
}

export function calculatePrecisionStructureSignal(
  input:WebullBar[],
):PrecisionStructureSignal|PrecisionStructureUnavailable{
  const bars=input
    .filter(b=>[b.open,b.high,b.low,b.close,b.volume].every(Number.isFinite))
    .slice(-240);
  if(bars.length<40)return {available:false,reason:"At least 40 valid candles are required for Precision Structure."};

  const completed=bars.slice(0,-1);
  const last=bars.at(-1)!;
  const confirm=completed.at(-1)!;
  const before=completed.at(-2)!;
  const structure=calculateMarketStructure(completed);
  const swingPoints=pivots(completed);
  const highs=swingPoints.filter(p=>p.kind==="high");
  const lows=swingPoints.filter(p=>p.kind==="low");
  const atrValue=atr(completed,14);
  if(atrValue==null||atrValue<=0)return {available:false,reason:"ATR could not be calculated from the loaded candles."};

  const latestHigh=highs.at(-1)??null;
  const latestLow=lows.at(-1)??null;
  const previousHigh=highs.at(-2)??null;

  const recentEvents=structure.events;
  const bosUpEvent=[...recentEvents].reverse().find(e=>e.kind==="BOS_UP")??null;
  const bosDownEvent=[...recentEvents].reverse().find(e=>e.kind==="BOS_DOWN")??null;
  const sweepLowEvent=[...recentEvents].reverse().find(e=>e.kind==="SWEEP_LOW")??null;
  const sweepHighEvent=[...recentEvents].reverse().find(e=>e.kind==="SWEEP_HIGH")??null;
  const eventFloor=Math.max(0,completed.length-28);
  const bosUp=Boolean(bosUpEvent&&bosUpEvent.index>=eventFloor);
  const bosDown=Boolean(bosDownEvent&&bosDownEvent.index>=eventFloor);
  const sweepLow=Boolean(sweepLowEvent&&sweepLowEvent.index>=eventFloor);
  const sweepHigh=Boolean(sweepHighEvent&&sweepHighEvent.index>=eventFloor);

  const reversalShift=Boolean(
    sweepLowEvent&&bosUpEvent&&
    bosUpEvent.index>sweepLowEvent.index&&
    bosUpEvent.index-sweepLowEvent.index<=28
  );
  const continuation=Boolean(structure.trend==="BULLISH"&&latestHigh&&latestLow&&latestLow.index<latestHigh.index);
  const reversal=Boolean(reversalShift&&latestLow&&latestHigh);

  const setupType:PrecisionSetupType=reversal?"REVERSAL":continuation?"CONTINUATION":"NONE";

  let legLow:Pivot|null=null;
  let legHigh:Pivot|null=null;
  if(latestHigh){
    legLow=[...lows].reverse().find(p=>p.index<latestHigh.index)??null;
    legHigh=latestHigh;
  }
  if(reversal&&bosUpEvent){
    const priorSweepLow=lows.filter(p=>p.index<=bosUpEvent.index).at(-1);
    const postLowHigh=highs.filter(p=>p.index>=(priorSweepLow?.index??0)).at(-1);
    if(priorSweepLow&&postLowHigh&&postLowHigh.index>priorSweepLow.index){
      legLow=priorSweepLow;
      legHigh=postLowHigh;
    }
  }

  const validLeg=Boolean(legLow&&legHigh&&legHigh.index>legLow.index&&legHigh.price>legLow.price);
  const legRange=validLeg?(legHigh!.price-legLow!.price):0;
  const fib618=validLeg?legHigh!.price-legRange*.618:null;
  const fib786=validLeg?legHigh!.price-legRange*.786:null;
  const mitigationLow=fib786==null?null:Math.min(fib618!,fib786);
  const mitigationHigh=fib618==null?null:Math.max(fib618,fib786!);

  const recentWindow=completed.slice(-8);
  const touchedMitigation=mitigationLow!=null&&mitigationHigh!=null&&recentWindow.some(
    b=>b.low<=mitigationHigh&&b.high>=mitigationLow
  );
  const confirmation=Boolean(
    confirm.close>confirm.open&&
    confirm.close>before.close&&
    (mitigationLow==null||confirm.close>=mitigationLow)
  );
  const priorVolumes=completed.slice(-7,-1).map(b=>b.volume).filter(v=>v>0);
  const avgVolume=priorVolumes.length?priorVolumes.reduce((a,b)=>a+b,0)/priorVolumes.length:0;
  const volumeIncreasing=avgVolume>0&&confirm.volume>=avgVolume;

  const entryLow=confirm.close;
  const entryHigh=confirm.high+.05*atrValue;
  const invalidationBase=legLow?.price??latestLow?.price??Math.min(...recentWindow.map(b=>b.low));
  const stop=invalidationBase-.10*atrValue;
  const riskDistance=entryHigh-stop;
  const target1=entryHigh+riskDistance;
  const target2=entryHigh+riskDistance*2;
  const target3=entryHigh+riskDistance*3;
  const rewardRisk2=riskDistance>0?2:null;
  const targetRealistic=riskDistance>0&&riskDistance/atrValue<=2.5;

  let stage:PrecisionStage;
  if(structure.trend==="BEARISH"&&!reversal)stage="BEARISH_CONTEXT";
  else if(setupType==="NONE"||!validLeg)stage="WAIT_STRUCTURE";
  else if(!touchedMitigation)stage="WAIT_PULLBACK";
  else if(!confirmation)stage="WAIT_CONFIRMATION";
  else if(!targetRealistic)stage="TARGET_UNREALISTIC";
  else stage="ENTRY_READY";

  const watchPlan:PrecisionTradePlan|null=
    validLeg&&
    mitigationLow!=null&&
    mitigationHigh!=null&&
    touchedMitigation&&
    riskDistance>0
      ?{
        entryLow:round(entryLow),
        entryHigh:round(entryHigh),
        stop:round(stop),
        target1:round(target1),
        target2:round(target2),
        target3:round(target3),
      }
      :null;
  const plan=stage==="ENTRY_READY"?watchPlan:null;

  const structureScore=structure.trend==="BULLISH"?35:reversal?30:structure.trend==="RANGE"?15:5;
  const bosScore=reversalShift?20:bosUp?14:0;
  const zoneScore=touchedMitigation?20:validLeg?10:0;
  const confirmationScore=confirmation?15:0;
  const volumeScore=volumeIncreasing?10:4;
  const score=round(clamp(structureScore+bosScore+zoneScore+confirmationScore+volumeScore),0);

  const direction:"LONG"|"BEARISH_STUDY"=
    structure.trend==="BEARISH"&&!reversal?"BEARISH_STUDY":"LONG";
  const state:"BUY"|"WAIT"|"AVOID"=
    stage==="ENTRY_READY"?"BUY":
    stage==="BEARISH_CONTEXT"||stage==="TARGET_UNREALISTIC"?"AVOID":"WAIT";

  const bosPrice=bosUpEvent?.price??previousHigh?.price??null;
  const flags:string[]=[];
  flags.push(structure.trend==="BULLISH"?"Higher-high / higher-low structure present":structure.trend==="BEARISH"?"Lower-high / lower-low structure present":"Structure is mixed / range");
  if(reversalShift)flags.push("Momentum shift: low-side sweep followed by bullish break of structure");
  else if(bosUp)flags.push("Recent bullish break of structure detected");
  if(touchedMitigation)flags.push("Price revisited the 61.8%–78.6% retracement / mitigation zone");
  else if(validLeg)flags.push("Waiting for price to revisit the preferred retracement zone");
  flags.push(confirmation?"Bullish confirmation candle completed":"Waiting for bullish confirmation candle");
  flags.push(volumeIncreasing?"Confirmation volume expanded":"Volume has not expanded versus recent completed candles");
  if(!targetRealistic&&riskDistance>0)flags.push("Risk distance is too large relative to current ATR");

  const explanation=[
    setupType==="REVERSAL"
      ?"Reversal candidate: a downside liquidity sweep was followed by a bullish break of structure."
      :setupType==="CONTINUATION"
        ?"Continuation candidate: bullish higher-high / higher-low structure is intact."
        :"No qualifying continuation or reversal structure is complete yet.",
    validLeg&&fib618!=null&&fib786!=null
      ?"Preferred mitigation zone is "+round(mitigationLow!)+"–"+round(mitigationHigh!)+" using the latest confirmed impulse leg."
      :"A clean impulse leg is not available for a retracement zone yet.",
    touchedMitigation
      ?"Price has traded back through the mitigation zone."
      :"Do not chase; wait for the retracement / mitigation area.",
    confirmation
      ?"The latest completed candle confirms upward momentum."
      :"Wait for a completed bullish confirmation candle after mitigation.",
    watchPlan
      ?"Chart plan: trigger "+round(watchPlan.entryHigh)+", stop "+round(watchPlan.stop)+", TP1 "+round(watchPlan.target1)+", TP2 "+round(watchPlan.target2)+", TP3 "+round(watchPlan.target3)+"."
      :"Exact entry, stop and targets stay hidden until a valid mitigation geometry exists.",
  ];

  return {
    available:true,
    version:"precision-structure-v0.1",
    state,
    setupType,
    stage,
    direction,
    score,
    plan,
    watchPlan,
    metrics:{
      trend:structure.trend,
      pattern:structure.pattern,
      bosUp,
      bosDown,
      sweepLow,
      sweepHigh,
      momentumShift:reversalShift,
      confirmation,
      volumeIncreasing,
      atr14:round(atrValue),
      fib618:fib618==null?null:round(fib618),
      fib786:fib786==null?null:round(fib786),
      mitigationLow:mitigationLow==null?null:round(mitigationLow),
      mitigationHigh:mitigationHigh==null?null:round(mitigationHigh),
      bosPrice:bosPrice==null?null:round(bosPrice),
      swingLow:legLow==null?null:round(legLow.price),
      swingHigh:legHigh==null?null:round(legHigh.price),
      currentPrice:round(last.close),
      rewardRisk2,
    },
    flags,
    explanation,
  };
}
  291