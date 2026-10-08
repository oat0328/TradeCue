import { db } from "./db";
import { activeCueUsers } from "./cueBrainShared";
import { evaluateExitGuard } from "./exitGuardServer";
import { executePaperOrder } from "./paperOrderService";
import { userKeys,webullSnapshot } from "./webullClient";

function dayKey(){
  return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Los_Angeles",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()).replace(/-/g,"");
}

export async function cueOpenCleanup(){
  const users=await activeCueUsers();
  for(const basic of users){
    try{
      const controls=await db.selectFrom("cueAutomationControls").select(["brainEnabled","autoPaperEnabled","killSwitch"]).where("userId","=",basic.id).executeTakeFirst();
      if(!controls?.brainEnabled||!controls.autoPaperEnabled||controls.killSwitch)continue;
      const user=await db.selectFrom("users").select(["id","role","email","displayName","avatarUrl"]).where("id","=",basic.id).executeTakeFirst();
      if(!user)continue;
      const keys=await userKeys(user);
      const snapshot=await webullSnapshot(keys);
      const guard=await evaluateExitGuard(user.id,keys,snapshot.selectedAccountId);
      const cleanup=guard.rows.find(row=>row.alert&&row.heldQty>0&&["none","residual"].includes(row.state));
      if(!cleanup)continue;
      const quantity=Math.round(cleanup.heldQty*1e6)/1e6;
      const qtyKey=String(quantity).replace(".","p");
      await executePaperOrder(user,{
        accountId:snapshot.selectedAccountId,
        symbol:cleanup.symbol,
        side:"SELL",
        orderType:"MARKET",
        quantity,
        confirmPaper:true,
        intentId:["open-clean",user.id,cleanup.symbol,dayKey(),qtyKey].join("-"),
        purpose:"auto-cleanup",
      });
      await db.insertInto("cueAuditLog").values({
        userId:user.id,action:"cue_open_cleanup_submitted",entityType:"paper_order",entityId:cleanup.symbol,
        details:{symbol:cleanup.symbol,quantity,state:cleanup.state},
      }).execute();
    }catch(error){
      await db.insertInto("cueReliabilitySnapshots").values({
        userId:basic.id,service:"open-cleanup",status:"ERROR",
        message:error instanceof Error?error.message:"Open cleanup failed.",details:{},
      }).execute();
    }
  }
}
