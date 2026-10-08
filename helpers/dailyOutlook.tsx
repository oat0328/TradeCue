import type { HunterRow } from "../endpoints/hunter/scan_GET.schema";

export type CueDailyOutlook={
  label:string;
  bias:"BULLISH"|"CAUTIOUS"|"NEUTRAL";
  headline:string;
  summary:string;
  watch:string[];
  buyTrigger:string;
  stayOut:string;
  openPlan:string;
};

export function buildCueDailyOutlook(input:{
  marketMode?:string|null;
  rows?:HunterRow[];
  macroState?:string|null;
  maxPositions:number;
  openPositions:number;
}):CueDailyOutlook{
  const rows=input.rows??[];
  const ready=rows.filter(row=>row.action==="ENTRY_READY"&&row.fresh);
  const strong=rows.filter(row=>(row.cueScore??0)>=75);
  const positive=rows.filter(row=>(row.changePercent??0)>0).length;
  const average=rows.length?rows.reduce((sum,row)=>sum+(row.cueScore??0),0)/rows.length:0;
  const blocked=input.macroState==="BLOCKED";
  const capacity=input.openPositions<input.maxPositions;
  const label=input.marketMode==="RTH"?"TODAY'S OUTLOOK":"NEXT SESSION OUTLOOK";
  const bias:CueDailyOutlook["bias"]=blocked?"CAUTIOUS":ready.length>=2||((average>=75)&&positive>=Math.ceil(rows.length/2))?"BULLISH":strong.length?"NEUTRAL":"CAUTIOUS";
  const watch=rows.slice(0,3).map(row=>row.symbol);
  const headline=blocked
    ?"Protect capital first — macro risk is elevated."
    :ready.length
      ?ready.length+" qualified setup"+(ready.length===1?"":"s")+" are closest to entry."
      :strong.length
        ?"Good names are developing, but Omega is waiting for confirmation."
        :"No clean edge yet. Patience is the trade.";
  const summary=!rows.length
    ?"Omega is waiting for the next scanner refresh before forming a market opinion."
    :"Omega sees "+strong.length+" strong candidate"+(strong.length===1?"":"s")+" out of "+rows.length+
      ", with an average score of "+average.toFixed(0)+"/100. "+
      (positive>=Math.ceil(rows.length/2)?"Momentum is leaning positive.":"Momentum is mixed, so selectivity matters.");
  const buyTrigger="Omega will only buy when a stock is ENTRY READY, candles are fresh, the setup is inside its entry zone, the news guard is clear, and the risk firewall allows the size.";
  const stayOut=blocked
    ?"Stay out while the macro guard is BLOCKED."
    :!capacity
      ?"Stay out of new trades until an existing position is closed."
      :"Stay out when the setup is late, stale, outside the entry zone, weak across timeframes, or the reward no longer justifies the stop.";
  const openPlan=input.marketMode==="WEEKEND_PREP"
    ?"Monday plan: rank the best Friday-close setups, then re-check fresh 5-minute structure after the regular open before entering anything."
    :input.marketMode==="PREMARKET"
      ?"Premarket plan: build the watch list now, then wait for regular-session confirmation before Auto Paper can enter."
      :input.marketMode==="RTH"
        ?"Live plan: scan continuously, take only qualified ENTRY READY setups, manage the original stop/targets, and exit when the plan invalidates."
        :"Next-session plan: keep ranking setups now, but wait for regular market hours before placing stock entries.";
  return {label,bias,headline,summary,watch,buyTrigger,stayOut,openPlan};
}