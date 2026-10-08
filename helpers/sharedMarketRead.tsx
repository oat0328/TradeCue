import { createHash } from "node:crypto";
import { sql } from "kysely";
import { db } from "./db";
import { ApiError } from "./apiAccess";
import type { Json } from "./schema";
// Only market data: never cache or replay order placement/cancellation.
export async function sharedMarketRead(appKey:string,path:string,query:unknown,body:unknown,ttl:number,worker:()=>Promise<unknown>):Promise<any>{
 const hash=(s:string)=>createHash("sha256").update(s).digest("hex");
 const poolKey=hash(appKey+"|"+path);
 const requestKey=hash(appKey+"|"+path+"|"+JSON.stringify(query)+"|"+JSON.stringify(body));
 return db.transaction().execute(async trx=>{
  await sql`select pg_advisory_xact_lock(hashtextextended(${"market:"+poolKey},0))`.execute(trx);
  const cached=await trx.selectFrom("webullMarketCache").selectAll().where("requestKey","=",requestKey).executeTakeFirst();
  if(cached&&new Date(cached.expiresAt).getTime()>Date.now())return cached.payload;
  const limit=await trx.selectFrom("webullMarketLimits").selectAll().where("poolKey","=",poolKey).executeTakeFirst();
  const wait=limit?new Date(limit.nextAt).getTime()-Date.now():0;
  if(wait>5000)return { __marketError: "Market-data provider rate limit cooling down. Fresh data is unavailable; retry shortly." };
  if(wait>0)await new Promise(r=>setTimeout(r,wait));
  let payload:unknown;
  try{payload=await worker();}
  catch(error){
   const message=error instanceof Error?error.message:"Market feed unavailable";
   const cooling=/TOO_MANY_REQUESTS|429/i.test(message);
   await trx.insertInto("webullMarketLimits").values({poolKey,nextAt:new Date(Date.now()+(cooling?60_000:3000))}).onConflict(oc=>oc.column("poolKey").doUpdateSet({nextAt:new Date(Date.now()+(cooling?60_000:3000))})).execute();
   return {__marketError:message};
  }
  await trx.insertInto("webullMarketLimits").values({poolKey,nextAt:new Date(Date.now()+3000)}).onConflict(oc=>oc.column("poolKey").doUpdateSet({nextAt:new Date(Date.now()+3000)})).execute();
  await trx.insertInto("webullMarketCache").values({requestKey,payload:payload as Json,expiresAt:new Date(Date.now()+Math.max(ttl,10_000))}).onConflict(oc=>oc.column("requestKey").doUpdateSet({payload:payload as Json,expiresAt:new Date(Date.now()+Math.max(ttl,10_000))})).execute();
  return payload;
 }).then(result=>{if(result&&typeof result==="object"&&"__marketError" in result)throw new ApiError(503,String(result.__marketError));return result;});
}
