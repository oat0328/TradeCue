import superjson from "superjson";
import { sql } from "kysely";
import { db } from "./db";
import { apiUser,ApiError } from "./apiAccess";
import { userKeys,webullSnapshot,webullTodayOrders,cancelWebullPaperOrder } from "./webullClient";
import { stockMarketMode,autoEntryTiming,afterPacificFlatTime } from "./marketClock";
import { scanForBrain } from "./cueBrainShared";
import { serverMacroRisk } from "./macroRiskServer";
import { evaluateExitGuard,ptDayKey } from "./exitGuardServer";
import { executePaperOrder } from "./paperOrderService";
import { positionMonitorForUser } from "./positionMonitorServer";
import { adaptivePaperEntryLimit,autoPaperQuantity,isWorkingPaperOrder } from "./autoPaperRules";
import { autoIntentId } from "./paperOrderIntent";
import { cueTrainingGate } from "./trainingGate";
import { syncJournalForUser,rebuildLearningForUser } from "./cueJournalBrain";
import {omegaHealthForUser} from "./omegaHealthForUser";
import {omegaJournalMark} from "./omegaJournalMark";
import {omegaSkipTraining} from "./omegaSkipTraining";
import {publish} from "@floot/realtime";
import {channels} from "./realtimeChannels";
import type { Json } from "./schema";
import {omegaDailyObjective} from "./omegaDailyObjective";
import {omegaMonthlyObjective} from "./omegaMonthlyObjective";
import {omegaHuntRanking} from "./omegaHuntRanking";
import {omegaEntryPlan} from "./omegaEntryPlan";
import {reconcileOmegaAccount} from "./omegaReconciliationServer";
import {compareOmegaOpportunities,omegaPortfolioRoom} from "./omegaOpportunityComparison";
import {OMEGA_CURRICULUM_VERSION} from "./omegaCurriculum";

