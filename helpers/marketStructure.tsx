import type { Candle } from "./chartMath";

export type SmartLevel={price:number;strength:number;touches:number;kind:"support"|"resistance"};
export type StructureEvent={index:number;price:number;kind:"BOS_UP"|"BOS_DOWN"|"SWEEP_HIGH"|"SWEEP_LOW"|"FVG_BULL"|"FVG_BEAR"};
export type MarketStructureRead={
  trend:"BULLISH"|"BEARISH"|"RANGE";
  pattern:string;
  support:SmartLevel|null;
  resistance:SmartLevel|null;
  events:StructureEvent[];
  latestEvent:StructureEvent|null;
  summary:string;
};

function round(value:number,decimals=2){const p=10**decimals;return Math.round(value*p)/p;}

export function calculateMarketStructure(input:Candle[]):MarketStructureRead{
  const bars=input.filter(bar=>[bar.open,bar.high,bar.low,bar.close].every(Number.isFinite)).slice(-240);
  if(bars.length<8)return {trend:"RANGE",pattern:"INSUFFICIENT DATA",support:null,resistance:null,events:[],latestEvent:null,summary:"More candles are required for structure analysis."};
  const last=bars[bars.length-1];
  const highs:{index:number;price:number}[]=[];
  const lows:{index:number;price:number}[]=[];
  for(let i=2;i<bars.length-2;i++){
    if(bars[i].high>bars[i-1].high&&bars[i].high>=bars[i-2].high&&bars[i].high>=bars[i+1].high&&bars[i].high>bars[i+2].high)highs.push({index:i,price:bars[i].high});
    if(bars[i].low<bars[i-1].low&&bars[i].low<=bars[i-2].low&&bars[i].low<=bars[i+1].low&&bars[i].low<bars[i+2].low)lows.push({index:i,price:bars[i].low});
  }
  const recentHighs=highs.slice(-3),recentLows=lows.slice(-3);
  const hh=recentHighs.length>=2&&recentHighs.at(-1)!.price>recentHighs.at(-2)!.price;
  const lh=recentHighs.length>=2&&recentHighs.at(-1)!.price<recentHighs.at(-2)!.price;
  const hl=recentLows.length>=2&&recentLows.at(-1)!.price>recentLows.at(-2)!.price;
  const ll=recentLows.length>=2&&recentLows.at(-1)!.price<recentLows.at(-2)!.price;
  const trend=hh&&hl?"BULLISH":lh&&ll?"BEARISH":"RANGE";
  const pattern=trend==="BULLISH"?"HH + HL":trend==="BEARISH"?"LH + LL":hh?"HH / MIXED":ll?"LL / MIXED":"CONSOLIDATION";

  const fullRange=Math.max(...bars.map(b=>b.high))-Math.min(...bars.map(b=>b.low));
  const tolerance=Math.max(last.close*.0015,fullRange*.018,0.01);
  const level=(kind:"support"|"resistance"):SmartLevel|null=>{
    const candidates=(kind==="support"?lows:highs).filter(p=>kind==="support"?p.price<=last.close:p.price>=last.close);
    if(!candidates.length)return null;
    const sorted=[...candidates].sort((a,b)=>Math.abs(a.price-last.close)-Math.abs(b.price-last.close));
    const base=sorted[0].price;
    const touches=(kind==="support"?lows:highs).filter(p=>Math.abs(p.price-base)<=tolerance).length;
    const recency=sorted[0].index/bars.length;
    const distance=Math.abs(last.close-base)/Math.max(last.close,.01);
    const strength=Math.max(20,Math.min(99,Math.round(38+touches*14+recency*18-Math.min(18,distance*300))));
    return {price:round(base),strength,touches,kind};
  };
  const support=level("support"),resistance=level("resistance");

  const events:StructureEvent[]=[];
  let lastHighPivot:{index:number;price:number}|null=null,lastLowPivot:{index:number;price:number}|null=null;
  for(let i=2;i<bars.length;i++){
    const priorHigh=[...highs].reverse().find(p=>p.index+2<i);
    const priorLow=[...lows].reverse().find(p=>p.index+2<i);
    if(priorHigh&&(!lastHighPivot||priorHigh.index!==lastHighPivot.index)){
      lastHighPivot=priorHigh;
    }
    if(priorLow&&(!lastLowPivot||priorLow.index!==lastLowPivot.index)){
      lastLowPivot=priorLow;
    }
    const bar=bars[i];
    if(priorHigh&&bar.high>priorHigh.price&&bar.close<priorHigh.price)events.push({index:i,price:bar.high,kind:"SWEEP_HIGH"});
    else if(priorHigh&&bars[i-1].close<=priorHigh.price&&bar.close>priorHigh.price)events.push({index:i,price:bar.close,kind:"BOS_UP"});
    if(priorLow&&bar.low<priorLow.price&&bar.close>priorLow.price)events.push({index:i,price:bar.low,kind:"SWEEP_LOW"});
    else if(priorLow&&bars[i-1].close>=priorLow.price&&bar.close<priorLow.price)events.push({index:i,price:bar.close,kind:"BOS_DOWN"});
    if(i>=2&&bar.low>bars[i-2].high)events.push({index:i,price:(bar.low+bars[i-2].high)/2,kind:"FVG_BULL"});
    if(i>=2&&bar.high<bars[i-2].low)events.push({index:i,price:(bar.high+bars[i-2].low)/2,kind:"FVG_BEAR"});
  }
  const deduped=events.filter((event,index,array)=>index===0||event.kind!==array[index-1].kind||event.index!==array[index-1].index).slice(-14);
  const latestEvent=deduped.at(-1)??null;
  const eventLabel=latestEvent?latestEvent.kind.replaceAll("_"," "):"no recent structural trigger";
  return {
    trend,pattern,support,resistance,events:deduped,latestEvent,
    summary:`${trend} · ${pattern} · ${eventLabel}`,
  };
}