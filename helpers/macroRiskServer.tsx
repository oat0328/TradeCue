import { assessMacroCalendar,macroOffline } from "./macroCalendar";
import type { OutputType } from "../endpoints/risk/macro_GET.schema";
let cache:{raw:unknown;until:number}|null=null;
let failure:{value:OutputType;until:number}|null=null;
let inFlight:Promise<OutputType>|null=null;
async function load():Promise<OutputType>{
  const key=(process.env as Record<string,string|undefined>).FMP_API_KEY;
  if(!key)return macroOffline("Connect an economic-calendar-capable FMP key; new buys are paused.");
  try{
    const now=new Date(),from=new Date(now.getTime()-86400000),to=new Date(now.getTime()+2*86400000);
    const ymd=(d:Date)=>d.toISOString().slice(0,10);
    const url="https://financialmodelingprep.com/stable/economic-calendar?country=US&from="+ymd(from)+"&to="+ymd(to)+"&apikey="+encodeURIComponent(key);
    const response=await fetch(url,{headers:{Accept:"application/json"},signal:AbortSignal.timeout(8000)});
    if(!response.ok){
      const message=response.status===402?"FMP plan does not allow the economic calendar. Enable calendar access; new buys are paused.":response.status===401||response.status===403?"FMP rejected calendar access. Check the connected key and plan; new buys are paused.":response.status===429?"FMP calendar rate limit reached; new buys are paused until a fresh check succeeds.":"Economic calendar unavailable (HTTP "+response.status+"); new buys are paused.";
      const value=macroOffline(message);failure={value,until:Date.now()+30000};return value;
    }
    const raw=await response.json();
    const value=assessMacroCalendar(raw);
    if(value.connected){cache={raw,until:Date.now()+120000};failure=null;}
    else failure={value,until:Date.now()+30000};
    return value;
  }catch{
    const value=macroOffline("Economic calendar timed out or failed; new buys are paused.");
    failure={value,until:Date.now()+30000};return value;
  }
}
export async function serverMacroRisk():Promise<OutputType>{
  if(failure&&failure.until>Date.now())return failure.value;
  if(cache&&cache.until>Date.now())return assessMacroCalendar(cache.raw);
  if(!inFlight)inFlight=load().finally(()=>{inFlight=null;});
  return inFlight;
}

