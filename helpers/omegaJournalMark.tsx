import {db} from "./db";
import {webullRead,type WebullKeys} from "./webullClient";
import {webullBarsBySymbol} from "./webullBars";
export async function omegaJournalMark(userId:number,accountId:string,keys:WebullKeys){
 const lots=await db.selectFrom("cueTradeJournal").select(["id","symbol","entryTime","entryPrice","quantity","mae","mfe","details"]).where("userId","=",userId).where("accountId","=",accountId).where("status","=","open").execute();
 if(!lots.length)return;
 const symbols=[...new Set(lots.map(l=>l.symbol))];
 const raw=await webullRead(keys,"/market-data/stocks/bars/list",{},{symbols,category:"US_STOCK",timespan:"M5",count:"1200",real_time_required:true,trading_sessions:"PRE,RTH,ATH"});
 const bars=webullBarsBySymbol(raw);
 for(const lot of lots){
  if(!lot.entryTime||lot.entryPrice==null||lot.quantity==null)continue;
  const held=(bars[lot.symbol]??[]).filter(b=>Date.parse(b.time)>=+new Date(lot.entryTime!)&&Date.parse(b.time)<=Date.now());
  if(!held.length)continue;
  const entry=Number(lot.entryPrice),qty=Number(lot.quantity);
  if(!Number.isFinite(entry)||!Number.isFinite(qty)||qty<=0)continue;
  const mae=Math.min(Number(lot.mae??0),0,...held.map(b=>(b.low-entry)*qty));
  const mfe=Math.max(Number(lot.mfe??0),0,...held.map(b=>(b.high-entry)*qty));
  const details=lot.details&&typeof lot.details==="object"&&!Array.isArray(lot.details)?lot.details:{};
  await db.updateTable("cueTradeJournal").set({mae:String(mae),mfe:String(mfe),details:{...details,excursionSource:"Estimated M5-bar excursions using original lot quantity; partial entry candle and intrabar timing are not exact",excursionUpdatedAt:new Date().toISOString(),timeInTradeSeconds:Math.max(0,(Date.now()-+new Date(lot.entryTime))/1000)},updatedAt:new Date()}).where("id","=",lot.id).execute();
 }
}