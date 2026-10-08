import { assessMacroCalendar,macroOffline } from "./macroCalendar";
import { assessPublicCalendar } from "./publicMacroCalendar";
import { sharedMarketRead } from "./sharedMarketRead";
import type { OutputType } from "../endpoints/risk/macro_GET.schema";
export async function serverMacroRisk():Promise<OutputType>{
 const key=(process.env as Record<string,string|undefined>).FMP_API_KEY;
 const now=new Date(),ymd=(d:Date)=>d.toISOString().slice(0,10);
 const query={country:"US",from:ymd(new Date(now.getTime()-86400000)),to:ymd(new Date(now.getTime()+2*86400000))};
 let primaryError="FMP calendar key is unavailable.";
 if(key)try{
  const raw=await sharedMarketRead(key,"fmp-economic-calendar",query,null,120000,async()=>{
   const url="https://financialmodelingprep.com/stable/economic-calendar?country=US&from="+query.from+"&to="+query.to+"&apikey="+encodeURIComponent(key);
   const response=await fetch(url,{headers:{Accept:"application/json"},signal:AbortSignal.timeout(8000)});
   if(!response.ok)throw new Error("FMP calendar HTTP "+response.status);
   const result=await response.json();
   if(!assessMacroCalendar(result).connected)throw new Error("FMP calendar returned invalid data");
   return result;
  });
  return assessMacroCalendar(raw);
 }catch(error){primaryError=error instanceof Error?error.message:"FMP calendar unavailable";}
 try{
  const feed=await sharedMarketRead("public-economic-calendar","forex-factory-weekly",{day:ymd(now)},null,300000,async()=>{
   const response=await fetch("https://nfs.faireconomy.media/ff_calendar_thisweek.json",{headers:{Accept:"application/json"},signal:AbortSignal.timeout(8000)});
   if(!response.ok)throw new Error("Public calendar HTTP "+response.status);
   const rows=await response.json(),modified=response.headers.get("last-modified");
   if(!assessPublicCalendar(rows,modified).connected)throw new Error("Public calendar freshness or weekly coverage could not be verified");
   return {rows,modified};
  }) as {rows:unknown;modified:string|null};
  const result=assessPublicCalendar(feed.rows,feed.modified);
  return {...result,message:result.message+" Primary provider unavailable; independently verified fallback in use."};
 }catch(error){
  return macroOffline(primaryError+"; "+(error instanceof Error?error.message:"Public calendar unavailable")+". New buys are paused.");
 }
}
