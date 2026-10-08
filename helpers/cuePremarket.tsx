import { db } from "./db";
import { activeCueUsers,pushUser,saveDailyOutlook,scanForBrain,serverMacroRisk,shortOutlookBody } from "./cueBrainShared";
import { omegaHealthLabel,omegaHealthScore } from "./omegaStrategy";

export async function cuePremarket(){
  const users=await activeCueUsers();
  const macro=await serverMacroRisk();
  for(const user of users){
    try{
      const controls=await db.selectFrom("cueAutomationControls").selectAll().where("userId","=",user.id).executeTakeFirst();
      if(controls&&!controls.brainEnabled)continue;
      const scan=await scanForBrain(user);
      const risk=await db.selectFrom("riskProfiles").select(["maxRiskPerTrade","maxDailyLoss","maxTradesPerDay"]).where("userId","=",user.id).executeTakeFirst();
      const freshRows=scan.rows.filter(row=>row.fresh);
      const subsystems={
        execution:Boolean(controls?.autoPaperEnabled&&!controls?.killSwitch),
        data:freshRows.length>0,
        scanner:scan.rows.length>0,
        strategy:scan.rows.some(row=>row.cueScore!=null),
        risk:Boolean(risk&&Number(risk.maxRiskPerTrade)>0&&Number(risk.maxDailyLoss)>0&&Number(risk.maxTradesPerDay)>0),
        reporting:true,
      };
      const healthScore=omegaHealthScore(subsystems);
      const healthLabel=omegaHealthLabel(healthScore);
      const outlook=await saveDailyOutlook(user,"premarket",scan,macro.state);
      await pushUser(user.id,"Omega Premarket · "+healthScore+"/100 "+healthLabel,shortOutlookBody(outlook),"cue-premarket");
      await db.insertInto("cueAuditLog").values({
        userId:user.id,action:"cue_premarket_generated",entityType:"daily_outlook",entityId:null,
        details:{bias:outlook.bias,watch:outlook.watch,macro:macro.state,healthScore,healthLabel,subsystems},
      }).execute();
      await db.insertInto("cueReliabilitySnapshots").values({
        userId:user.id,service:"omega-premarket-audit",
        status:healthScore>90?"OK":healthScore>=75?"WARN":"ERROR",
        message:"Premarket audit "+healthScore+"/100 "+healthLabel,
        details:{healthScore,healthLabel,subsystems,marketMode:scan.marketMode,watch:outlook.watch},
      }).execute();
    }catch(error){
      const message=error instanceof Error?error.message:"Premarket brain failed.";
      if(message.includes("Connect your own Webull PaperTrade")){
        await db.insertInto("cueAuditLog").values({userId:user.id,action:"cue_premarket_skipped_no_broker",entityType:"daily_outlook",entityId:null,details:{}}).execute();
        continue;
      }
      await db.insertInto("cueReliabilitySnapshots").values({
        userId:user.id,service:"premarket-brain",status:"ERROR",message,details:{},
      }).execute();
    }
  }
}