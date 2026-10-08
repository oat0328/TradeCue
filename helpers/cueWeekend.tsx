import { db } from "./db";
import { activeCueUsers,pushUser,saveDailyOutlook,scanForBrain,serverMacroRisk,shortOutlookBody } from "./cueBrainShared";

export async function cueWeekend(){
  const users=await activeCueUsers();
  const macro=await serverMacroRisk();
  for(const user of users){
    try{
      const controls=await db.selectFrom("cueAutomationControls").selectAll().where("userId","=",user.id).executeTakeFirst();
      if(controls&&!controls.brainEnabled)continue;
      const scan=await scanForBrain(user);
      const outlook=await saveDailyOutlook(user,"weekend",scan,macro.state);
      await pushUser(user.id,"CUE Next-Session Prep · "+outlook.bias,shortOutlookBody(outlook),"cue-weekend");
    }catch(error){
      const message=error instanceof Error?error.message:"Weekend brain failed.";
      if(message.includes("Connect your own Webull PaperTrade")){
        await db.insertInto("cueAuditLog").values({userId:user.id,action:"cue_weekend_skipped_no_broker",entityType:"daily_outlook",entityId:null,details:{}}).execute();
        continue;
      }
      await db.insertInto("cueReliabilitySnapshots").values({
        userId:user.id,service:"weekend-brain",status:"ERROR",message,details:{},
      }).execute();
    }
  }
}