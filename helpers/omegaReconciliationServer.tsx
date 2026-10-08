import {db} from "./db";
import {webullTodayOrders,type webullSnapshot,type WebullKeys} from "./webullClient";
import {omegaReconciliation} from "./omegaReconciliation";
import {ptDayKey} from "./exitGuardServer";
export async function reconcileOmegaAccount(userId:number,keys:WebullKeys,snapshot:Awaited<ReturnType<typeof webullSnapshot>>,excludeClientOrderId?:string){
  const accountId=snapshot.selectedAccountId;
  const [orders,lots,intents]=await Promise.all([
    webullTodayOrders(keys,accountId),
    db.selectFrom("cueTradeJournal").select(["id","symbol","quantity","stopPrice"]).where("userId","=",userId).where("accountId","=",accountId).where("status","=","open").execute(),
    db.selectFrom("paperOrderIntents").select(["clientOrderId","status","createdAt"]).where("userId","=",userId).where("accountId","=",accountId).where("createdAt",">=",new Date(Date.now()-36*3600000)).execute(),
  ]);
  const fills=lots.length?await db.selectFrom("cueJournalExitFills").select(["journalId","qty"]).where("userId","=",userId).where("accountId","=",accountId).where("journalId","in",lots.map(lot=>lot.id)).execute():[];
  const exited=new Map<string,number>();
  for(const fill of fills)exited.set(fill.journalId,(exited.get(fill.journalId)??0)+Number(fill.qty));
  const portfolioPositions=snapshot.positions.filter(position=>Number(position.quantity)>0).map(position=>{
    const stops=lots.filter(lot=>lot.symbol.toUpperCase()===position.symbol.toUpperCase()&&Number(lot.quantity)-(exited.get(lot.id)??0)>1e-6).map(lot=>lot.stopPrice==null?NaN:Number(lot.stopPrice));
    return {quantity:Number(position.quantity),entry:position.costPrice==null?NaN:Number(position.costPrice),stop:stops.length&&stops.every(stop=>Number.isFinite(stop)&&stop>0)?Math.min(...stops):null};
  });
  return {...omegaReconciliation({accountId,...snapshot.balance,positions:snapshot.positions,lots:lots.map(lot=>({...lot,exitedQuantity:exited.get(lot.id)??0})),intents:intents.filter(row=>row.clientOrderId!==excludeClientOrderId&&(ptDayKey(new Date(row.createdAt))===ptDayKey()||row.status==="uncertain"||row.status==="submitting")),orders}),portfolioPositions,checkedAt:new Date().toISOString()};
}