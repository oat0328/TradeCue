export function omegaDataAgreement(input:{quotePrice:number|null;barPrice:number|null;barTimes:string[];now?:number}){
  const now=input.now??Date.now(),times=input.barTimes.map(time=>Date.parse(time)),blockers:string[]=[];
  if(!times.length||times.some(time=>!Number.isFinite(time)))blockers.push("Candle timestamps are unavailable.");
  else{
    if(times.some(time=>time>now+60000))blockers.push("Candle timestamp is more than one minute in the future.");
    if(times.some((time,index)=>index>0&&time<=times[index-1]))blockers.push("Candle timestamps conflict or repeat.");
    if(now-times[times.length-1]>20*60000)blockers.push("Latest 5-minute candle is older than 20 minutes.");
  }
  const quote=input.quotePrice,bar=input.barPrice;
  if(quote==null||bar==null||![quote,bar].every(n=>Number.isFinite(n)&&n>0))blockers.push("Current snapshot price or candle close is unavailable.");
  const differencePercent=quote!=null&&bar!=null&&quote>0&&bar>0?Math.abs(quote-bar)/bar*100:null;
  if(differencePercent!=null&&differencePercent>1)blockers.push("Snapshot price and latest candle close differ by more than 1%; wait for agreement.");
  return {state:blockers.length?"BLOCKED" as const:"AGREED" as const,differencePercent,blockers};
}