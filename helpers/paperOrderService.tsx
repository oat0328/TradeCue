import { createHash, randomUUID } from "node:crypto";
import { sql } from "kysely";
import { apiUser, apiJson, apiFailure, ApiError } from "./apiAccess";
import { db } from "./db";
import { effectiveMembership } from "./effectiveMembership";
import { placeWebullPaperBracket, placeWebullPaperOrder, previewWebullPaperBracket, previewWebullPaperOrder, userKeys, webullRead, webullSnapshot, webullTodayOrders, webullInstrument, type WebullKeys } from "./webullClient";
import { webullBars } from "./webullBars";
import { calculateCueSignal } from "./cueSignal";
import type { Json, PaperOrderIntents, PaperOrderIntentStatus } from "./schema";
import type { Selectable } from "kysely";
import { schema, type OutputType } from "../endpoints/webull/paper-order_POST.schema";
import { afterPacificFlatTime,autoEntryTiming,stockMarketMode } from "./marketClock";
import { cueTrainingGate } from "./trainingGate";
import { canonicalOrderRequest, existingIntentStep, reservationBlock, unresolvedIntentStep, PENDING_MARKER } from "./paperOrderIntent";
import { evaluateExitGuard } from "./exitGuardServer";
import { scanForBrain,serverMacroRisk } from "./cueBrainShared";
import {omegaHealthForUser} from "./omegaHealthForUser";
import {omegaDailyObjective} from "./omegaDailyObjective";
import {reconcileOmegaAccount} from "./omegaReconciliationServer";
import {omegaDataAgreement} from "./omegaDataAgreement";
import {omegaPortfolioRoom} from "./omegaOpportunityComparison";

// Audit H-01: one intent → at most one broker order.
// 1) A retry with the same intentId never places again (returns the record or reconciles).
// 2) The intent, its pre-generated broker ids and its risk reservation are written under a
//    per-account Postgres advisory lock BEFORE the broker call, so concurrent requests
//    (tabs, workers, retries) cannot both pass the limits.
// 3) If the broker call or the local write fails, the intent stays recoverable and is
//    reconciled against Webull by its client_order_id instead of inviting a new placement.

type Intent=Selectable<PaperOrderIntents>;
type CuePlan={entryLow:number;entryHigh:number;stop:number;target1:number;target2:number;target3:number};
type IntentContext={
  orderType:"MARKET"|"LIMIT";limitPrice:number|null;cuePlan:CuePlan|null;cueScore:number|null;
  bracket:null|{comboClientOrderId:string;childOrderIds:{profit:string;stop:string};protectedTarget:number|null;protectedStop:number|null};
  omegaProof?:Json|null;
  purpose?:"manual"|"auto-entry"|"auto-exit"|"auto-cleanup";retryOfIntentId?:string|null;
};

function ptDateKey(value:Date){
  return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Los_Angeles",year:"numeric",month:"2-digit",day:"2-digit"}).format(value);
}
function normalized(value:string){return String(value||"").toUpperCase().replace(/[^A-Z]/g,"");}
function isFilledStatus(value:string){return ["FILLED","FINALFILLED","COMPLETED"].includes(normalized(value));}
function isDeadStatus(value:string){const n=normalized(value);return n.includes("CANCEL")||["REJECTED","FAILED","EXPIRED"].includes(n);}
function sha256(text:string){return createHash("sha256").update(text).digest("hex");}
function hexId(){return randomUUID().replace(/-/g,"");}
function errorText(error:unknown){return (error instanceof Error?error.message:"Broker request failed").slice(0,500);}

async function setIntentStatus(id:string,status:PaperOrderIntentStatus,error:string|null){
  await db.updateTable("paperOrderIntents").set({status,error,updatedAt:new Date()}).where("id","=",id).execute();
}

/** Look the intent's order up at Webull. null = definitely not there; "unknown" = lookup failed. */
async function findBrokerOrder(keys:WebullKeys,accountId:string,clientOrderId:string){
  try{
    const orders=await webullTodayOrders(keys,accountId);
    return orders.find(order=>order.clientOrderId===clientOrderId)??null;
  }catch{
    return "unknown" as const;
  }
}

