import superjson from "superjson";
import {apiUser,apiJson,apiFailure,ApiError}from "../../helpers/apiAccess";
import {db}from "../../helpers/db";
import {effectiveMembership}from "../../helpers/effectiveMembership";
import {liveUserKeys,previewWebullLiveOrder,placeWebullLiveOrder,webullLiveSnapshot,type PaperOrderInput}from "../../helpers/webullClient";
import {schema}from "./live-order_POST.schema";

export async function handle(request:Request){
 try{
  const user=await apiUser(request);
  const membership=await effectiveMembership(user.id,user.role==="admin");
  if(!membership.accessActive||membership.tier==="scout")throw new ApiError(403,"Copilot or Autopilot access is required for live Webull.");
  const input=schema.parse(superjson.parse(await request.text()));
  const keys=await liveUserKeys(user);
  const snapshot=await webullLiveSnapshot(keys,input.accountId);
  if(input.side==="SELL"){
    const held=Number(snapshot.positions.find(p=>p.symbol.toUpperCase()===input.symbol)?.quantity??0);
    if(!Number.isFinite(held)||held<=0)throw new ApiError(409,"No live long position is available to sell. TradeCUE live mode does not open shorts.");
    if(input.quantity>held+0.000001)throw new ApiError(409,"SELL quantity exceeds the live position. TradeCUE live mode does not open shorts.");
  }
  const order:PaperOrderInput={accountId:input.accountId,symbol:input.symbol,side:input.side,orderType:input.orderType,quantity:input.quantity,limitPrice:input.limitPrice};
  const preview=await previewWebullLiveOrder(keys,order);
  if(input.action==="preview"){
    await db.insertInto("cueAuditLog").values({userId:user.id,action:"webull_live_order_preview",entityType:"live_order",entityId:preview.clientOrderId,details:{symbol:input.symbol,side:input.side,orderType:input.orderType,quantity:input.quantity,limitPrice:input.limitPrice??null}}).execute();
    return apiJson({mode:"LIVE" as const,action:"preview" as const,clientOrderId:preview.clientOrderId,response:preview.response});
  }
  const placed=await placeWebullLiveOrder(keys,order,preview.clientOrderId);
  await db.insertInto("cueAuditLog").values({userId:user.id,action:"webull_live_order_submitted",entityType:"live_order",entityId:placed.clientOrderId,details:{symbol:input.symbol,side:input.side,orderType:input.orderType,quantity:input.quantity,limitPrice:input.limitPrice??null}}).execute();
  return apiJson({mode:"LIVE" as const,action:"placed" as const,clientOrderId:placed.clientOrderId,response:placed.response});
 }catch(e){return apiFailure(e);}
}
