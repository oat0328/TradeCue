export type Candle={
  time?:string;
  open:number;
  high:number;
  low:number;
  close:number;
  volume?:number;
};

export function heikinAshi(input:Candle[]):Candle[]{
  const out:Candle[]=[];
  input.forEach((candle,index)=>{
    const close=(candle.open+candle.high+candle.low+candle.close)/4;
    const open=index
      ? (out[index-1].open+out[index-1].close)/2
      : (candle.open+candle.close)/2;
    out.push({
      ...candle,
      open,
      close,
      high:Math.max(candle.high,open,close),
      low:Math.min(candle.low,open,close),
    });
  });
  return out;
}

export function visibleVwap(input:Candle[]){
  let total=0;
  let weighted=0;
  for(const candle of input){
    const volume=Math.max(0,candle.volume||0);
    total+=volume;
    weighted+=(candle.high+candle.low+candle.close)/3*volume;
  }
  return total?weighted/total:null;
}

export function easternMinute(time?:string){
  if(!time||!Number.isFinite(Date.parse(time)))return null;
  const parts=new Intl.DateTimeFormat("en-US",{
    timeZone:"America/New_York",
    hour:"2-digit",
    minute:"2-digit",
    hourCycle:"h23",
  }).formatToParts(new Date(time));
  return Number(parts.find(part=>part.type==="hour")?.value)*60+
    Number(parts.find(part=>part.type==="minute")?.value);
}

export const chartZones=[
  {key:"asia",label:"Asia",start:1140,end:1320,time:"7–10 PM ET"},
  {key:"london",label:"London",start:120,end:300,time:"2–5 AM ET"},
  {key:"nyam",label:"New York AM",start:420,end:600,time:"7–10 AM ET"},
  {key:"londonclose",label:"London Close",start:600,end:720,time:"10 AM–12 PM ET"},
  {key:"nypm",label:"New York PM",start:810,end:960,time:"1:30–4 PM ET"},
];

export function smaSeries(values:number[],period:number):(number|null)[]{
  const output:(number|null)[]=Array(values.length).fill(null);
  if(period<=0)return output;
  let sum=0;
  for(let index=0;index<values.length;index++){
    sum+=values[index];
    if(index>=period)sum-=values[index-period];
    if(index>=period-1)output[index]=sum/period;
  }
  return output;
}

export function emaSeries(values:number[],period:number):(number|null)[]{
  const output:(number|null)[]=Array(values.length).fill(null);
  if(period<=0||values.length<period)return output;
  const seed=values.slice(0,period).reduce((sum,value)=>sum+value,0)/period;
  output[period-1]=seed;
  const multiplier=2/(period+1);
  let current=seed;
  for(let index=period;index<values.length;index++){
    current=values[index]*multiplier+current*(1-multiplier);
    output[index]=current;
  }
  return output;
}

export function rsiSeries(values:number[],period=14):(number|null)[]{
  const output:(number|null)[]=Array(values.length).fill(null);
  if(values.length<=period)return output;
  let gains=0;
  let losses=0;
  for(let index=1;index<=period;index++){
    const diff=values[index]-values[index-1];
    gains+=Math.max(diff,0);
    losses+=Math.max(-diff,0);
  }
  let avgGain=gains/period;
  let avgLoss=losses/period;
  const toRsi=()=>avgLoss===0?100:100-100/(1+avgGain/avgLoss);
  output[period]=toRsi();
  for(let index=period+1;index<values.length;index++){
    const diff=values[index]-values[index-1];
    avgGain=(avgGain*(period-1)+Math.max(diff,0))/period;
    avgLoss=(avgLoss*(period-1)+Math.max(-diff,0))/period;
    output[index]=toRsi();
  }
  return output;
}

export function atrSeries(input:Candle[],period=14):(number|null)[]{
  const output:(number|null)[]=Array(input.length).fill(null);
  if(input.length<=period)return output;
  const trueRanges:number[]=[];
  for(let index=1;index<input.length;index++){
    const candle=input[index];
    const previous=input[index-1];
    trueRanges.push(Math.max(
      candle.high-candle.low,
      Math.abs(candle.high-previous.close),
      Math.abs(candle.low-previous.close),
    ));
  }
  let current=trueRanges.slice(0,period).reduce((sum,value)=>sum+value,0)/period;
  output[period]=current;
  for(let index=period;index<trueRanges.length;index++){
    current=(current*(period-1)+trueRanges[index])/period;
    output[index+1]=current;
  }
  return output;
}

export function bollingerSeries(values:number[],period=20,multiplier=2){
  const middle=smaSeries(values,period);
  const upper:(number|null)[]=Array(values.length).fill(null);
  const lower:(number|null)[]=Array(values.length).fill(null);
  for(let index=period-1;index<values.length;index++){
    const window=values.slice(index-period+1,index+1);
    const mean=middle[index]!;
    const variance=window.reduce((sum,value)=>sum+(value-mean)**2,0)/period;
    const deviation=Math.sqrt(variance);
    upper[index]=mean+deviation*multiplier;
    lower[index]=mean-deviation*multiplier;
  }
  return {middle,upper,lower};
}

export function macdSeries(values:number[],fast=12,slow=26,signalPeriod=9){
  const fastEma=emaSeries(values,fast);
  const slowEma=emaSeries(values,slow);
  const line:(number|null)[]=values.map((_,index)=>{
    const fastValue=fastEma[index];
    const slowValue=slowEma[index];
    return fastValue!=null&&slowValue!=null?fastValue-slowValue:null;
  });

  const firstValid=line.findIndex(value=>value!=null);
  const compact=firstValid>=0?line.slice(firstValid).map(value=>value??0):[];
  const compactSignal=emaSeries(compact,signalPeriod);
  const signal:(number|null)[]=Array(values.length).fill(null);
  if(firstValid>=0){
    compactSignal.forEach((value,index)=>{
      signal[firstValid+index]=value;
    });
  }
  const histogram=line.map((value,index)=>{
    const signalValue=signal[index];
    return value!=null&&signalValue!=null?value-signalValue:null;
  });
  return {line,signal,histogram};
}

