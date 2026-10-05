import type { OutputType,MacroEvent } from "../endpoints/risk/macro_GET.schema";

export function macroOffline(message:string):OutputType{
  return {state:"OFFLINE",connected:false,nearest:null,events:[],message,blockedWindowMinutes:10};
}
export function assessMacroCalendar(raw:unknown,nowMs=Date.now()):OutputType{
  if(!Array.isArray(raw))return macroOffline("Economic calendar returned an invalid response; new buys are paused.");
  const events:MacroEvent[]=[];
  for(const item of raw){
    if(!item||typeof item!=="object")return macroOffline("Economic calendar contains invalid records; new buys are paused.");
    const row=item as Record<string,unknown>;
    const currency=String(row.currency??"").toUpperCase();
    const country=String(row.country??"").toUpperCase();
    if(currency&&currency!=="USD"||country&&!["US","USA","UNITED STATES"].includes(country))continue;
    const date=typeof row.date==="string"?row.date:"";
    const iso=/Z$|[+-]\d\d:\d\d$/.test(date)?date:date.replace(" ","T")+"Z";
    const ms=Date.parse(iso);
    const impact=String(row.impact??"").toUpperCase();
    if(!Number.isFinite(ms)||!impact)return macroOffline("Economic calendar has missing timing or impact data; new buys are paused.");
    events.push({date:new Date(ms).toISOString(),event:String(row.event??"Economic release"),impact,currency:currency||"USD",minutesFromNow:Math.round((ms-nowMs)/60000)});
  }
  events.sort((a,b)=>Math.abs(a.minutesFromNow)-Math.abs(b.minutesFromNow));
  const high=events.filter(e=>e.impact.includes("HIGH"));
  // Evaluate the complete calendar before truncating the display.
  const blocked=high.some(e=>e.minutesFromNow>=-10&&e.minutesFromNow<=10);
  const caution=high.some(e=>e.minutesFromNow>-60&&e.minutesFromNow<60);
  return {state:blocked?"BLOCKED":caution?"CAUTION":"CLEAR",connected:true,nearest:high[0]??events[0]??null,events:events.slice(0,12),blockedWindowMinutes:10,
    message:blocked?"High-impact USD release is inside the ±10 minute no-entry window.":caution?"High-impact USD release is within one hour. Wait for confirmed post-news structure.":"No high-impact USD release is inside the current lockout window."};
}

