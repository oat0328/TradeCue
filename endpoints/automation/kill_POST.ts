import superjson from "superjson";
import { apiUser,apiJson,apiFailure } from "../../helpers/apiAccess";
import { db } from "../../helpers/db";
import { cancelWebullPaperOrder,userKeys,webullAccounts,webullTodayOrders } from "../../helpers/webullClient";
import { schema } from "./kill_POST.schema";

function working(status:string){
  const value=String(status||"").toUpperCase().replace(/[^A-Z]/g,"");
  return ["PENDING","SUBMITTED","PARTIALFILLED","WORKING","NEW","ACCEPTED"].includes(value);
}

export async function handle(request:Request){
  try{
    const user=await apiUser(request);
    const input=schema.parse(superjson.parse(await request.text()));

    await db.insertInto("cueAutomationControls").values({
      userId:user.id,
      brainEnabled:false,
      autoPaperEnabled:false,
      killSwitch:true,
      maxAutoPositions:3,
      perTradeBudget:500,
      updatedAt:new Date(),
    }).onConflict(oc=>oc.column("userId").doUpdateSet({
      brainEnabled:false,
      autoPaperEnabled:false,
      killSwitch:true,
      updatedAt:new Date(),
    })).execute();

    let cancelRequested=0;
    let cancelFailed=0;

    try{
      const keys=await userKeys(user);
      const accounts=await webullAccounts(keys);
      const targets=input.accountId?accounts.filter(a=>a.accountId===input.accountId):accounts;
      for(const account of targets){
        const orders=await webullTodayOrders(keys,account.accountId);
        for(const order of orders){
          if(order.side.toUpperCase()!=="BUY"||!working(order.status)||!order.clientOrderId)continue;
          try{
            await cancelWebullPaperOrder(keys,account.accountId,order.clientOrderId);
            cancelRequested++;
            await db.updateTable("paperOrders")
              .set({status:"cancel_requested",updatedAt:new Date()})
              .where("userId","=",user.id)
              .where("clientOrderId","=",order.clientOrderId)
              .execute();
          }catch{
            cancelFailed++;
          }
        }
      }
    }catch{
      cancelFailed++;
    }

    await db.insertInto("cueAuditLog").values({
      userId:user.id,
      action:"automation_kill_switch",
      entityType:"automation",
      entityId:String(user.id),
      details:{cancelRequested,cancelFailed},
    }).execute();

    return apiJson({ok:true,cancelRequested,cancelFailed});
  }catch(error){
    return apiFailure(error);
  }
}
