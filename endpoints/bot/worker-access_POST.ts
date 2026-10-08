import superjson from "superjson";
import { apiUser,apiJson,apiFailure } from "../../helpers/apiAccess";
import { db } from "../../helpers/db";
import { newWorkerToken,workerTokenHash } from "../../helpers/workerToken";
import { schema } from "./worker-access_POST.schema";
export async function handle(request:Request){
  try{
    const user=await apiUser(request,true);
    const input=schema.parse(superjson.parse(await request.text()));
    if(input.action==="revoke"){
      await db.updateTable("cueWorkerAccess").set({enabled:false,paperExecutionEnabled:false,updatedAt:new Date()}).where("userId","=",user.id).execute();
      return apiJson({enabled:false,paperExecutionEnabled:false});
    }
    const token=newWorkerToken();
    const values={userId:user.id,tokenHash:workerTokenHash(token),enabled:true,paperExecutionEnabled:input.paperExecutionEnabled,updatedAt:new Date()};
    await db.insertInto("cueWorkerAccess").values(values).onConflict(oc=>oc.column("userId").doUpdateSet(values)).execute();
    await db.insertInto("cueAuditLog").values({userId:user.id,action:"worker_access_rotated",entityType:"worker",details:{paperExecutionEnabled:input.paperExecutionEnabled}}).execute();
    return apiJson({enabled:true,paperExecutionEnabled:input.paperExecutionEnabled,token});
  }catch(error){return apiFailure(error);}
}
