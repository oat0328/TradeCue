import {apiUser,apiJson,apiFailure}from "../../helpers/apiAccess";
import {db}from "../../helpers/db";
export async function handle(request:Request){
 try{
  const user=await apiUser(request);
  await db.updateTable("brokerConnections").set({status:"disconnected",metadata:{},updatedAt:new Date()}).where("userId","=",user.id).where("provider","=","webull").where("isPaper","=",false).execute();
  await db.insertInto("cueAuditLog").values({userId:user.id,action:"webull_live_disconnected",entityType:"broker_connection",details:{environment:"live"}}).execute();
  return apiJson({disconnected:true as const});
 }catch(e){return apiFailure(e);}
}
