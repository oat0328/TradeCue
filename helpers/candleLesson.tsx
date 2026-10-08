import type { Candle } from "./chartMath";
import { calculateCueSignal,classifyCandlePressure } from "./cueSignal";

export function candleStory(bars:Candle[],index:number){
  const bar=bars[index];
  if(!bar||![bar.open,bar.high,bar.low,bar.close].every(Number.isFinite)||bar.high<Math.max(bar.open,bar.close)||bar.low>Math.min(bar.open,bar.close))return null;
  const previous=bars[index-1],history=bars.slice(Math.max(0,index-20),index);
  const range=bar.high-bar.low,body=Math.abs(bar.close-bar.open);
  const lower=Math.min(bar.open,bar.close)-bar.low,upper=bar.high-Math.max(bar.open,bar.close);
  const pressure=classifyCandlePressure(bar);
  const observations:string[]=[];
  observations.push(bar.close>bar.open?"Price ended this interval above its open.":bar.close<bar.open?"Price ended this interval below its open.":"Open and close are equal; there was no net body move.");
  if(previous)observations.push("Compared with the previous close, price "+(bar.close>=previous.close?"rose":"fell")+" "+Math.abs(bar.close-previous.close).toFixed(4)+".");
  if(range===0)observations.push("This is a flat bar. It provides no directional range evidence.");
  else{
    if(pressure.strongBuyerControl)observations.push("Strong buyer-control candle: a large green body with little or no lower wick. For Omega longs, this is bullish confirmation when the broader setup agrees.");
    if(pressure.strongSellerControl)observations.push("Strong seller-control candle: a large red body with little or no upper wick. For Omega longs, this is a falling-knife warning and blocks a fresh entry.");
    if(pressure.indecisionWarning)observations.push("Warning candle: a small body with wicks on both sides. Direction is undecided, so Omega waits for another completed confirmation candle.");
    if(lower/range>=.35)observations.push("Price traded down to "+bar.low.toFixed(4)+" and recovered "+(bar.close-bar.low).toFixed(4)+" before this snapshot. The lower wick shows that recovery; it does not identify who traded.");
    if(upper/range>=.35)observations.push("Price reached "+bar.high.toFixed(4)+" but ended below that high. The upper wick shows a retracement, not proof of a deliberate trap.");
    if(body/range<=.2)observations.push("The body is small relative to the range: price moved both ways without a strong net close.");
  }
  const volumes=history.map(b=>b.volume).filter((v):v is number=>typeof v==="number"&&Number.isFinite(v)&&v>0);
  const avg=volumes.length?volumes.reduce((a,b)=>a+b,0)/volumes.length:null;
  if(avg&&typeof bar.volume==="number")observations.push("Volume is "+(bar.volume/avg).toFixed(2)+"× the preceding available-bar average. This measures activity, not buyer identity.");
  let pattern="No sweep/reclaim pattern is established from the preceding 20 bars.";
  if(history.length>=5){
    const priorLow=Math.min(...history.map(b=>b.low)),priorHigh=Math.max(...history.map(b=>b.high));
    if(bar.low<priorLow&&bar.close>priorLow)pattern="Price pierced the prior 20-bar low and reclaimed it. This resembles a low sweep/reclaim; stops may trade near visible lows, but the candles cannot prove stop hunting.";
    else if(bar.high>priorHigh&&bar.close<priorHigh)pattern="Price pierced the prior 20-bar high and closed back below it. This resembles a failed breakout; do not assume every break holds.";
  }
  return {observations,pattern};
}
export type StudyResult={state:"NO_SETUP"|"WAITING"|"NO_FILL"|"OPEN"|"TARGET"|"STOP"|"AMBIGUOUS";reason:string;entry?:number;stop?:number;target?:number;pnlPerShare?:number;exitIndex?:number};
export function studyPricePath(bars:Candle[],index:number,plan:{entryLow:number;entryHigh:number;stop:number;target1:number}):StudyResult{
  const {entryLow,entryHigh,stop,target1:target}=plan;
  if(![entryLow,entryHigh,stop,target].every(Number.isFinite)||entryLow>entryHigh||stop>=entryLow||target<=entryHigh)return {state:"NO_SETUP",reason:"The historical stop/entry/target plan is invalid."};
  const next=bars[index+1];
  if(!next)return {state:"WAITING",reason:"No later candle is loaded. The outcome is unknown."};
  // Fixed next-open entry assumption; never cherry-pick a later low for a perfect fill.
  const entry=next.open;
  if(entry<entryLow||entry>entryHigh)return {state:"NO_FILL",reason:"The next loaded bar opened outside the pre-existing entry zone. This study does not assume a fill or chase the move."};
  const base={entry,stop,target};
  for(let i=index+1;i<bars.length;i++){
    const b=bars[i];
    if(b.open<=stop)return {...base,state:"STOP",reason:"A bar opened at/below the stop; the study uses that open rather than an unrealistically perfect stop fill.",pnlPerShare:b.open-entry,exitIndex:i};
    const hitStop=b.low<=stop,hitTarget=b.high>=target;
    if(hitStop&&hitTarget)return {...base,state:"AMBIGUOUS",reason:"Both stop and target were touched in one candle. OHLC does not reveal which came first, so this is not counted as a win.",exitIndex:i};
    if(hitStop)return {...base,state:"STOP",reason:"The stop was touched before a later target touch.",pnlPerShare:stop-entry,exitIndex:i};
    if(hitTarget)return {...base,state:"TARGET",reason:"The target was touched without a prior stop touch under this study's assumptions.",pnlPerShare:target-entry,exitIndex:i};
  }
  return {...base,state:"OPEN",reason:"Neither stop nor target has been resolved in the loaded later bars."};
}
export function historicalCandleLesson(bars:Candle[],index:number){
  const prefix=bars.slice(0,index+1).map(b=>({...b,time:b.time??"",volume:b.volume??0}));
  const signal=calculateCueSignal(prefix);
  const study:StudyResult=!signal.available?{state:"NO_SETUP",reason:signal.reason}:signal.state!=="BUY"||!signal.plan?{state:"NO_SETUP",reason:"The technical rules at this candle did not produce a BUY plan. A later rally does not retroactively make that a qualified entry."}:studyPricePath(bars,index,signal.plan);
  return {story:candleStory(bars,index),signal,study};
}
