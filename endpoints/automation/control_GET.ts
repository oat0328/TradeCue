import { apiUser,apiJson,apiFailure } from "../../helpers/apiAccess";
import { db } from "../../helpers/db";

export async function handle(request:Request){
  try{
    const user=await apiUser(request);
    const row=await db.selectFrom("cueAutomationControls").selectAll().where("userId","=",user.id).executeTakeFirst();
    if(!row){
      await db.insertInto("cueAutomationControls").values({
        userId:user.id,
        brainEnabled:true,
        autoPaperEnabled:false,
        killSwitch:false,
        maxAutoPositions:3,
        perTradeBudget:500,
        updatedAt:new Date(),
      }).onConflict(oc=>oc.column("userId").doNothing()).execute();
    }
    const value=row??{
      brainEnabled:true,autoPaperEnabled:false,killSwitch:false,maxAutoPositions:3,perTradeBudget:"500",updatedAt:new Date(),
    };
    return apiJson({
      brainEnabled:Boolean(value.brainEnabled),
      autoPaperEnabled:Boolean(value.autoPaperEnabled),
      killSwitch:Boolean(value.killSwitch),
      maxAutoPositions:Number(value.maxAutoPositions??3),
      perTradeBudget:Number(value.perTradeBudget??500),
      updatedAt:new Date(value.updatedAt).toISOString(),
    });
  }catch(error){return apiFailure(error);}
}