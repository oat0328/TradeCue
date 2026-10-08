import { OMEGA_EXECUTION_SYMBOLS } from "./omegaStrategy";

// Omega may research a broad liquid universe, but automatic PaperTrade execution starts on a deliberately small training whitelist.
export const OMEGA_EXECUTION_STOCKS=OMEGA_EXECUTION_SYMBOLS;
export const CORE_STOCKS=["AAPL","MSFT","NVDA","AMZN","GOOG","GOOGL","META","TSLA","AMD","AVGO","MU","NFLX","ORCL","CRM","ADBE","PLTR","UBER","JPM","BAC","GS","V","MA","COST","WMT","HD","UNH","LLY","XOM","CVX","CAT","SPY","QQQ","IWM","DIA"];
export function liquidStockCandidate(row:{symbol:string;name:string;price:number;marketValue:number|null;changePercent:number|null}){
 if(!Number.isFinite(row.price)||row.price<20)return false;
 if(/warrant|blank check|acquisition|rights?\b|units?\b/i.test(row.name))return false;
 if(!CORE_STOCKS.includes(row.symbol)&&!(row.marketValue!=null&&row.marketValue>=10_000_000_000))return false;
 if(row.changePercent==null)return CORE_STOCKS.includes(row.symbol); // Research only; entry needs independent market and chart confirmation.
 return row.changePercent!=null&&Number.isFinite(row.changePercent)&&Math.abs(row.changePercent)>=0.3&&Math.abs(row.changePercent)<=15;
}
