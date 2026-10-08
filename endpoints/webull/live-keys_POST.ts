import superjson from "superjson";
import {apiUser,apiJson,apiFailure,ApiError}from "../../helpers/apiAccess";
import {db}from "../../helpers/db";
import {effectiveMembership}from "../../helpers/effectiveMembership";
import {encryptBrokerSecret}from "../../helpers/brokerCrypto";
import {webullAccounts}from "../../helpers/webullClient";
import {schema}from "./live-keys_POST.schema";

export async function handle(request:Request){
 try{
  const user=await apiUser(request);
  const membership=await effectiveMembership(user.id,user.role==="admin");
  if(!membership.accessActive||membership.tier==="scout")throw new ApiError(403,"Copilot or Autopilot access is required.");
  const keys=schema.parse(superjson.parse(await request.text()));
  const accounts=await webullAccounts(keys,"live");
  if(!accounts.length)throw new ApiError(409,"Webull Production returned no live trading accounts. Confirm Production OpenAPI approval and keys.");
  const first=accounts[0];
  const metadata={encryptedAppKey:encryptBrokerSecret(keys.appKey),encryptedAppSecret:encryptBrokerSecret(keys.appSecret),credentialType:"openapi-aksk"};
  const existing=await db.selectFrom("brokerConnections").select(["id"]).where("userId","=",user.id).where("provider","=","webull").where("isPaper","=",false).executeTakeFirst();
  const values={
    status:"connected" as const,
    externalAccountId:first.accountId,
    accountMask:first.accountMask,
    accountType:first.accountType,
    isPaper:false,
    scopes:["trading","account"],
    connectedAt:new Date(),
    lastSyncedAt:new Date(),
    updatedAt:new Date(),
    metadata,
  };
  if(existing)await db.updateTable("brokerConnections").set(values).where("id","=",existing.id).execute();
  else await db.insertInto("brokerConnections").values({userId:user.id,provider:"webull",...values}).execute();
  await db.insertInto("cueAuditLog").values({userId:user.id,action:"webull_live_connected",entityType:"broker_connection",entityId:first.accountId,details:{environment:"live",accountCount:accounts.length,accountType:first.accountType}}).execute();
  return apiJson({connected:true,accountCount:accounts.length,accountMask:first.accountMask,accountType:first.accountType});
 }catch(e){return apiFailure(e);}
}
