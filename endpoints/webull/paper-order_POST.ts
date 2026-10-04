import superjson from "superjson";
import { apiUser, apiJson, apiFailure, ApiError } from "../../helpers/apiAccess";
import { db } from "../../helpers/db";
import { effectiveMembership } from "../../helpers/effectiveMembership";
import { placeWebullPaperOrder, previewWebullPaperOrder, userKeys } from "../../helpers/webullClient";
import type { Json } from "../../helpers/schema";
import { schema } from "./paper-order_POST.schema";
import { enforcePaperOrderRisk } from "../../helpers/riskFirewall";

export async function handle(request:Request){
  try{
    const user=await apiUser(request);
    const membership=await effectiveMembership(user.id,user.role==="admin");
    if(!membership.accessActive || membership.tier==="scout") throw new ApiError(403,"Copilot or Autopilot access is required for Webull PaperTrade orders.");

    const input=schema.parse(superjson.parse(await request.text()));
    const keys=await userKeys(user);
    const orderInput={
      accountId:input.accountId,
      symbol:input.symbol,
      side:input.side,
      orderType:input.orderType,
      quantity:input.quantity,
      limitPrice:input.limitPrice,
    };
    const riskCheck=await enforcePaperOrderRisk({
      userId:user.id,
      keys,
      input:{...orderInput,tradeMode:input.tradeMode},
    });
    await previewWebullPaperOrder(keys,orderInput);
    const result=await placeWebullPaperOrder(keys,orderInput);

    const rawResponse=JSON.parse(JSON.stringify(result.response ?? null)) as Json;
    const responseRecord=result.response && typeof result.response==="object" ? result.response as Record<string,unknown> : {};
    const brokerOrderId =
      typeof responseRecord.order_id==="string" ? responseRecord.order_id :
      typeof responseRecord.orderId==="string" ? responseRecord.orderId :
      null;
    const status =
      typeof responseRecord.status==="string" ? responseRecord.status :
      typeof responseRecord.order_status==="string" ? responseRecord.order_status :
      "submitted";

    await db.transaction().execute(async trx=>{
      await trx.insertInto("paperOrders").values({
        userId:user.id,
        accountId:input.accountId,
        symbol:input.symbol,
        instrumentId:result.instrumentId,
        side:input.side,
        orderType:input.orderType,
        quantity:String(input.quantity),
        limitPrice:input.limitPrice!=null?String(input.limitPrice):null,
        clientOrderId:result.clientOrderId,
        brokerOrderId,
        status,
        rawResponse,
      }).execute();

      await trx.insertInto("cueAuditLog").values({
        userId:user.id,
        action:"webull_paper_order_submitted",
        entityType:"paper_order",
        entityId:result.clientOrderId,
        details:{
          symbol:input.symbol,
          side:input.side,
          orderType:input.orderType,
          quantity:input.quantity,
          accountId:input.accountId,
        },
      }).execute();
    });

    return apiJson({
      submitted:true,
      clientOrderId:result.clientOrderId,
      symbol:input.symbol,
      side:input.side,
      orderType:input.orderType,
      quantity:input.quantity,
      status,
      riskCheck,
    });
  }catch(error){
    return apiFailure(error);
  }
}

