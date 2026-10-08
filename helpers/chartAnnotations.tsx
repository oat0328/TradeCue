import type {Candle} from "./chartMath";
export type ChartMark={id:string;kind:"level"|"trend"|"fib";label:string;color:string;start:{time:number;price:number};end?:{time:number;price:number}};
type Pivot={index:number;time:number;price:number;kind:"high"|"low";label:string};
const ratios=[.236,.382,.5,.618,.786];
function clock(time:string){
 const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(time));
 const get=(key:string)=>parts.find(p=>p.type===key)?.value??"";
 return {day:get("year")+"-"+get("month")+"-"+get("day"),minute:Number(get("hour"))*60+Number(get("minute"))};
}
export function chartAnnotations(input:Candle[]){
 const bars=input.filter(b=>b.time&&Number.isFinite(Date.parse(b.time))&&[b.open,b.high,b.low,b.close].every(Number.isFinite)).sort((a,b)=>Date.parse(a.time!)-Date.parse(b.time!));
 const levels:Array<{label:string;price:number;color:string}>=[];
 const pivots:Pivot[]=[];
 if(!bars.length)return {levels,pivots,fib:[] as Array<{label:string;price:number;color:string}>,anchors:null as null|{start:Pivot;end:Pivot},sessionDate:null as string|null};
 const days=bars.map(b=>clock(b.time!));
 const sessionDate=days.at(-1)!.day;
 const addRange=(label:string,selected:Candle[],color:string)=>{
  if(!selected.length)return;
  levels.push({label:label+" HIGH",price:Math.max(...selected.map(b=>b.high)),color},{label:label+" LOW",price:Math.min(...selected.map(b=>b.low)),color});
 };
 addRange("DAY",bars.filter((_,i)=>days[i].day===sessionDate&&days[i].minute>=570&&days[i].minute<960),"#8db8ff");
 addRange("PREMARKET",bars.filter((_,i)=>days[i].day===sessionDate&&days[i].minute>=240&&days[i].minute<570),"#f5c86a");
 const priorDay=[...days].reverse().find(d=>d.day<sessionDate&&d.minute>=570&&d.minute<960)?.day;
 if(priorDay)addRange("PRIOR RTH",bars.filter((_,i)=>days[i].day===priorDay&&days[i].minute>=570&&days[i].minute<960),"#a6a5c9");
 let priorHigh:number|null=null,priorLow:number|null=null;
 for(let i=2;i<bars.length-2;i++){
  const bar=bars[i];
  const time=Math.floor(Date.parse(bar.time!)/1000);
  if(bar.high>bars[i-1].high&&bar.high>=bars[i-2].high&&bar.high>=bars[i+1].high&&bar.high>bars[i+2].high){
   pivots.push({index:i,time,price:bar.high,kind:"high",label:priorHigh==null?"SH":bar.high>priorHigh?"HH":bar.high<priorHigh?"LH":"EH"});priorHigh=bar.high;
  }
  if(bar.low<bars[i-1].low&&bar.low<=bars[i-2].low&&bar.low<=bars[i+1].low&&bar.low<bars[i+2].low){
   pivots.push({index:i,time,price:bar.low,kind:"low",label:priorLow==null?"SL":bar.low>priorLow?"HL":bar.low<priorLow?"LL":"EL"});priorLow=bar.low;
  }
 }
 const end=pivots.at(-1);
 const start=end?[...pivots].reverse().find(p=>p.kind!==end.kind&&p.index<end.index):undefined;
 const anchors=start&&end&&start.price!==end.price?{start,end}:null;
 const fib=anchors?ratios.map(r=>({label:"FIB "+(r*100).toFixed(1)+"%",price:anchors.end.price+(anchors.start.price-anchors.end.price)*r,color:"#b9a7ff"})):[];
 return {levels,pivots:pivots.slice(-24),fib,anchors,sessionDate};
}
export function chartMarkFib(mark:ChartMark){
 if(mark.kind!=="fib"||!mark.end||mark.start.price===mark.end.price)return [];
 return ratios.map(r=>({label:mark.label+" "+(r*100).toFixed(1)+"%",price:mark.end!.price+(mark.start.price-mark.end!.price)*r,color:mark.color}));
}
export function restoreChartMarks(raw:string|null):ChartMark[]{
 try{
  const items=JSON.parse(raw??"[]");
  if(!Array.isArray(items))return [];
  return items.filter((m:any)=>m&&typeof m.id==="string"&&["level","trend","fib"].includes(m.kind)&&typeof m.label==="string"&&/^#[0-9a-f]{6}$/i.test(m.color)&&Number.isFinite(m.start?.time)&&Number.isFinite(m.start?.price)&&m.start.price>0&&(m.kind==="level"||(Number.isFinite(m.end?.time)&&Number.isFinite(m.end?.price)&&m.end.price>0&&m.end.time!==m.start.time))).slice(0,50);
 }catch{return [];}
}