import superjson from "superjson";
import {apiUser,apiJson,apiFailure,ApiError}from "../../helpers/apiAccess";
import {db}from "../../helpers/db";
import {setAdminAccessState}from "../../helpers/adminUserAccess";
import {schema}from "./member-control_POST.schema";

export async function handle(request:Request){
 try{
  const admin=await apiUser(request,true);
  const input=schema.parse(superjson.parse(await request.text()));
  const target=await db.selectFrom("users").select(["id","role"]).where("id","=",input.userId).executeTakeFirst();
  if(!target)throw new ApiError(404,"Member not found.");
  if((input.action==="end_access"||input.action==="restore_access")&&target.role==="admin")throw new ApiError(403,"Owner access cannot be ended from member controls.");
  if(target.role==="admin"&&target.id!==admin.id)throw new ApiError(403,"Owner automation controls must be managed from that owner's own workstation.");
  if(input.action==="end_access"){
    await setAdminAccessState(input.userId,{suspended:true,reason:"Ended by owner",updatedBy:admin.id});
    const current=await db.selectFrom("cueAutomationControls").selectAll().where("userId","=",input.userId).executeTakeFirst();
    await db.insertInto("cueAutomationControls").values({
      userId:input.userId,brainEnabled:false,autoPaperEnabled:false,killSwitch:true,
      maxAutoPositions:current?.maxAutoPositions??3,perTradeBudget:Number(current?.perTradeBudget??500),updatedAt:new Date(),
    }).onConflict(oc=>oc.column("userId").doUpdateSet({brainEnabled:false,autoPaperEnabled:false,killSwitch:true,updatedAt:new Date()})).execute();
    await db.deleteFrom("sessions").where("userId","=",input.userId).execute();
    await db.insertInto("cueAuditLog").values({
      userId:input.userId,action:"admin_access_ended",entityType:"user",entityId:String(input.userId),details:{changedBy:admin.id},
    }).execute();
    await db.insertInto("cueAuditLog").values({
      userId:admin.id,action:"member_access_ended",entityType:"user",entityId:String(input.userId),details:{},
    }).execute();
    return apiJson({updated:true as const,action:input.action});
  }
  if(input.action==="restore_access"){
    await setAdminAccessState(input.userId,{suspended:false,reason:null,updatedBy:admin.id});
    await db.insertInto("cueAuditLog").values({
      userId:input.userId,action:"admin_access_restored",entityType:"user",entityId:String(input.userId),details:{changedBy:admin.id},
    }).execute();
    await db.insertInto("cueAuditLog").values({
      userId:admin.id,action:"member_access_restored",entityType:"user",entityId:String(input.userId),details:{},
    }).execute();
    return apiJson({updated:true as const,action:input.action});
  }
  const current=await db.selectFrom("cueAutomationControls").selectAll().where("userId","=",input.userId).executeTakeFirst();
  const next=input.action==="pause_axiom"
    ?{brainEnabled:false,autoPaperEnabled:false,killSwitch:true}
    :{brainEnabled:current?.brainEnabled??true,autoPaperEnabled:false,killSwitch:false};
  await db.insertInto("cueAutomationControls").values({
    userId:input.userId,
    brainEnabled:next.brainEnabled,autoPaperEnabled:next.autoPaperEnabled,killSwitch:next.killSwitch,
    maxAutoPositions:current?.maxAutoPositions??3,perTradeBudget:Number(current?.perTradeBudget??500),updatedAt:new Date(),
  }).onConflict(oc=>oc.column("userId").doUpdateSet({...next,updatedAt:new Date()})).execute();
  await db.insertInto("cueAuditLog").values({
    userId:input.userId,action:input.action==="pause_axiom"?"admin_axiom_paused":"admin_axiom_unlocked",entityType:"automation",entityId:String(input.userId),details:{changedBy:admin.id},
  }).execute();
  await db.insertInto("cueAuditLog").values({
    userId:admin.id,action:input.action==="pause_axiom"?"member_axiom_paused":"member_axiom_unlocked",entityType:"user",entityId:String(input.userId),details:{},
  }).execute();
  return apiJson({updated:true as const,action:input.action});
 }catch(e){return apiFailure(e);}
}
