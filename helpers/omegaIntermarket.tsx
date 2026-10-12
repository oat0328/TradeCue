import type {WebullBar} from "./webullBars";

/** Contemporaneous cross-market context, not causality, leading indicator or a trade signal. */
export type MarketRelationship={
  peer:string;matchedReturns:number;correlation:number|null;
  peerChangePercent:number|null;subjectChangePercent:number|null;
  context:"MOVING_TOGETHER"|"DIVERGING"|"UNDETERMINED";
};
export function omegaIntermarketContext(
  subject:WebullBar[],peers:ReadonlyArray<{symbol:string;bars:WebullBar[]}>,
):MarketRelationship[]{
  const returns=(rows:WebullBar[])=>{
    const output=new Map<string,number>();
    const ordered=rows.slice().sort((a,b)=>Date.parse(a.time)-Date.parse(b.time));
    for(let i=1;i<ordered.length;i++){
      const old=ordered[i-1],now=ordered[i];
      if(old.close<=0||now.close<=0||!Number.isFinite(old.close)||!Number.isFinite(now.close))continue;
      if(!Number.isFinite(Date.parse(old.time))||!Number.isFinite(Date.parse(now.time)))continue;
      // Only directly adjacent 5-minute bars. Do not bridge overnight/weekend gaps.
      if(Date.parse(now.time)-Date.parse(old.time)!==300_000)continue;
      output.set(now.time,Math.log(now.close/old.close));
    }
    return output;
  };
  const base=returns(subject);
  return peers.map(({symbol,bars})=>{
    const other=returns(bars);
    const xs:number[]=[],ys:number[]=[];
    for(const [key,value] of base){if(other.has(key)){xs.push(value);ys.push(other.get(key)!);}}
    const n=xs.length;
    let correlation:number|null=null;
    if(n>=30){
      const ax=xs.reduce((a,b)=>a+b,0)/n,ay=ys.reduce((a,b)=>a+b,0)/n;
      const dx=xs.map(x=>x-ax),dy=ys.map(y=>y-ay);
      const cross=dx.reduce((a,x,i)=>a+x*dy[i],0);
      const den=Math.sqrt(dx.reduce((a,x)=>a+x*x,0)*dy.reduce((a,y)=>a+y*y,0));
      if(den>0)correlation=Math.max(-1,Math.min(1,cross/den));
    }
    const subjectChange=xs.length?100*(Math.exp(xs.slice(-12).reduce((a,b)=>a+b,0))-1):null;
    const peerChange=ys.length?100*(Math.exp(ys.slice(-12).reduce((a,b)=>a+b,0))-1):null;
    return {peer:symbol,matchedReturns:n,correlation,
      peerChangePercent:peerChange,subjectChangePercent:subjectChange,
      context:correlation==null?"UNDETERMINED":correlation>.5?"MOVING_TOGETHER":correlation<-.4?"DIVERGING":"UNDETERMINED"} as MarketRelationship;
  });
}
