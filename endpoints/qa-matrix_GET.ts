import { ownerKeys, webullRead, webullAccounts, previewWebullPaperOrder } from "../helpers/webullClient";
import { apiUser } from "../helpers/apiAccess";
// Owner-only diagnostics. Access requires a signed-in admin session (audit finding C-01:
// the old fixed shared header value has been retired). Non-admins get a plain 404.
export async function handle(request:Request){
 try{await apiUser(request,true);}catch{return new Response("Not found",{status:404,headers:{"Cache-Control":"no-store"}});}
 const keys=ownerKeys(); const q={symbol:"NVDA",category:"US_STOCK"};
 const accounts=await webullAccounts(keys);
 const accountId=accounts[0]?.accountId;
 const checks:Record<string,()=>Promise<unknown>>={
  accounts:async()=>accounts,
  bars:()=>webullRead(keys,"/market-data/stocks/bars/list",{}, {symbols:["NVDA"],category:"US_STOCK",timespan:"M5",count:"20",real_time_required:true,trading_sessions:"PRE,RTH,ATH"}),
  historyBatch:()=>webullRead(keys,"/market-data/stocks/bars/list",{}, {symbols:["NVDA"],category:"US_STOCK",timespan:"M5",count:"1200",real_time_required:false,trading_sessions:"PRE,RTH,ATH"}),
  snapshot:()=>webullRead(keys,"/market-data/stocks/snapshots/list",{symbols:"NVDA",category:"US_STOCK",extend_hour_required:"true"}),
  gainers:()=>webullRead(keys,"/market-data/screeners/gainers-losers/list",{category:"US_STOCK",rank_type:"DAY_1",sort_by:"CHANGE_RATIO",direction:"DESC"}),
  profile:()=>webullRead(keys,"/market-data/fundamentals/company-profiles/get",q),
  ratings:()=>webullRead(keys,"/market-data/fundamentals/analysis/ratings/get",q),
  targets:()=>webullRead(keys,"/market-data/fundamentals/analysis/target-prices/get",q),
  eps:()=>webullRead(keys,"/market-data/fundamentals/forecast-eps/get",q),
  filings:()=>webullRead(keys,"/market-data/fundamentals/filings/list",q),
  earnings:()=>webullRead(keys,"/market-data/fundamentals/earnings-calendars/list",q),
  capital:()=>webullRead(keys,"/market-data/fundamentals/capital-flows/get",q),
  alerts:()=>webullRead(keys,"/market-data/fundamentals/financial-alerts/get",q),
  indicators:()=>webullRead(keys,"/market-data/fundamentals/indicators/get",q),
  futuresMES:()=>webullRead(keys,"/market-data/futures/bars/list",{symbols:"MESmain",category:"US_FUTURES",timespan:"M5",count:"20",real_time_required:"false"}),
  orderPreview:()=>accountId?previewWebullPaperOrder(keys,{accountId,symbol:"NVDA",side:"BUY",orderType:"LIMIT",quantity:1,limitPrice:1}):Promise.reject(new Error("No paper account")),
  fmpCalendar:async()=>{
    const apiKey=(process.env as any).FMP_API_KEY as string|undefined;
    if(!apiKey)throw new Error("FMP_API_KEY missing");
    const from=new Date().toISOString().slice(0,10);
    const to=new Date(Date.now()+2*86400000).toISOString().slice(0,10);
    const r=await fetch("https://financialmodelingprep.com/stable/economic-calendar?country=US&from="+from+"&to="+to+"&apikey="+encodeURIComponent(apiKey));
    if(!r.ok)throw new Error("FMP calendar HTTP "+r.status);
    const data=await r.json();
    if(!Array.isArray(data))throw new Error("FMP calendar payload invalid");
    return data;
  },
  fmpNews:async()=>{
    const apiKey=(process.env as any).FMP_API_KEY as string|undefined;
    if(!apiKey)throw new Error("FMP_API_KEY missing");
    const r=await fetch("https://financialmodelingprep.com/stable/news/stock?symbols=NVDA&limit=2&apikey="+encodeURIComponent(apiKey));
    if(!r.ok)throw new Error("FMP news HTTP "+r.status);
    const data=await r.json();
    if(!Array.isArray(data))throw new Error("FMP news payload invalid");
    return data;
  },
 };
 const out:Record<string,string>={};
 for(const [name,fn] of Object.entries(checks)){
  try{await fn();out[name]="OK";}catch(e){out[name]=e instanceof Error?e.message:"ERR";}
 }
 return new Response(JSON.stringify({fmp:Boolean((process.env as any).FMP_API_KEY),checks:out}),{headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
}