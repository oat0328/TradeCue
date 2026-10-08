import {apiUser,apiJson,apiFailure} from "../../helpers/apiAccess";
import {db} from "../../helpers/db";
import {schema,type ChartTrade} from "./chart-trades_GET.schema";
export async function handle(request:Request){
 try{
  const user=await apiUser(request);
  const input=schema.parse(Object.fromEntries(new URL(request.url).searchParams));
  const rows=await db.selectFrom("cueTradeJournal").select(["id","accountId","symbol","status","entryTime","entryPrice","quantity","details"])
   .where("userId","=",user.id).where("accountId","=",input.accountId).where("symbol","=",input.symbol)
   .where("status","in",["open","closed"]).where("entryOrderId","is not",null).where("entryTime","<=",new Date(input.to))
   .where(eb=>eb.or([eb("exitTime","is",null),eb("exitTime",">=",new Date(input.from))]))
   .orderBy("entryTime","desc").limit(201).execute();
  const selected=rows.slice(0,200);
  const exits=selected.length?await db.selectFrom("cueJournalExitFills").select(["journalId","fillId","filledAt","price","qty","priceSource"])
   .where("userId","=",user.id).where("accountId","=",input.accountId).where("journalId","in",selected.map(row=>row.id)).orderBy("filledAt","asc").execute():[];
  const trades:ChartTrade[]=selected.flatMap(row=>{
   const details=row.details&&typeof row.details==="object"&&!Array.isArray(row.details)?row.details as Record<string,unknown>:{};
   const entryPrice=row.entryPrice==null?NaN:Number(row.entryPrice),entryTime=row.entryTime?new Date(row.entryTime).toISOString():null;
   const verified=details.source==="webull-paper"&&["FILLED","FINALFILLED","COMPLETED"].includes(String(details.entryStatus??"").toUpperCase().replace(/[^A-Z]/g,""));
   if(!verified||!entryTime||!Number.isFinite(entryPrice)||entryPrice<=0)return [];
   return [{id:row.id,accountId:row.accountId,symbol:row.symbol,status:row.status as "open"|"closed",entryTime,entryPrice,quantity:row.quantity!=null&&Number.isFinite(Number(row.quantity))&&Number(row.quantity)>0?Number(row.quantity):null,exits:exits.filter(exit=>exit.journalId===row.id&&["filled","legacy-verified"].includes(exit.priceSource)&&Number(exit.price)>0&&Number(exit.qty)>0).map(exit=>({id:exit.fillId,time:new Date(exit.filledAt).toISOString(),price:Number(exit.price),quantity:Number(exit.qty)}))}];
  });
  return apiJson({trades,truncated:rows.length>200,generatedAt:new Date().toISOString()});
 }catch(error){return apiFailure(error);}
}