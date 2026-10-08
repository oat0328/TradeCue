import type {ChartTrade} from "../endpoints/journal/chart-trades_GET.schema";
export function chartFrameSeconds(timeframe:string){return ({"5m":300,"15m":900,"1H":3600,"4H":14400} as Record<string,number>)[timeframe]??300;}
export function chartFillBar(time:string,barTimes:string[],timeframe:string):number|null{
 const fill=Date.parse(time),span=chartFrameSeconds(timeframe)*1000;
 if(!Number.isFinite(fill))return null;
 for(let index=barTimes.length-1;index>=0;index--){
  const start=Date.parse(barTimes[index]);
  const next=index+1<barTimes.length?Date.parse(barTimes[index+1]):start+span;
  if(fill>=start&&fill<Math.min(start+span,next))return Math.floor(start/1000);
 }
 return null;
}
export function chartTradeResult(trade:ChartTrade){
 const exits=trade.exits.filter(exit=>Number.isFinite(exit.price)&&exit.price>0&&Number.isFinite(exit.quantity)&&exit.quantity>0&&Number.isFinite(Date.parse(exit.time)));
 const sold=exits.reduce((sum,exit)=>sum+exit.quantity,0);
 const grossPnl=exits.length?exits.reduce((sum,exit)=>sum+(exit.price-trade.entryPrice)*exit.quantity,0):null;
 return {exits,sold,grossPnl,remaining:trade.quantity!=null&&Number.isFinite(trade.quantity)?Math.max(0,trade.quantity-sold):null};
}