import {sql} from "kysely";
import {apiUser,apiJson,apiFailure} from "../../helpers/apiAccess";
import {db} from "../../helpers/db";
import {syncJournalForUser,rebuildLearningForUser} from "../../helpers/cueJournalBrain";
export async function handle(request:Request){
 try{
  const session=await apiUser(request);
  const user=await db.selectFrom("users").select(["id","role","displayName","email"]).where("id","=",session.id).executeTakeFirstOrThrow();
  return await db.transaction().execute(async trx=>{
   const key="journal-sync:"+user.id;
   await sql`select pg_advisory_xact_lock(hashtextextended(${key},0))`.execute(trx);
   const previous=await trx.selectFrom("appSettings").selectAll().where("key","=",key).executeTakeFirst();
   if(previous&&Date.now()-new Date(previous.updatedAt).getTime()<120_000)
    return apiJson({ok:true,syncedAt:new Date(previous.updatedAt).toISOString(),cached:true,summary:previous.value});
   // Reads broker evidence and updates the journal only. Never submits or cancels orders.
   const summary=await syncJournalForUser(user);
   await rebuildLearningForUser(user.id);
   const now=new Date();
   await trx.insertInto("appSettings").values({key,value:summary,updatedAt:now}).onConflict(oc=>oc.column("key").doUpdateSet({value:summary,updatedAt:now})).execute();
   return apiJson({ok:true,syncedAt:now.toISOString(),cached:false,summary});
  });
 }catch(error){return apiFailure(error);}
}
