import superjson from "superjson";
import { apiUser,apiJson,apiFailure } from "../../helpers/apiAccess";
import { db } from "../../helpers/db";
import { schema } from "./decision_POST.schema";

export async function handle(request:Request){
  try{
    const user=await apiUser(request);
    const input=schema.parse(superjson.parse(await request.text()));
    const last=await db.selectFrom("cueAuditLog")
      .select(["action","createdAt","details"])
      .where("userId","=",user.id).where("entityType","=","cue_decision").where("entityId","=",input.symbol)
      .orderBy("createdAt","desc").limit(1).executeTakeFirst();
    const recent=last&&(Date.now()-new Date(last.createdAt).getTime())<5*60*1000;
    const same=recent&&last.action==="cue_decision_"+input.action.toLowerCase()&&
      typeof last.details==="object"&&last.details!==null&&!Array.isArray(last.details)&&
      (last.details as any).timeframe===input.timeframe;
    if(same)return apiJson({ok:true,logged:false});
    await db.insertInto("cueAuditLog").values({
      userId:user.id,action:"cue_decision_"+input.action.toLowerCase(),entityType:"cue_decision",entityId:input.symbol,
      details:{timeframe:input.timeframe,score:input.score,price:input.price,structure:input.structure,plan:input.plan},
    }).execute();
    return apiJson({ok:true,logged:true});
  }catch(error){return apiFailure(error);}
}