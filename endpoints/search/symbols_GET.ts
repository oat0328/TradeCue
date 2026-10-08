import { apiUser,apiJson,apiFailure } from "../../helpers/apiAccess";
import { userKeys,webullRead,webullRows } from "../../helpers/webullClient";
import { schema } from "./symbols_GET.schema";

const FMP_BASE="https://financialmodelingprep.com/stable";
function cleanItem(row:any){
  const symbol=String(row.symbol??"").toUpperCase();
  if(!/^[A-Z0-9.-]{1,15}$/.test(symbol))return null;
  return {symbol,name:String(row.name??row.companyName??symbol),exchange:row.exchange?String(row.exchange):null,currency:row.currency?String(row.currency):null,source:"fmp" as const};
}

export async function handle(request:Request){
  try{
    const user=await apiUser(request);
    const q=schema.parse({q:new URL(request.url).searchParams.get("q")??""}).q;
    const apiKey=(process.env as Record<string,string|undefined>)["FMP_API_KEY"];
    let lookupProblem:string|null=null;
    if(apiKey){
      for(const path of ["search-symbol","search-name"]){
      try{
      const response=await fetch(FMP_BASE+"/"+path+"?query="+encodeURIComponent(q)+"&limit=12&apikey="+encodeURIComponent(apiKey),{headers:{Accept:"application/json"}});
      if(response.ok){
        const raw=await response.json();
        const items=(Array.isArray(raw)?raw:[]).map(cleanItem).filter(Boolean).filter((item:any)=>["NASDAQ","NYSE","AMEX","ETF","NYSE ARCA","NASDAQ GLOBAL SELECT"].some(exchange=>(item.exchange??"").toUpperCase().includes(exchange))).slice(0,8);
        if(items.length)return apiJson({items,source:"fmp",note:"Company-name and ticker matches from Financial Modeling Prep."});
      }else{lookupProblem="Company-name search is unavailable from the data provider (HTTP "+response.status+"). Try an exact ticker, such as WMT for Walmart.";}
      }catch{lookupProblem="Company-name search could not reach the data provider. Try an exact ticker.";} }
    }

    // Official issuer mapping: https://stock.walmart.com/ (verified 2026-10-04).
    const ticker=/^wal[ -]?mart(?: inc\.?)?$/i.test(q.trim())?"WMT":q.toUpperCase();
    if(/^[A-Z0-9.-]{1,15}$/.test(ticker)){
      try{
        const raw=await webullRead(await userKeys(user),"/market-data/stocks/snapshots/list",{symbols:ticker,category:"US_STOCK",extend_hour_required:"true"});
        const row=webullRows(raw)[0];
        if(row&&String(row.symbol??row.ticker??"").toUpperCase()===ticker){
          return apiJson({items:[{symbol:ticker,name:String(row.name??ticker),exchange:row.exchange?String(row.exchange):null,currency:"USD",source:"webull"}],source:"webull",note:"Exact ticker verified with Webull. Connect FMP for fuzzy company-name lookup."});
        }
      }catch{lookupProblem=lookupProblem??"Ticker lookup is temporarily unavailable or rate limited. Please retry shortly.";}
    }
    if(lookupProblem)return apiJson({items:[],source:"webull",note:lookupProblem});
    return apiJson({items:[],source:"webull",note:apiKey?"No matching U.S. stock or ETF found.":"Enter an exact ticker, or connect FMP for company-name search."});
  }catch(error){return apiFailure(error);}
}