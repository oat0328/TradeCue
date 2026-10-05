import { assessMacroCalendar,macroOffline } from "./macroCalendar";
export function assessPublicCalendar(raw:unknown,lastModified:string|null,now=Date.now()){
 const fail=()=>macroOffline("Public calendar is stale, incomplete or invalid; new buys are paused.");
 if(!Array.isArray(raw)||!raw.length)return fail();
 const modified=Date.parse(lastModified||"");
 if(!Number.isFinite(modified)||now-modified>86400000||modified>now+300000)return fail();
 const localDay=(ms:number)=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(ms));
 const day=localDay(now), anchor=new Date(day+"T12:00:00Z");
 anchor.setUTCDate(anchor.getUTCDate()-anchor.getUTCDay());
 const start=anchor.toISOString().slice(0,10);anchor.setUTCDate(anchor.getUTCDate()+6);
 const end=anchor.toISOString().slice(0,10);
 const normalized=[];let latest="";
 for(const item of raw){
  if(!item||typeof item!=="object")return fail();
  const row=item as Record<string,unknown>,date=String(row.date||""),impact=String(row.impact||"").toUpperCase();
  const ms=Date.parse(date);
  if(!/Z$|[+-]\d\d:\d\d$/.test(date)||!Number.isFinite(ms)||!["HIGH","MEDIUM","LOW","NON-ECONOMIC","HOLIDAY"].includes(impact)||!row.title||!row.country)return fail();
  const eventDay=localDay(ms);if(eventDay<start||eventDay>end)return fail();
  if(eventDay>latest)latest=eventDay;
  if(row.country==="USD")normalized.push({date,event:String(row.title),impact,currency:"USD",country:"US"});
 }
 // A truncated week cannot establish that the remaining days are clear.
 anchor.setUTCDate(anchor.getUTCDate()-1);
 if(latest<anchor.toISOString().slice(0,10))return fail();
 const result=assessMacroCalendar(normalized,now);
 return {...result,message:"Forex Factory weekly calendar: "+result.message};
}
