import { db } from "./db";
import { activeCueUsers,pushUser,saveDailyOutlook,scanForBrain,serverMacroRisk } from "./cueBrainShared";
import { rebuildLearningForUser,syncJournalForUser } from "./cueJournalBrain";

export async function cuePostmarket(){
  const users=await activeCueUsers();
  const macro=await serverMacroRisk();
  for(const user of users){
    try{
      const controls=await db.selectFrom("cueAutomationControls").selectAll().where("userId","=",user.id).executeTakeFirst();
      if(controls&&!controls.brainEnabled)continue;
      const journal=await syncJournalForUser(user);
      const learning=await rebuildLearningForUser(user.id);
      const scan=await scanForBrain(user);
      const outlook=await saveDailyOutlook(user,"postmarket",scan,macro.state);
      const recentClosed=await db.selectFrom("cueTradeJournal")
        .select(["symbol","setup","realizedPnl","realizedR","exitTime"])
        .where("userId","=",user.id).where("status","=","closed")
        .orderBy("exitTime","desc").limit(100).execute();
      const today=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Los_Angeles",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
      const dayTrades=recentClosed.filter(row=>row.exitTime&&new Intl.DateTimeFormat("en-CA",{timeZone:"America/Los_Angeles",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(row.exitTime))===today);
      const dayWins=dayTrades.filter(row=>Number(row.realizedPnl??0)>0).length;
      const dayLosses=dayTrades.filter(row=>Number(row.realizedPnl??0)<0).length;
      const dayPnl=dayTrades.reduce((sum,row)=>sum+Number(row.realizedPnl??0),0);
      const bestTrade=[...dayTrades].sort((a,b)=>Number(b.realizedPnl??0)-Number(a.realizedPnl??0))[0]??null;
      const worstTrade=[...dayTrades].sort((a,b)=>Number(a.realizedPnl??0)-Number(b.realizedPnl??0))[0]??null;
      const dayMetrics={
        trades:dayTrades.length,wins:dayWins,losses:dayLosses,
        winRate:dayTrades.length?dayWins/dayTrades.length*100:null,
        pnl:dayPnl,
        bestTrade:bestTrade?{symbol:bestTrade.symbol,pnl:Number(bestTrade.realizedPnl??0),setup:bestTrade.setup}:null,
        worstTrade:worstTrade?{symbol:worstTrade.symbol,pnl:Number(worstTrade.realizedPnl??0),setup:worstTrade.setup}:null,
      };
      const pnl=scan.dayPnl==null?"P/L unavailable":(scan.dayPnl>=0?"+$":"-$")+Math.abs(scan.dayPnl).toFixed(2);
      const body=pnl+" today · "+dayMetrics.trades+" resolved · "+
        (dayMetrics.winRate==null?"win rate unavailable":dayMetrics.winRate.toFixed(1)+"% win rate")+" · "+
        (learning.profitFactor==null?"profit factor building":"PF "+learning.profitFactor.toFixed(2))+
        ". Next watch: "+(outlook.watch.join(", ")||"none yet")+".";
      await pushUser(user.id,"Omega Daily Report",body,"cue-postmarket");
      await db.insertInto("cueAuditLog").values({
        userId:user.id,action:"cue_postmarket_generated",entityType:"daily_outlook",entityId:null,
        details:{dayPnl:scan.dayPnl,journal,learning,dayMetrics,bias:outlook.bias,watch:outlook.watch},
      }).execute();
    }catch(error){
      const message=error instanceof Error?error.message:"Postmarket brain failed.";
      if(message.includes("Connect your own Webull PaperTrade")){
        await db.insertInto("cueAuditLog").values({userId:user.id,action:"cue_postmarket_skipped_no_broker",entityType:"daily_outlook",entityId:null,details:{}}).execute();
        continue;
      }
      await db.insertInto("cueReliabilitySnapshots").values({
        userId:user.id,service:"postmarket-brain",status:"ERROR",message,details:{},
      }).execute();
    }
  }
}