/** Write the local order record exactly once (unique client_order_id) and mark the intent submitted. */
async function recordSubmitted(userId:number,intent:Intent,input:{brokerResponse:unknown;instrumentId:string;brokerOrderId:string|null;status:string}){
  const ctx=(intent.context??{}) as unknown as IntentContext;
  const rawResponse=JSON.parse(JSON.stringify({
    broker:input.brokerResponse??null,
    cuePlan:ctx.cuePlan??null,
    cueScore:ctx.cueScore??null,
    setup:(ctx.omegaProof as any)?.setupType??"CUE_TECHNICAL_V0_1",
    omegaProof:ctx.omegaProof??null,
    intentId:intent.intentId,
    bracket:ctx.bracket??null,
  })) as Json;
  await db.transaction().execute(async trx=>{
    await trx.insertInto("paperOrders").values({
      userId,
      accountId:intent.accountId,
      symbol:intent.symbol,
      instrumentId:input.instrumentId,
      side:intent.side,
      orderType:ctx.orderType??"MARKET",
      quantity:String(intent.quantity),
      limitPrice:ctx.limitPrice!=null?String(ctx.limitPrice):null,
      clientOrderId:intent.clientOrderId,
      brokerOrderId:input.brokerOrderId,
      status:input.status,
      rawResponse,
    }).onConflict(oc=>oc.column("clientOrderId").doNothing()).execute();
    await trx.insertInto("cueAuditLog").values({
      userId,
      action:"webull_paper_order_submitted",
      entityType:"paper_order",
      entityId:intent.clientOrderId,
      details:{symbol:intent.symbol,side:intent.side,orderType:ctx.orderType??null,quantity:Number(intent.quantity),accountId:intent.accountId,intentId:intent.intentId,cuePlan:ctx.cuePlan??null,cueScore:ctx.cueScore??null,setup:"CUE_TECHNICAL_V0_1"},
    }).execute();
    await trx.updateTable("paperOrderIntents").set({status:"submitted",brokerOrderId:input.brokerOrderId,error:null,updatedAt:new Date()}).where("id","=",intent.id).execute();
  });
}

function okResponse(intent:Intent,status:string,duplicate:boolean){
  const ctx=(intent.context??{}) as unknown as IntentContext;
  const body:OutputType={
    submitted:true,duplicate,intentId:intent.intentId,clientOrderId:intent.clientOrderId,
    symbol:intent.symbol,side:intent.side as "BUY"|"SELL",orderType:ctx.orderType??"MARKET",quantity:Number(intent.quantity),status,
  };
  return apiJson(body);
}

/** Handle a retry of an intent that already exists. Never places a new broker order. */
async function resolveExisting(userId:number,keys:WebullKeys,intent:Intent,requestHash:string){
  const step=existingIntentStep(intent,requestHash);
  if(step.kind==="mismatch"||step.kind==="failed")throw new ApiError(409,step.message);
  if(step.kind==="submitted"){
    const local=await db.selectFrom("paperOrders").select(["status"]).where("clientOrderId","=",intent.clientOrderId).executeTakeFirst();
    return okResponse(intent,local?.status??"submitted",true);
  }
  const found=await findBrokerOrder(keys,intent.accountId,intent.clientOrderId);
  if(found&&found!=="unknown"){
    let instrumentId="";
    try{instrumentId=await webullInstrument(keys,intent.symbol);}catch{}
    await recordSubmitted(userId,intent,{brokerResponse:{reconciled:true,order:found},instrumentId,brokerOrderId:found.orderId,status:found.status});
    return okResponse(intent,found.status,true);
  }
  if(found==="unknown")throw new ApiError(409,"Order is "+PENDING_MARKER+": TradeCUE could not reach Webull to confirm it. Check Recent orders before trying again.");
  const next=unresolvedIntentStep(Date.now()-new Date(intent.createdAt).getTime());
  if(next.status!==intent.status)await setIntentStatus(intent.id,next.status,intent.error);
  throw new ApiError(409,next.message);
}

