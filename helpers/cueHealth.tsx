import { db } from "./db";
import { activeCueUsers,pushUser } from "./cueBrainShared";
import { userKeys,webullRead,webullSnapshot } from "./webullClient";
import { webullBars } from "./webullBars";

export async function cueHealth(){
  const users=await activeCueUsers();
  for(const user of users){
    const controls=await db.selectFrom("cueAutomationControls").selectAll().where("userId","=",user.id).executeTakeFirst();
    if(controls&&!controls.brainEnabled)continue;
    const started=Date.now();
    try{
      const keys=await userKeys(user);
      const snapshot=await webullSnapshot(keys);
      const raw=await webullRead(keys,"/market-data/stocks/bars/list",{},{
        symbols:["SPY"],category:"US_STOCK",timespan:"M5",count:"40",real_time_required:false,trading_sessions:"PRE,RTH,ATH",
      });
      const bars=webullBars(raw);
      const latest=bars.at(-1)?.time??null;
      const ok=Boolean(snapshot.selectedAccountId&&bars.length>=30);
      await db.insertInto("cueReliabilitySnapshots").values({
        userId:user.id,
        service:"morning-readiness",
        status:ok?"OK":"DEGRADED",
        latencyMs:Date.now()-started,
        message:ok?"Webull account and chart data are reachable.":"Account or chart data is incomplete.",
        details:{accountId:snapshot.selectedAccountId,bars:bars.length,latest},
      }).execute();
      if(!ok)await pushUser(user.id,"CUE readiness warning","TradeCUE health check found incomplete broker or market data. Open the workstation before trading.","cue-health-warning");
    }catch(error){
      const message=error instanceof Error?error.message:"CUE health check failed.";
      await db.insertInto("cueReliabilitySnapshots").values({
        userId:user.id,service:"morning-readiness",status:"ERROR",latencyMs:Date.now()-started,message,details:{},
      }).execute();
      await pushUser(user.id,"CUE readiness failed",message,"cue-health-failed");
    }
  }
}