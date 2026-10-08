import { apiUser,apiJson,apiFailure } from "../../helpers/apiAccess";
import { db } from "../../helpers/db";

export async function handle(request:Request){
  try{
    const user=await apiUser(request);
    const [trades,decisions,orders]=await Promise.all([
      db.selectFrom("cueTradeJournal").select(["id","symbol","status","setup","quantity","entryPrice","entryTime","exitPrice","exitTime","realizedPnl","stopPrice","target1","target2","target3"]).where("userId","=",user.id).orderBy("entryTime","desc").limit(100).execute(),
      db.selectFrom("cueAuditLog")
        .select(["id","action","entityId","details","createdAt"])
        .where("userId","=",user.id)
        .where("entityType","=","cue_decision")
        .orderBy("createdAt","desc").limit(40).execute(),
      db.selectFrom("paperOrders")
        .select(["id","symbol","side","orderType","quantity","limitPrice","status","createdAt"])
        .where("userId","=",user.id)
        .orderBy("createdAt","desc").limit(40).execute(),
    ]);
    return apiJson({
      decisions:decisions.map(row=>({
        id:String(row.id),symbol:row.entityId??"—",action:row.action.replace("cue_decision_","").toUpperCase(),
        createdAt:new Date(row.createdAt).toISOString(),
        details:(row.details&&typeof row.details==="object"&&!Array.isArray(row.details)?row.details:{}) as Record<string,unknown>,
      })),
      orders:orders.map(row=>({
        id:String(row.id),symbol:row.symbol,side:row.side,orderType:row.orderType,
        quantity:Number.isFinite(Number(row.quantity))?Number(row.quantity):null,
        limitPrice:row.limitPrice!=null&&Number.isFinite(Number(row.limitPrice))?Number(row.limitPrice):null,
        status:row.status,createdAt:new Date(row.createdAt).toISOString(),
      })),
      trades:trades.filter(row=>row.entryTime!=null).map(row=>({
        id:String(row.id),symbol:row.symbol,status:row.status,setup:row.setup,
        quantity:row.quantity==null?null:Number(row.quantity),
        entryPrice:row.entryPrice==null?null:Number(row.entryPrice),entryTime:new Date(row.entryTime!).toISOString(),
        exitPrice:row.exitPrice==null?null:Number(row.exitPrice),exitTime:row.exitTime?new Date(row.exitTime).toISOString():null,
        realizedPnl:row.realizedPnl==null?null:Number(row.realizedPnl),
        stopPrice:row.stopPrice==null?null:Number(row.stopPrice),
        target1:row.target1==null?null:Number(row.target1),
        target2:row.target2==null?null:Number(row.target2),
        target3:row.target3==null?null:Number(row.target3),
      })),
      summary:{decisionCount:decisions.length,paperOrderCount:orders.length},
    });
  }catch(error){return apiFailure(error);}
}