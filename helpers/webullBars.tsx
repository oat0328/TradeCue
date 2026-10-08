export type WebullBar={time:string;open:number;high:number;low:number;close:number;volume:number};

function nestedRows(value:any):any[]{
  if(Array.isArray(value)){
    if(value.length&&Array.isArray(value[0]?.result))return value[0].result;
    return value;
  }
  if(value?.result)return nestedRows(value.result);
  if(value?.data)return nestedRows(value.data);
  return [];
}

export function webullBars(raw:unknown,minutes=0):WebullBar[] {
 const bars=nestedRows(raw)
   .map(row=>({
     time:String(row.time??row.timestamp??""),
     open:Number(row.open),
     high:Number(row.high),
     low:Number(row.low),
     close:Number(row.close),
     volume:Number(row.volume||0),
   }))
   .filter(bar=>Number.isFinite(Date.parse(bar.time))&&[bar.open,bar.high,bar.low,bar.close,bar.volume].every(Number.isFinite))
   .sort((a,b)=>Date.parse(a.time)-Date.parse(b.time));
 if(!minutes)return bars;
 const buckets=new Map<number,WebullBar>();
 for(const bar of bars){
   const time=Math.floor(Date.parse(bar.time)/(minutes*60000))*minutes*60000;
   const old=buckets.get(time);
   if(old){
     old.high=Math.max(old.high,bar.high);
     old.low=Math.min(old.low,bar.low);
     old.close=bar.close;
     old.volume+=bar.volume;
   }else{
     buckets.set(time,{...bar,time:new Date(time).toISOString()});
   }
 }
 return [...buckets.values()];
}

export function webullBarsBySymbol(raw:unknown,minutes=0):Record<string,WebullBar[]>{
 const output:Record<string,WebullBar[]>={};
 const value=raw as any;
 const groups=Array.isArray(value?.result)?value.result:Array.isArray(value)?value:[];
 for(const group of groups){
   if(!group||typeof group!=="object")continue;
   const symbol=String(group.symbol??"").toUpperCase();
   if(!symbol||!Array.isArray(group.result))continue;
   output[symbol]=webullBars({result:group.result},minutes);
 }
 if(!Object.keys(output).length){
   const symbol=String(value?.symbol??"").toUpperCase();
   if(symbol)output[symbol]=webullBars(raw,minutes);
 }
 return output;
}

export function webullDelayMinutes(raw:unknown):number|null {
  const candidates:Array<unknown>=[];
  if(raw&&typeof raw==="object"){
    candidates.push((raw as any).delay_minutes,(raw as any).delayMinutes);
    const result=(raw as any).result;
    if(Array.isArray(result)&&result[0])candidates.push(result[0].delay_minutes,result[0].delayMinutes);
    const data=(raw as any).data;
    if(data&&typeof data==="object")candidates.push(data.delay_minutes,data.delayMinutes);
  }
  for(const value of candidates){
    const number=Number(value);
    if(Number.isFinite(number)&&number>=0)return number;
  }
  return null;
}
