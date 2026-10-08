import { apiUser,apiJson,apiFailure } from "../../helpers/apiAccess";
import { db } from "../../helpers/db";
import { saveDailyOutlook,scanForBrain,serverMacroRisk,type CueBrainUser } from "../../helpers/cueBrainShared";
export async function handle(request:Request){
  try{
    const user=await apiUser(request);
    const record=await db.selectFrom("users").select(["id","role","displayName","email"]).where("id","=",user.id).executeTakeFirstOrThrow();
    const scan=await scanForBrain(record as CueBrainUser);
    const macro=await serverMacroRisk();
    const type=scan.marketMode==="WEEKEND_PREP"||scan.marketMode==="OVERNIGHT"?"weekend":scan.marketMode==="AFTER_HOURS"?"postmarket":"premarket";
    const outlook=await saveDailyOutlook(record as CueBrainUser,type,scan,macro.state);
    await db.insertInto("cueAuditLog").values({
      userId:user.id,action:"cue_brain_manual_refresh",entityType:"daily_outlook",entityId:null,
      details:{bias:outlook.bias,watch:outlook.watch,marketMode:scan.marketMode,macro:macro.state},
    }).execute();
    return apiJson({ok:true,bias:outlook.bias,headline:outlook.headline,watch:outlook.watch,marketMode:scan.marketMode});
  }catch(error){return apiFailure(error);}
}