import { apiUser,apiJson,apiFailure } from "../../helpers/apiAccess";
import { userKeys,webullRead,webullRows } from "../../helpers/webullClient";
import {snapshotChangePercent} from "../../helpers/marketQuote";
import { CORE_STOCKS } from "../../helpers/stockUniverse";
function finite(value:unknown):number|null{if(value==null||value==="")return null;const n=Number(value);return Number.isFinite(n)?n:null;}
export async function handle(request:Request){
 try{
  const user=await apiUser(request),keys=await userKeys(user);
  const raw=await webullRead(keys,"/market-data/stocks/snapshots/list",{symbols:CORE_STOCKS.join(","),category:"US_STOCK",extend_hour_required:"true",overnight_required:"true"});
  const all=webullRows(raw).map(row=>({symbol:String(row.symbol??row.ticker??"").toUpperCase(),name:String(row.name??""),price:finite(row.price??row.close??row.latest_price??row.last_price),changePercent:snapshotChangePercent(row),relativeVolume:finite(row.relative_volume_10d),volume:finite(row.volume)})).filter(row=>CORE_STOCKS.includes(row.symbol));
  const movers=all.filter(row=>row.price!=null&&row.price>=10&&(row.changePercent==null||Math.abs(row.changePercent)<=15));
  const breadth=all.reduce((acc,row)=>{if(row.changePercent==null)return acc;if(row.changePercent>0)acc.advancers++;else if(row.changePercent<0)acc.decliners++;else acc.flat++;return acc;},{advancers:0,decliners:0,flat:0});
  return apiJson({generatedAt:new Date(),source:"webull-paper" as const,benchmarks:all.filter(row=>["SPY","QQQ","IWM","DIA"].includes(row.symbol)).map(({symbol,price,changePercent})=>({symbol,price,changePercent})),gainers:movers.filter(row=>row.changePercent!>0).sort((a,b)=>b.changePercent!-a.changePercent!).slice(0,8),losers:movers.filter(row=>row.changePercent!<0).sort((a,b)=>a.changePercent!-b.changePercent!).slice(0,8),active:[...movers].sort((a,b)=>(b.volume??0)*(b.price??0)-(a.volume??0)*(a.price??0)).slice(0,8),breadth});
 }catch(error){return apiFailure(error);}
}