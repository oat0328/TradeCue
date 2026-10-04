import superjson from "superjson";
import {apiUser,apiJson,apiFailure,ApiError} from "../../helpers/apiAccess";
import {db} from "../../helpers/db";
import {effectiveMembership} from "../../helpers/effectiveMembership";
import {webullAccounts} from "../../helpers/webullClient";
import {encryptBrokerSecret} from "../../helpers/brokerCrypto";
import {schema} from "./keys_POST.schema";
export async function handle(request:Request){try{
 const user=await apiUser(request);const m=await effectiveMembership(user.id,user.role==="admin");
 if(!m.accessActive||m.tier==="scout")throw new ApiError(403,"Copilot or Autopilot access is required.");
 const keys=schema.parse(superjson.parse(await request.text()));
 const accounts=await webullAccounts(keys);if(!accounts.length)throw new ApiError(409,"No sandbox accounts returned. Activate your Webull paper account first.");
 await db.transaction().execute(async trx=>{
 await trx.insertInto("webullCredentials").values({userId:user.id,appKeyEncrypted:encryptBrokerSecret(keys.appKey),appSecretEncrypted:encryptBrokerSecret(keys.appSecret)})
 .onConflict(oc=>oc.column("userId").doUpdateSet({appKeyEncrypted:encryptBrokerSecret(keys.appKey),appSecretEncrypted:encryptBrokerSecret(keys.appSecret),verifiedAt:new Date()})).execute();
 await trx.insertInto("cueAuditLog").values({userId:user.id,action:"webull_paper_keys_connected",entityType:"broker_connection",details:{environment:"sandbox",accountCount:accounts.length}}).execute();
 });return apiJson({connected:true,accountCount:accounts.length});
}catch(e){return apiFailure(e);}}