type User=Awaited<ReturnType<typeof apiUser>>;
type Result={status:string;message:string;action?:unknown;checkedAt:string};
async function submit(user:User,input:unknown,dryRun:boolean):Promise<Result>{
  if(dryRun)return {status:"OBSERVING",message:"Qualified paper action found; observe-only mode does not submit it.",action:input,checkedAt:new Date().toISOString()};
  const access=await db.selectFrom("cueWorkerAccess").select(["enabled","paperExecutionEnabled"]).where("userId","=",user.id).executeTakeFirst();
  if(!access?.enabled||!access.paperExecutionEnabled)throw new ApiError(409,"Worker execution access is disabled; no paper order sent.");
  const response=await executePaperOrder(user,input);
  const result=superjson.parse<any>(await response.text());
  if(!response.ok)throw new ApiError(response.status,result.error??"Paper action was blocked.");
  return {status:"PAPER_SUBMITTED",message:"Paper order submitted or reconciled. A broker fill is not yet confirmed.",action:result,checkedAt:new Date().toISOString()};
}
export async function runOmegaWorker(user:User,dryRun:boolean):Promise<Result>{
  try{
    const output=await db.transaction().execute(async trx=>{
      const lock=await sql<{acquired:boolean}>`select pg_try_advisory_xact_lock(hashtextextended(${"axiom:worker:"+user.id},0)) as acquired`.execute(trx);
      if(!lock.rows[0]?.acquired)return {status:"BUSY",message:"Another worker tick is in progress.",checkedAt:new Date().toISOString(),nextCheckMs:30000};
      const startedAt=new Date();
      const previous=await trx.selectFrom("cueWorkerState").select(["lastAction"]).where("userId","=",user.id).executeTakeFirst();
      const old=(previous?.lastAction??{}) as any;
      let scan:Awaited<ReturnType<typeof scanForBrain>>|null=old.scan??null;
      let lastScanAt:number=Number(old.lastScanAt??0);
      const scanIntervalMs=stockMarketMode()==="RTH"?60000:120000;
      let scanError:string|null=null;
      let health:Awaited<ReturnType<typeof omegaHealthForUser>>|null=null;
      let brokerConnected=false;
      let reconciliation:Awaited<ReturnType<typeof reconcileOmegaAccount>>|null=null;
      let opportunityComparison:unknown=null;
      let monitorPositions:unknown[]=[];
      let journalSyncedAt=Number((previous?.lastAction as any)?.journalSyncedAt??0);
      let skipLearning=(old?.proof?.skipLearning??null) as Awaited<ReturnType<typeof omegaSkipTraining>>|null;
      const finish=async(result:Result)=>{
        const dailyGoal=omegaDailyObjective(health?.dayPnl);
        let monthlyGoal:ReturnType<typeof omegaMonthlyObjective>|null=null;
        try{
          const rows=await trx.selectFrom("cueTradeJournal").select(["realizedPnl","exitTime"])
            .where("userId","=",user.id).where("accountId","=",health?.accountId??"")
            .where("status","=","closed").where("exitTime",">=",new Date(Date.now()-40*86400000)).execute();
          if(health?.accountId)monthlyGoal=omegaMonthlyObjective(rows);
        }catch(error){console.error("Omega monthly journal unavailable",error instanceof Error?error.message:"Unknown");}
        const values={userId:user.id,startedAt,completedAt:new Date(),status:result.status,message:result.message,lastAction:JSON.parse(JSON.stringify({mode:dryRun?"OBSERVE":"PAPER",action:result.action??null,journalSyncedAt,scan,lastScanAt,proof:{
          strategyVersion:"OMEGA-26-ACCOUNT-DATA-COMPARISON",scanIntervalSeconds:scanIntervalMs/1000,scanCapacity:32,monthlyGoal,curriculumVersion:OMEGA_CURRICULUM_VERSION,learningMode:"STATISTICS_ONLY",marketState:stockMarketMode(),healthScore:health?.healthScore??null,
          criticalErrors:health?.criticalErrors??null,brokerConnection:brokerConnected?"CONNECTED":"UNCONFIRMED",
          scannerState:scanError?"ERROR":scan?"IDLE":"NOT_STARTED",scanError,lastScanTimestamp:lastScanAt?new Date(lastScanAt).toISOString():null,
          candidateCount:scan?.rows.length??null,aSetupCount:scan?.rows.filter(r=>r.setupGrade==="A").length??null,
          aPlusSetupCount:scan?.rows.filter(r=>r.setupGrade==="A+").length??null,openPositions:health?.positions??null,
          dayPnl:health?.dayPnl??null,consecutiveLosses:health?.consecutiveLosses??null,lossStop:3,
          dailyTrainingTarget:dailyGoal.target,dailyTargetRemaining:dailyGoal.remaining,dailyTargetProgress:dailyGoal.progress,dailyTargetReached:dailyGoal.reached,dailyTargetMode:dailyGoal.mode,
          drawdownPercent:health?.accountBase&&health.dayPnl!=null?Math.max(0,-health.dayPnl/health.accountBase*100):null,drawdownCapPercent:3,
          maxDailyLoss:health?.maxDailyLoss??null,healthBlockers:health?.blockers??[],protectionAlerts:health?.protectionAlerts??[],qualifiedSetupCount:scan?.rows.filter(r=>r.action==="ENTRY_READY"&&r.fresh&&r.plan).length??null,
          discoveredCandidates:scan?.rows.slice().sort(omegaHuntRanking).slice(0,8).map(row=>({
            symbol:row.symbol,
            dataAgreement:row.dataAgreement,
            action:row.action,
            setupGrade:row.setupGrade,
            setupScore12:row.setupScore12,
            confidence:row.confidence,
            fresh:row.fresh,
            entryPlan:row.plan?{entryLow:row.plan.entryLow,entryHigh:row.plan.entryHigh,stop:row.plan.stop,target:row.plan.target2}:null,
            executionAllowed:Boolean(row.action==="ENTRY_READY"&&row.fresh&&row.plan),
            reason:[...(row.omegaEvidence?.rejectedReasons??[]),...(row.flags??[]).filter(flag=>/unavailable|not |no qualifying|waiting|bearish|too extended|too far/i.test(flag))].join(" · ")||row.whyNow[0]||"Waiting for a qualifying setup.",
          }))??[],
          skipLearning,
          decision:result.message,positions:monitorPositions,reconciliation,opportunityComparison
        }})) as Json,updatedAt:new Date()};
        await trx.insertInto("cueWorkerState").values(values).onConflict(oc=>oc.column("userId").doUpdateSet(values)).execute();
        await trx.insertInto("cueAuditLog").values({userId:user.id,action:"omega_worker_decision",entityType:"omega_proof",details:JSON.parse(JSON.stringify({status:result.status,...values.lastAction as object})) as Json}).execute();
        return {...result,marketMode:stockMarketMode(),nextCheckMs:stockMarketMode()==="RTH"?30000:120000};
      };
      const result=(status:string,message:string):Result=>({status,message,checkedAt:new Date().toISOString()});
      const controls=await db.selectFrom("cueAutomationControls").selectAll().where("userId","=",user.id).executeTakeFirst();
      const armed=Boolean(controls?.autoPaperEnabled&&!controls.killSwitch);
      const keys=await userKeys(user);
      const snapshot=await webullSnapshot(keys);
      const accountId=snapshot.selectedAccountId;
      brokerConnected=true;
      const guard=await evaluateExitGuard(user.id,keys,accountId);
      if(guard.brokerReachable&&Date.now()-journalSyncedAt>=120000){
        await syncJournalForUser(user);
        await rebuildLearningForUser(user.id);
        journalSyncedAt=Date.now();
      }
      const response=await positionMonitorForUser(user,{accountId});
      const monitor=superjson.parse<any>(await response.text());
      if(!response.ok)throw new ApiError(response.status,monitor.error??"Position monitor unavailable.");
      monitorPositions=monitor.positions;
      reconciliation=await reconcileOmegaAccount(user.id,keys,snapshot);
      await omegaJournalMark(user.id,accountId,keys);
      try{health=await omegaHealthForUser(user,accountId);}catch(error){scanError=error instanceof Error?error.message:"Health unavailable";}
      if(!lastScanAt||Date.now()-lastScanAt>=scanIntervalMs){
        try{
          scan=await scanForBrain(user,32);
          lastScanAt=Date.now();
          for(const row of scan.rows){
            await trx.insertInto("cueAuditLog").values({userId:user.id,action:row.action==="ENTRY_READY"?"omega_candidate_ready":"omega_candidate_rejected",entityType:"omega_setup",entityId:row.symbol,details:JSON.parse(JSON.stringify({strategyVersion:"OMEGA-26-ACCOUNT-DATA-COMPARISON",curriculumVersion:OMEGA_CURRICULUM_VERSION,scannedAt:new Date(lastScanAt).toISOString(),row,sellTeamMode:"SHADOW_ONLY"})) as Json}).execute();
          }
          try{
            skipLearning=await omegaSkipTraining(user,keys,scan.rows,scan.marketMode);
          }catch(error){
            await trx.insertInto("cueAuditLog").values({
              userId:user.id,
              action:"omega_skip_training_error",
              entityType:"omega_skip_training",
              details:{message:error instanceof Error?error.message:"Skip training unavailable",checkedAt:new Date().toISOString()},
            }).execute();
          }
        }catch(error){scanError=error instanceof Error?error.message:"Scanner unavailable";}
      }
      if(!armed)return finish(result("DISARMED","DISARMED — observing market, positions and journal; automatic orders are off."));
      if(stockMarketMode()!=="RTH")return finish(result(guard.alerts.length?"BLOCKED":"WAITING",guard.alerts.length?"WAIT — position protection needs attention: "+guard.alerts.map(a=>a.symbol).join(", ")+". Guarded paper cleanup is evaluated at regular market hours; new buys remain blocked.":"Worker is checking in; automatic stock orders wait for regular market hours."));
      if(!guard.brokerReachable)return finish(result("BLOCKED","Broker order/protection status cannot be verified."));
      const retry=guard.rows.find(row=>row.state==="retry_ready"&&row.nextIntentId&&row.retryOfIntentId&&row.heldQty>0);
      if(retry){
        const quantity=Math.round(retry.heldQty*1e6)/1e6;
        if(quantity<=0)return finish(result("WAITING","No exit quantity remains."));
        return finish(await submit(user,{accountId,symbol:retry.symbol,side:"SELL",orderType:"MARKET",quantity,confirmPaper:true,intentId:retry.nextIntentId,purpose:"auto-exit",retryOfIntentId:retry.retryOfIntentId},dryRun));
      }
      const cleanup=guard.rows.find(row=>row.alert&&row.heldQty>0&&["none","residual"].includes(row.state));
      if(cleanup){
        const quantity=Math.round(cleanup.heldQty*1e6)/1e6;
        return finish(await submit(user,{
          accountId,
          symbol:cleanup.symbol,
          side:"SELL",
          orderType:"MARKET",
          quantity,
          confirmPaper:true,
          intentId:autoIntentId([accountId,"CLEANUP",cleanup.symbol.toUpperCase(),ptDayKey(),quantity]),
          purpose:"auto-cleanup",
        },dryRun));
      }
      const orders=await webullTodayOrders(keys,accountId);
      if(scan&&!scanError&&Date.now()-lastScanAt<scanIntervalMs){
        const stale=orders.find(order=>order.side.toUpperCase()==="BUY"&&isWorkingPaperOrder(order.status)&&!scan!.rows.some(row=>row.symbol.toUpperCase()===order.symbol.toUpperCase()&&row.action==="ENTRY_READY"&&row.fresh&&row.plan));
        if(stale){
          if(dryRun)return finish(result("OBSERVING","OBSERVE — stale paper entry would be cancelled: "+stale.symbol));
          const access=await db.selectFrom("cueWorkerAccess").selectAll().where("userId","=",user.id).executeTakeFirst();
          const latestControls=await db.selectFrom("cueAutomationControls").selectAll().where("userId","=",user.id).executeTakeFirst();
          if(!access?.enabled||!access.paperExecutionEnabled||!latestControls?.autoPaperEnabled||latestControls.killSwitch)return finish(result("DISARMED","WAIT — worker execution revoked or Omega disarmed."));
          await cancelWebullPaperOrder(keys,accountId,stale.clientOrderId);
          await db.updateTable("paperOrders").set({status:"cancel_requested",updatedAt:new Date()}).where("userId","=",user.id).where("clientOrderId","=",stale.clientOrderId).execute();
          await trx.insertInto("cueAuditLog").values({userId:user.id,action:"omega_stale_entry_cancel_requested",entityType:"paper_order",entityId:stale.clientOrderId,details:{symbol:stale.symbol,accountId}}).execute();
          return finish(result("CANCEL_REQUESTED","Stale paper entry cancellation requested for "+stale.symbol+"; broker confirmation pending."));
        }
      }
      const working=new Set(orders.filter(o=>isWorkingPaperOrder(o.status)).map(o=>o.symbol.toUpperCase()));
      const attempted=new Set(guard.rows.filter(r=>r.attempts>0).map(r=>r.symbol.toUpperCase()));
      const exit=monitor.positions.find((p:any)=>p.cue==="EXIT REVIEW"&&Number(p.quantity)>0&&!attempted.has(p.symbol.toUpperCase())&&!working.has(p.symbol.toUpperCase()));
      if(exit){
        const quantity=Math.round(Number(exit.quantity)*1e6)/1e6;
        if(quantity<=0)return finish(result("WAITING","No exit quantity remains."));
        return finish(await submit(user,{accountId,symbol:exit.symbol,side:"SELL",orderType:"MARKET",quantity,confirmPaper:true,intentId:autoIntentId([accountId,"SELL",exit.symbol.toUpperCase(),ptDayKey(),quantity]),purpose:"auto-exit"},dryRun));
      }
      if(guard.alerts.length)return finish(result("BLOCKED","Position-protection alerts are being cleared before new buys."));
      const deferredExit=monitor.positions.find((p:any)=>p.cue==="EXIT REVIEW"&&Number(p.quantity)>0);
      if(deferredExit)return finish(result("WAITING","EXIT REVIEW — "+deferredExit.symbol+": "+(working.has(deferredExit.symbol.toUpperCase())?"active broker orders defer the software exit; existing protection remains in place.":"exit attempt already recorded; broker reconciliation is required before another order.")));
      if(reconciliation.state!=="MATCHED")return finish(result("BLOCKED","WAIT — account reconciliation: "+reconciliation.blockers.join(" · ")));
      if(!health||!health.tradingReady||health.blockers.length)return finish(result("BLOCKED","WAIT — "+(health?.blockers.join(" · ")||"Health must be above 90 with no critical errors.")));
      if(scanError||!scan||Date.now()-lastScanAt>=scanIntervalMs)return finish(result("BLOCKED","WAIT — scanner unavailable or stale."));
      const timing=autoEntryTiming();
      const risk=await db.selectFrom("riskProfiles").selectAll().where("userId","=",user.id).executeTakeFirst();
      if(timing.final15||afterPacificFlatTime(risk?.dayTradeFlatTimePt??"12:30"))return finish(result("WAITING","WAIT — entry window closed; position protection continues."));
      const macro=await serverMacroRisk();
      if(!["CLEAR","CAUTION"].includes(macro.state))return finish(result("BLOCKED",macro.message));
      const learning=await db.selectFrom("cueLearningProfiles").selectAll().where("userId","=",user.id).where("setup","=","ALL").executeTakeFirst();
      const gate=cueTrainingGate({tradeCount:learning?.tradeCount??0,expectancy:learning?.expectancy==null?null:Number(learning.expectancy),profitFactor:learning?.profitFactor==null?null:Number(learning.profitFactor),maxLosingStreak:learning?.maxLosingStreak??0});
      const dailyGoal=omegaDailyObjective(health.dayPnl);
      const held=snapshot.positions.filter(p=>Number(p.quantity)>0);
      if(dailyGoal.reached&&held.length>=1)return finish(result("WAITING","$500+ PROTECT & EXTEND — one position at a time after the base goal is reached."));
      if(held.length>=Math.min(controls!.maxAutoPositions,gate.maxAutoPositions))return finish(result("WAITING","Maximum paper positions reached."));
      const eligible=scan.rows.filter(row=>
        row.action==="ENTRY_READY"&&row.fresh&&row.plan&&row.dataAgreement?.state==="AGREED"&&(row.cueScore??0)>=gate.minCueScore&&
        (!dailyGoal.reached||(row.setupGrade==="A+"&&row.confidence>=95))&&
        !held.some(p=>p.symbol===row.symbol)&&!working.has(row.symbol)
      );
      const baseMaxRisk=Number(risk?.maxRiskPerTrade??10);
      const portfolioRoom=omegaPortfolioRoom({equity:Number(snapshot.balance.equity??NaN),buyingPower:Number(snapshot.balance.buyingPower??NaN),maxRiskPerTrade:baseMaxRisk,positions:reconciliation.portfolioPositions});
      if(portfolioRoom.unknownRisk)return finish(result("BLOCKED","WAIT — existing position risk cannot be measured; a verified stop and cost are required before another buy."));
      const options=eligible
        .filter(candidate=>!timing.openingObservation||(candidate.setupGrade==="A+"&&candidate.confidence>=95))
        .filter(candidate=>!timing.slowMarket||(candidate.setupGrade==="A+"&&candidate.confidence>=90))
        .map(candidate=>({candidate,plan:candidate.plan?omegaEntryPlan({
          price:candidate.price,entryHigh:candidate.plan.entryHigh,stop:candidate.plan.stop,target:candidate.plan.target2,
          budget:Number(controls!.perTradeBudget),buyingPower:portfolioRoom.usableBuyingPower,
          maxRiskPerTrade:Math.min(portfolioRoom.remainingRisk,Number(snapshot.balance.equity)*.01,dailyGoal.reached?baseMaxRisk*.5:baseMaxRisk),
          maxShares:gate.phase==="CALIBRATING"?200:undefined,
        }):null}))
        .filter((item):item is {candidate:typeof eligible[number];plan:NonNullable<ReturnType<typeof omegaEntryPlan>>}=>item.plan!=null)
        ;
      const ranked=compareOmegaOpportunities(options);
      const selected=ranked[0];
      opportunityComparison={...portfolioRoom,qualified:eligible.length,feasible:ranked.length,selected:selected?.candidate.symbol??null,policy:"Setup quality, reward/risk, confidence score, then lower capital use. Preserve 10% buying power; total planned stop risk capped at the smaller of 3% equity or three normal trade risks.",alternatives:ranked.slice(0,5).map(item=>({symbol:item.candidate.symbol,score:item.candidate.setupScore12,rewardRisk:item.plan.rewardRisk,plannedLoss:item.plan.plannedLoss,capital:item.plan.entry*item.plan.quantity,quantity:item.plan.quantity}))};
      const candidate=selected?.candidate??null;
      const adaptiveLimit=selected?.plan.entry??null;
      if(!candidate?.plan||adaptiveLimit==null)return finish(result("WAITING",dailyGoal.reached
        ?"$500+ PROTECT & EXTEND — goal reached; waiting only for an elite A+ 95%+ setup."
        :eligible.length?"WAIT — candidates do not yet pass entry timing, no-chase, stop/target payoff and affordable sizing checks.":"WAIT — NO QUALIFIED A/A+ SETUP"));
      if(timing.openingObservation&&(candidate.setupGrade!=="A+"||candidate.confidence<95))return finish(result("WAITING","WAIT — opening observation requires 95%+ A+."));
      if(timing.slowMarket&&(candidate.setupGrade!=="A+"||candidate.confidence<90))return finish(result("WAITING","WAIT — slow-market window requires 90%+ A+."));
      const quantity=selected!.plan.quantity;
      if(quantity<1)return finish(result("BLOCKED","Cash and stop-risk limits do not permit one share."));
      return finish(await submit(user,{accountId,symbol:candidate.symbol,side:"BUY",orderType:"LIMIT",quantity,limitPrice:adaptiveLimit,confirmPaper:true,intentId:autoIntentId([accountId,"BUY",candidate.symbol.toUpperCase(),ptDayKey(),adaptiveLimit,candidate.plan.stop]),purpose:"auto-entry"},dryRun));
    });
    await publish(channels.omega(user.id),{type:"worker_updated"}).catch(error=>console.error("Omega telemetry push unavailable",error instanceof Error?error.message:"Unknown"));
    return output;
  }catch(error){
    const message=error instanceof Error?error.message:"Worker tick failed.";
    const values={userId:user.id,completedAt:new Date(),status:"ERROR",message,lastAction:{mode:dryRun?"OBSERVE":"PAPER",proof:{brokerConnection:"UNCONFIRMED",scannerState:"ERROR",decision:message}},updatedAt:new Date()};
    await db.insertInto("cueWorkerState").values(values).onConflict(oc=>oc.column("userId").doUpdateSet(values)).execute();
    await db.insertInto("cueAuditLog").values({userId:user.id,action:"omega_worker_error",entityType:"omega_proof",details:{message,checkedAt:new Date().toISOString()}}).execute();
    await publish(channels.omega(user.id),{type:"worker_updated"}).catch(()=>{});
    throw error;
  }
}



  246