export async function executePaperOrder(user:Awaited<ReturnType<typeof apiUser>>,rawInput:unknown){
  try{
    const membership=await effectiveMembership(user.id,user.role==="admin");
    if(!membership.accessActive || membership.tier==="scout") throw new ApiError(403,"Copilot or Autopilot access is required for Webull PaperTrade orders.");

    const input=schema.parse(rawInput);
    if(input.purpose==="auto-entry"&&(input.side!=="BUY"||input.orderType!=="LIMIT"))throw new ApiError(409,"Automatic entries must be BUY limit orders inside a valid plan.");
    if(input.purpose==="auto-exit"&&input.side!=="SELL")throw new ApiError(409,"Automatic exits must be SELL orders.");
    if(input.purpose==="auto-cleanup"&&(input.side!=="SELL"||input.orderType!=="MARKET"))throw new ApiError(409,"Automatic cleanup must be a SELL market order.");
    const requestHash=sha256(canonicalOrderRequest(input));
    const keys=await userKeys(user);

    const prior=await db.selectFrom("paperOrderIntents").selectAll()
      .where("userId","=",user.id).where("intentId","=",input.intentId).executeTakeFirst();
    if(prior)return await resolveExisting(user.id,keys,prior,requestHash);

    const risk=await db.selectFrom("riskProfiles")
      .select(["longOnly","requireGreenConfirmation","maxRiskPerTrade","maxDailyLoss","maxTradesPerDay","noChaseEnabled","safeModeEnabled","dayTradeFlatTimePt"])
      .where("userId","=",user.id)
      .executeTakeFirst();
    const automation=await db.selectFrom("cueAutomationControls")
      .select(["killSwitch","autoPaperEnabled","maxAutoPositions","perTradeBudget"])
      .where("userId","=",user.id).executeTakeFirst();
    const learning=await db.selectFrom("cueLearningProfiles")
      .select(["tradeCount","expectancy","profitFactor","maxLosingStreak"])
      .where("userId","=",user.id).where("setup","=","ALL").executeTakeFirst();
    const trainingGate=cueTrainingGate({
      tradeCount:Number(learning?.tradeCount??0),
      expectancy:learning?.expectancy==null?null:Number(learning.expectancy),
      profitFactor:learning?.profitFactor==null?null:Number(learning.profitFactor),
      maxLosingStreak:Number(learning?.maxLosingStreak??0),
    });
    if(input.side==="BUY"&&automation?.killSwitch){
      throw new ApiError(409,"CUE kill switch is active. New BUY orders are blocked until automation is re-enabled.");
    }

    if(input.purpose!=="manual"&&(!automation?.autoPaperEnabled||automation.killSwitch))throw new ApiError(409,"Omega must be armed and the kill switch off for automated orders.");
    if(input.side==="BUY"){
      const macro=await serverMacroRisk();
      if(!["CLEAR","CAUTION"].includes(macro.state))throw new ApiError(409,"Risk Firewall paused new entries: macro risk is blocked or unavailable.");
    }

    // Protective-exit control. Automated exits: a first attempt only when none was made today;
    // a retry only after Webull confirms the previous attempt was rejected (exit guard decides).
    if(input.purpose==="auto-exit"){
      const guard=await evaluateExitGuard(user.id,keys,input.accountId,{onlySymbol:input.symbol});
      const row=guard.rows[0];
      if(input.retryOfIntentId){
        if(!row||row.state!=="retry_ready"||row.retryOfIntentId!==input.retryOfIntentId||row.nextIntentId!==input.intentId){
          throw new ApiError(409,"Exit retry not allowed yet: "+(row?.reason??"no rejected exit to retry."));
        }
      }else if(row&&row.attempts>0){
        throw new ApiError(409,"An automated exit for "+input.symbol+" was already attempted today; only a controlled retry is allowed. "+row.reason);
      }
    }
    if(input.purpose==="auto-cleanup"){
      const guard=await evaluateExitGuard(user.id,keys,input.accountId,{onlySymbol:input.symbol});
      const row=guard.rows[0];
      if(!row||!row.alert||row.heldQty<=0||!["none","residual"].includes(row.state)){
        throw new ApiError(409,"Automatic cleanup is only allowed for an unprotected or residual PaperTrade position.");
      }
      if(Math.abs(input.quantity-row.heldQty)>0.000001){
        throw new ApiError(409,"Automatic cleanup must exit the full remaining position.");
      }
    }
    if(input.side==="BUY"&&automation?.autoPaperEnabled){
      await evaluateExitGuard(user.id,keys,input.accountId);
      const openAlert=await db.selectFrom("cueExitAlerts").select(["symbol"])
        .where("userId","=",user.id).where("accountId","=",input.accountId).where("status","=","open").executeTakeFirst();
      if(openAlert){
        throw new ApiError(409,"Automated BUYs are paused: the exit for "+openAlert.symbol+" needs attention first (see the exit alert).");
      }
    }
    let cuePlanForOrder:CuePlan|null=null;
    let cueScoreForOrder:number|null=null;
    let omegaProofForOrder:Json|null=null;

    const snapshot=await webullSnapshot(keys,input.accountId);
    const accountBase=Number(snapshot.balance.equity??snapshot.balance.buyingPower??NaN);

    if(input.side==="BUY"){
      if(!Number.isFinite(accountBase)||accountBase<=0)throw new ApiError(409,"Risk Firewall blocked this BUY: account equity is unavailable; the 1% risk and 3% daily limits cannot be verified.");
      if(stockMarketMode()!=="RTH"){
        throw new ApiError(409,"Risk Firewall blocked this BUY: Auto/Paper stock entries are limited to the regular CORE session.");
      }
      if(autoEntryTiming().final15){
        throw new ApiError(409,"Risk Firewall blocked this BUY: no new stock entries are allowed in the final 15 minutes.");
      }
      if(afterPacificFlatTime(risk?.dayTradeFlatTimePt??"12:30")){
        throw new ApiError(409,"Risk Firewall blocked this BUY: the configured day-trade flat time has passed.");
      }
      if(automation?.autoPaperEnabled){
        const referencePrice=input.orderType==="LIMIT"&&input.limitPrice!=null?input.limitPrice:0;
        const notional=referencePrice>0?referencePrice*input.quantity:0;
        const budget=Number(automation.perTradeBudget??0);
        if(budget>0&&notional>budget+0.01){
          throw new ApiError(409,"Portfolio Brain blocked this automated BUY: planned notional exceeds the configured per-trade budget.");
        }
      }
      const dayPnl=Number(snapshot.balance.dayPnl??NaN);
      const configuredDailyLoss=Math.abs(Number(risk?.maxDailyLoss??30));
      const hardDailyLoss=Number.isFinite(accountBase)&&accountBase>0?accountBase*.03:NaN;
      const maxDailyLoss=Number.isFinite(hardDailyLoss)?Math.min(configuredDailyLoss,hardDailyLoss):configuredDailyLoss;
      if(!Number.isFinite(dayPnl)||!Number.isFinite(maxDailyLoss)||maxDailyLoss<=0){
        throw new ApiError(409,"Risk Firewall blocked this BUY: a positive daily loss limit and current daily P/L must be available.");
      }
      if(maxDailyLoss>0&&Number.isFinite(dayPnl)&&dayPnl<=-maxDailyLoss){
        throw new ApiError(409,"Risk Firewall blocked this BUY: the daily loss limit has been reached.");
      }
      const recentClosed=await db.selectFrom("cueTradeJournal").select(["realizedPnl","exitTime"])
        .where("userId","=",user.id).where("status","=","closed").orderBy("exitTime","desc").limit(20).execute();
      const today=ptDateKey(new Date());
      let consecutiveLosses=0;
      for(const row of recentClosed){
        if(!row.exitTime||ptDateKey(new Date(row.exitTime))!==today)continue;
        const pnl=Number(row.realizedPnl??0);
        if(Number.isFinite(pnl)&&pnl<0)consecutiveLosses++;
        else break;
      }
      if(consecutiveLosses>=3){
        throw new ApiError(409,"Risk Firewall blocked this BUY: three consecutive losses were reached today. Omega is done trading until the next session.");
      }
    }

    if(input.side==="BUY"&&(input.purpose==="auto-entry"||(risk?.requireGreenConfirmation??true))){
      const raw=await webullRead(keys,"/market-data/stocks/bars/list",{},{
        symbols:[input.symbol],
        category:"US_STOCK",
        timespan:"M5",
        count:"100",
        real_time_required:true,
        trading_sessions:"OVN,PRE,RTH,ATH",
      });
      const bars=webullBars(raw).slice(-100);
      const signal=calculateCueSignal(bars,trainingGate.phase==="CALIBRATING"?{protectedTargetR:1.5}:undefined);
      const latest=bars.at(-1);
      const fresh=Boolean(latest?.time&&Number.isFinite(Date.parse(latest.time))&&(Date.now()-Date.parse(latest.time))/60000<=20);
      if(!signal.available||!fresh||signal.state!=="BUY"){
        throw new ApiError(409,"Green Gate blocked this BUY. TradeCUE requires a fresh qualifying 5-minute setup before paper entry.");
      }
      let omegaCandidate:null|Awaited<ReturnType<typeof scanForBrain>>["rows"][number]=null;
      if(input.purpose==="auto-entry"){
        const omegaScan=await scanForBrain(user,32);
        omegaCandidate=omegaScan.rows.find(row=>row.symbol.toUpperCase()===input.symbol.toUpperCase())??null;
        if(!omegaCandidate||omegaCandidate.action!=="ENTRY_READY"||!omegaCandidate.plan||omegaCandidate.dataAgreement?.state!=="AGREED"){
          throw new ApiError(409,trainingGate.phase==="CALIBRATING"
            ?"Omega Prop Training Gate blocked this automated BUY: a fresh 5m BUY plan, A/A+ quality, non-bearish market, and non-bearish higher-timeframe context are required."
            :"Omega Green Gate blocked this automated BUY: 1H bullish + 15m bullish + a qualified 5m A/A+ setup with bullish market alignment are required.");
        }
        const agreement=omegaDataAgreement({quotePrice:omegaCandidate.price,barPrice:latest?.close??null,barTimes:bars.map(bar=>bar.time)});
        if(agreement.state!=="AGREED")throw new ApiError(409,"Market data check blocked this BUY: "+agreement.blockers.join(" · "));
        if(autoEntryTiming().openingObservation&&(omegaCandidate.setupGrade!=="A+"||omegaCandidate.confidence<95)){
          throw new ApiError(409,"Opening Observation blocked this automated BUY: 9:30–9:45 ET requires a 95%+ A+ Omega setup.");
        }
        if(autoEntryTiming().slowMarket&&(omegaCandidate.setupGrade!=="A+"||omegaCandidate.confidence<90)){
          throw new ApiError(409,"Slow Market Filter blocked this automated BUY: 2:30–3:00 ET requires a 90%+ A+ Omega setup.");
        }
        omegaProofForOrder=JSON.parse(JSON.stringify({
          strategyVersion:"OMEGA-26-ACCOUNT-DATA-COMPARISON",
          setupType:omegaCandidate.whyNow[0],
          gateMode:omegaCandidate.omegaEvidence?.gateMode??"STRICT_GREEN",
          trainingPhase:trainingGate.phase,
          candidate:omegaCandidate,capturedAt:new Date().toISOString(),learningMode:"STATISTICS_ONLY"
        })) as Json;
        const entryHealth=await omegaHealthForUser(user,input.accountId);
        if(!entryHealth.tradingReady||entryHealth.blockers.length){
          throw new ApiError(409,"Omega Health Gate blocked this automated BUY: health score must be above 90 with no critical errors.");
        }
        const dailyGoal=omegaDailyObjective(entryHealth.dayPnl);
        if(dailyGoal.reached&&(omegaCandidate.setupGrade!=="A+"||omegaCandidate.confidence<95)){
          throw new ApiError(409,"Omega Protect & Extend blocked this automated BUY: after the $500 daily base goal, only A+ setups at 95%+ confidence can open a new paper position.");
        }
      }
      if(automation?.autoPaperEnabled&&signal.score<trainingGate.minCueScore){
        throw new ApiError(409,"CUE Training Gate blocked this automated BUY: score "+signal.score+" is below the current "+trainingGate.phase+" threshold of "+trainingGate.minCueScore+".");
      }
      const plan=signal.plan;
      cueScoreForOrder=signal.score;
      if(plan){
        cuePlanForOrder={
          entryLow:plan.entryLow,entryHigh:plan.entryHigh,stop:plan.stop,
          target1:plan.target1,target2:plan.target2,target3:plan.target3,
        };
        const intendedEntry=input.orderType==="LIMIT"&&input.limitPrice!=null?input.limitPrice:latest?.close??plan.entryHigh;
        if((risk?.noChaseEnabled??true)&&intendedEntry>plan.entryHigh*1.001){
          throw new ApiError(409,"No-Chase blocked this BUY: the requested entry is above the current CUE entry zone.");
        }
        const perShareRisk=intendedEntry-plan.stop;
        if(input.purpose==="auto-entry"&&(!Number.isFinite(plan.target2)||plan.target2-intendedEntry<perShareRisk||!latest||latest.close<=plan.stop||latest.close>=plan.target2)){
          throw new ApiError(409,"Entry payoff check blocked this BUY: fresh price must remain between stop and target, with at least 1:1 planned reward/risk at the requested entry.");
        }
        const plannedRisk=perShareRisk*input.quantity;
        const configuredMaxRisk=Math.abs(Number(risk?.maxRiskPerTrade??10));
        const hardMaxRisk=Number.isFinite(accountBase)&&accountBase>0?accountBase*.01:NaN;
        const maxRisk=Number.isFinite(hardMaxRisk)?Math.min(configuredMaxRisk,hardMaxRisk):configuredMaxRisk;
        if(input.purpose==="auto-entry"&&(!Number.isFinite(perShareRisk)||perShareRisk<=0||!Number.isFinite(maxRisk)||maxRisk<=0)){
          throw new ApiError(409,"Automatic paper entry requires a valid stop below entry and a positive per-trade loss limit.");
        }
        if(maxRisk>0&&plannedRisk>maxRisk+0.01){
          throw new ApiError(409,"Risk Firewall blocked this BUY: planned loss "+plannedRisk.toFixed(2)+" exceeds the max risk per trade of "+maxRisk.toFixed(2)+".");
        }
      }else if(risk?.safeModeEnabled??true){
        throw new ApiError(409,"Safe Mode blocked this BUY because no current CUE stop/target plan is available.");
      }
    }

    const useBracket=input.side==="BUY"&&!!cuePlanForOrder;
    const bracketIds=useBracket?{combo:hexId(),master:hexId(),profit:hexId(),stop:hexId()}:null;
    const clientOrderId=bracketIds?bracketIds.master:hexId();
    const context:IntentContext={
      orderType:input.orderType,limitPrice:input.limitPrice??null,cuePlan:cuePlanForOrder,cueScore:cueScoreForOrder,
      bracket:bracketIds&&cuePlanForOrder?{comboClientOrderId:bracketIds.combo,childOrderIds:{profit:bracketIds.profit,stop:bracketIds.stop},protectedTarget:cuePlanForOrder.target2,protectedStop:cuePlanForOrder.stop}:null,
      omegaProof:omegaProofForOrder,
      purpose:input.purpose,retryOfIntentId:input.retryOfIntentId??null,
    };
    const heldQuantityBySymbol:Record<string,number>={};
    for(const row of snapshot.positions){
      const q=Number(row.quantity??0);
      if(Number.isFinite(q))heldQuantityBySymbol[row.symbol.toUpperCase()]=(heldQuantityBySymbol[row.symbol.toUpperCase()]??0)+q;
    }

    // Reconcile reservations with broker evidence before sizing another exit.
    // A missing order or unavailable lookup never releases an uncertain reservation.
    const brokerEvidence=await webullTodayOrders(keys,input.accountId).catch(()=>null);
    const brokerStatuses=new Map((brokerEvidence??[]).map(order=>[order.clientOrderId,order.status]));

    // Reserve under a per-account lock. Concurrent requests for the same account serialize here.
    const reservation=await db.transaction().execute(async trx=>{
      await sql`select pg_advisory_xact_lock(hashtextextended(${"tradecue:paper-order:"+user.id+":"+input.accountId}, 0))`.execute(trx);
      const again=await trx.selectFrom("paperOrderIntents").selectAll()
        .where("userId","=",user.id).where("intentId","=",input.intentId).executeTakeFirst();
      if(again)return {existing:again,intent:null};

      const since=new Date(Date.now()-36*3600_000);
      const today=ptDateKey(new Date());
      const intents=await trx.selectFrom("paperOrderIntents")
        .select(["side","symbol","quantity","status","clientOrderId","createdAt"])
        .where("userId","=",user.id).where("accountId","=",input.accountId).where("createdAt",">=",since)
        .execute();
      const local=await trx.selectFrom("paperOrders")
        .select(["side","symbol","status","clientOrderId","createdAt"])
        .where("userId","=",user.id).where("accountId","=",input.accountId).where("createdAt",">=",since)
        .execute();
      const localStatus=new Map(local.map(row=>[row.clientOrderId,row.status]));
      const todays=intents.filter(row=>ptDateKey(new Date(row.createdAt))===today&&row.status!=="failed");
      const inFlight=todays.filter(row=>{
        const confirmed=brokerStatuses.get(row.clientOrderId);
        if(confirmed&&(isFilledStatus(confirmed)||isDeadStatus(confirmed)))return false;
        if(row.status==="submitting"||row.status==="uncertain")return true;
        const st=confirmed??localStatus.get(row.clientOrderId);
        return st!=null&&!isFilledStatus(st)&&!isDeadStatus(st);
      });
      const buyIds=new Set(todays.filter(row=>row.side==="BUY").map(row=>row.clientOrderId));
      for(const row of local){
        if(row.side==="BUY"&&ptDateKey(new Date(row.createdAt))===today&&!isDeadStatus(row.status))buyIds.add(row.clientOrderId);
      }
      const pendingSellQtyBySymbol:Record<string,number>={};
      for(const row of inFlight.filter(r=>r.side==="SELL")){
        const s=row.symbol.toUpperCase();
        pendingSellQtyBySymbol[s]=(pendingSellQtyBySymbol[s]??0)+Number(row.quantity);
      }
      const block=reservationBlock({
        side:input.side,symbol:input.symbol,quantity:input.quantity,
        autoPaperEnabled:Boolean(automation?.autoPaperEnabled),
        longOnly:input.purpose!=="manual"?true:risk?.longOnly??true,
        heldQuantityBySymbol,
        pendingBuySymbols:inFlight.filter(r=>r.side==="BUY").map(r=>r.symbol),
        pendingSellQtyBySymbol,
        buysTodayCount:buyIds.size,
        maxTradesPerDay:risk?.maxTradesPerDay??3,
        maxAutoPositions:Math.min(automation?.maxAutoPositions??3,trainingGate.maxAutoPositions),
      });
      if(block)throw new ApiError(409,block);

      const intent=await trx.insertInto("paperOrderIntents").values({
        userId:user.id,accountId:input.accountId,intentId:input.intentId,requestHash,
        symbol:input.symbol,side:input.side,quantity:String(input.quantity),status:"submitting",
        clientOrderId,comboClientOrderId:bracketIds?.combo??null,
        childOrderIds:bracketIds?{profit:bracketIds.profit,stop:bracketIds.stop}:null,
        context:context as unknown as Json,
      }).returningAll().executeTakeFirstOrThrow();
      return {existing:null,intent};
    });
    if(reservation.existing)return await resolveExisting(user.id,keys,reservation.existing,requestHash);
    const intent=reservation.intent!;

    const orderInput={
      accountId:input.accountId,symbol:input.symbol,side:input.side,orderType:input.orderType,
      quantity:input.quantity,limitPrice:input.limitPrice,
    };
    try{
      if(useBracket&&cuePlanForOrder){
        await previewWebullPaperBracket(keys,{...orderInput,stopPrice:cuePlanForOrder.stop,takeProfitPrice:cuePlanForOrder.target2});
      }else{
        await previewWebullPaperOrder(keys,orderInput);
      }
      // Re-check controls after slow evidence/preview reads, immediately before placement.
      const latestControls=await db.selectFrom("cueAutomationControls").select(["killSwitch","autoPaperEnabled"]).where("userId","=",user.id).executeTakeFirst();
      if(input.side==="BUY"&&latestControls?.killSwitch)throw new ApiError(409,"Kill switch activated during order review; BUY blocked.");
      if(input.purpose!=="manual"&&(!latestControls?.autoPaperEnabled||latestControls.killSwitch))throw new ApiError(409,"Omega was disarmed during order review; automatic order blocked.");
      if(input.purpose!=="manual"&&stockMarketMode()!=="RTH")throw new ApiError(409,"Regular market session ended during order review; automatic order blocked.");
      if(input.purpose==="auto-entry"){
        // This reserved intent has not reached the broker; exclude only its own id.
        const accountCheck=await reconcileOmegaAccount(user.id,keys,await webullSnapshot(keys,input.accountId),intent.clientOrderId);
        if(accountCheck.state!=="MATCHED")throw new ApiError(409,"Account reconciliation blocked this BUY: "+accountCheck.blockers.join(" · "));
        const room=omegaPortfolioRoom({equity:accountCheck.equity??NaN,buyingPower:accountCheck.buyingPower??NaN,maxRiskPerTrade:Math.abs(Number(risk?.maxRiskPerTrade??10)),positions:accountCheck.portfolioPositions});
        const entry=input.limitPrice??NaN;
        const plannedRisk=cuePlanForOrder?(entry-cuePlanForOrder.stop)*input.quantity:NaN;
        if(room.unknownRisk||!Number.isFinite(plannedRisk)||plannedRisk>room.remainingRisk+.01||entry*input.quantity>room.usableBuyingPower+.01)throw new ApiError(409,"Portfolio comparison blocked this BUY: preserve 10% buying power and remain within total planned stop-risk capacity.");
      }
    }catch(error){
      await setIntentStatus(intent.id,"failed","Preview rejected: "+errorText(error));
      throw error;
    }

    let placed:{response:unknown;instrumentId:string};
    try{
      placed=useBracket&&cuePlanForOrder&&bracketIds
        ? await placeWebullPaperBracket(keys,{...orderInput,stopPrice:cuePlanForOrder.stop,takeProfitPrice:cuePlanForOrder.target2},bracketIds)
        : await placeWebullPaperOrder(keys,orderInput,clientOrderId);
    }catch(error){
      // The broker may have accepted the order before the error (timeout, dropped connection).
      const found=await findBrokerOrder(keys,input.accountId,clientOrderId);
      if(found===null){
        await setIntentStatus(intent.id,"failed",errorText(error));
        throw error;
      }
      if(found==="unknown"){
        await setIntentStatus(intent.id,"uncertain",errorText(error));
        throw new ApiError(502,"Order is "+PENDING_MARKER+" / uncertain: Webull did not confirm it and could not be checked. Check Recent orders before trying again — retrying this same order will not place a duplicate.");
      }
      let instrumentId="";
      try{instrumentId=await webullInstrument(keys,input.symbol);}catch{}
      placed={response:{reconciled:true,order:found},instrumentId};
    }

    const responseRecord=placed.response&&typeof placed.response==="object"?placed.response as Record<string,unknown>:{};
    const brokerOrderId=
      typeof responseRecord.order_id==="string"?responseRecord.order_id:
      typeof responseRecord.orderId==="string"?responseRecord.orderId:
      null;
    const status=
      typeof responseRecord.status==="string"?responseRecord.status:
      typeof responseRecord.order_status==="string"?responseRecord.order_status:
      "submitted";
    try{
      await recordSubmitted(user.id,intent,{brokerResponse:placed.response,instrumentId:placed.instrumentId,brokerOrderId,status});
    }catch{
      // Intent stays "submitting"; a retry with the same intentId reconciles instead of placing again.
      throw new ApiError(503,"Webull accepted the order but TradeCUE could not record it yet. The order is "+PENDING_MARKER+" in TradeCUE — retrying this same order will reconcile it, not place a new one.");
    }
    return okResponse(intent,status,false);
  }catch(error){
    return apiFailure(error);
  }
}


