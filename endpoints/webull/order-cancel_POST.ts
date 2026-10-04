import superjson from "superjson";
import { apiUser, apiJson, apiFailure } from "../../helpers/apiAccess";
import { db } from "../../helpers/db";
import { cancelWebullPaperOrder, userKeys } from "../../helpers/webullClient";
import { schema } from "./order-cancel_POST.schema";

export async function handle(request:Request){
  try{
    const user=await apiUser(request);
    const input=schema.parse(superjson.parse(await request.text()));
    await cancelWebullPaperOrder(await userKeys(user),input.accountId,input.clientOrderId);

    await db.transaction().execute(async trx=>{
      await trx.updateTable("paperOrders").set({status:"cancel_requested",updatedAt:new Date()}).where("userId","=",user.id).where("clientOrderId","=",input.clientOrderId).execute();
      await trx.insertInto("cueAuditLog").values({
        userId:user.id,
        action:"webull_paper_order_cancel_requested",
        entityType:"paper_order",
        entityId:input.clientOrderId,
        details:{accountId:input.accountId},
      }).execute();
    });

    return apiJson({cancelled:true,clientOrderId:input.clientOrderId});
  }catch(error){
    return apiFailure(error);
  }
}

