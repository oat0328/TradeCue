import type {Candle} from "./chartMath";
export function cleanChartBars(bars:Candle[]):Candle[]{
 const map=new Map<number,Candle>();
 for(const b of bars){const t=Date.parse(b.time??"");if(!Number.isFinite(t)||![b.open,b.high,b.low,b.close].every(n=>Number.isFinite(n)&&n>0)||b.high<Math.max(b.open,b.close,b.low)||b.low>Math.min(b.open,b.close))continue;map.set(Math.floor(t/1000),{...b,time:new Date(Math.floor(t/1000)*1000).toISOString(),volume:Number.isFinite((b.volume??0))&&(b.volume??0)>=0?(b.volume??0):0});}
 return [...map.entries()].sort((a,b)=>a[0]-b[0]).map(([,b])=>b).slice(-10000);
}
const day=new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"});
export function loadedDayVwap(bars:Candle[]){
 let key="",value=0,volume=0;
 return bars.flatMap(b=>{const k=day.format(new Date(b.time!));if(k!==key){key=k;value=0;volume=0;}value+=(b.high+b.low+b.close)/3*(b.volume??0);volume+=(b.volume??0);return volume>0?[{time:b.time!,value:value/volume}]:[];});
}
export function tradedVolumeProfile(bars:Candle[],bins=20){
 const valid=bars.filter(b=>Number.isFinite((b.volume??0))&&(b.volume??0)>0);
 if(!valid.length)return [];
 const low=Math.min(...valid.map(b=>b.low)),high=Math.max(...valid.map(b=>b.high));
 const width=Math.max(high-low,.01)/bins;
 const bucket=Array.from({length:bins},(_,i)=>({price:low+(i+.5)*width,volume:0}));
 for(const b of valid){const typical=(b.high+b.low+b.close)/3;const i=Math.max(0,Math.min(bins-1,Math.floor((typical-low)/width)));bucket[i].volume+=(b.volume??0);}
 const total=valid.reduce((s,b)=>s+(b.volume??0),0);
 return bucket.filter(b=>(b.volume??0)>0).map(b=>({...b,share:(b.volume??0)/total})).sort((a,b)=>(b.volume??0)-a.volume);
}
