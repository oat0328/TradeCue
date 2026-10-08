import superjson from "superjson";
import { apiUser,apiJson,apiFailure } from "../../helpers/apiAccess";
import { db } from "../../helpers/db";
import { schema } from "./control_POST.schema";

export async function handle(request:Request){
  try{
    const user=await apiUser(request);
    const input=schema.parse(superjson.parse(await request.text()));
    const current=await db.selectFrom("cueAutomationControls").selectAll().where("userId","=",user.id).executeTakeFirst();
    const next={
      userId:user.id,
      brainEnabled:input.brainEnabled??current?.brainEnabled??true,
      autoPaperEnabled:input.autoPaperEnabled??current?.autoPaperEnabled??false,
      killSwitch:input.killSwitch??current?.killSwitch??false,
      maxAutoPositions:input.maxAutoPositions??current?.maxAutoPositions??3,
      perTradeBudget:input.perTradeBudget??Number(current?.perTradeBudget??500),
      updatedAt:new Date(),
    };
    await db.insertInto("cueAutomationControls").values(next)
      .onConflict(oc=>oc.column("userId").doUpdateSet({
        brainEnabled:next.brainEnabled,
        autoPaperEnabled:next.autoPaperEnabled,
        killSwitch:next.killSwitch,
        maxAutoPositions:next.maxAutoPositions,
        perTradeBudget:next.perTradeBudget,
        updatedAt:next.updatedAt,
      })).execute();
    await db.insertInto("cueAuditLog").values({
      userId:user.id,
      action:"automation_control_updated",
      entityType:"automation",
      entityId:String(user.id),
      details:next as any,
    }).execute();
    return apiJson({ok:true});
  }catch(error){return apiFailure(error);}
}