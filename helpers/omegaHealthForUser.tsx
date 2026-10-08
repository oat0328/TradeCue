import { apiUser,apiJson,apiFailure } from "./apiAccess";
import { db } from "./db";
import { userKeys,webullRead,webullSnapshot } from "./webullClient";
import { webullBars } from "./webullBars";
import { stockMarketMode } from "./marketClock";
import type { OutputType } from "../endpoints/bot/health_GET.schema";
import { cueTrainingGate } from "./trainingGate";
import { serverMacroRisk } from "./cueBrainShared";
import { calculateCueSignal } from "./cueSignal";
import { omegaHealthLabel,omegaHealthScore,omegaTradingReady } from "./omegaStrategy";

function ptDateKey(value:Date){
  return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Los_Angeles",year:"numeric",month:"2-digit",day:"2-digit"}).format(value);
}
function liveOrderStatus(value:string){
  const normalized=value.toUpperCase().replace(/[^A-Z]/g,"");
  return !["CANCELED","CANCELLED","REJECTED","FAILED"].includes(normalized);
}

export async function omegaHealthForUser(user:Awaited<ReturnType<typeof apiUser>>,accountId?:string){
    const keys=await userKeys(user);
    const snapshot=await webullSnapshot(keys,accountId);
    const risk=await db.selectFrom("riskProfiles")
      .select(["maxRiskPerTrade","maxDailyLoss","maxTradesPerDay","dayTradeFlatTimePt"])
      .where("userId","=",user.id)
      .executeTakeFirst();
    const raw=await webullRead(keys,"/market-data/stocks/bars/list",{},{
      symbols:["SPY"],category:"US_STOCK",timespan:"M5",count:"40",real_time_required:true,trading_sessions:"PRE,RTH,ATH",
    });
    const bars=webullBars(raw).slice(-40);
    const strategySignal=calculateCueSignal(bars);
    const latest=bars.at(-1);
    const age=latest?.time&&Number.isFinite(Date.parse(latest.time))
      ? Math.max(0,(Date.now()-Date.parse(latest.time))/60000)
      : Number.POSITIVE_INFINITY;
    const marketMode=stockMarketMode();
    const barFresh=age<=20;
    const recent=await db.selectFrom("paperOrders")
      .select(["side","status","createdAt"])
      .where("userId","=",user.id)
      .orderBy("createdAt","desc").limit(100).execute();
    const today=ptDateKey(new Date());
    const tradesToday=recent.filter(row=>row.side==="BUY"&&liveOrderStatus(row.status)&&ptDateKey(new Date(row.createdAt))===today).length;
    const maxTrades=risk?.maxTradesPerDay??3;
    const buyingPower=Number(snapshot.balance.buyingPower??NaN);
    const accountBase=Number(snapshot.balance.equity??snapshot.balance.buyingPower??NaN);
    const dayPnl=Number(snapshot.balance.dayPnl??NaN);
    const configuredDailyLoss=Math.abs(Number(risk?.maxDailyLoss??30));
    const hardDailyLoss=Number.isFinite(accountBase)&&accountBase>0?accountBase*.03:NaN;
    const maxDailyLoss=Number.isFinite(hardDailyLoss)?Math.min(configuredDailyLoss,hardDailyLoss):configuredDailyLoss;
    const [controls,macro,alerts,recentClosed]=await Promise.all([
      db.selectFrom("cueAutomationControls").selectAll().where("userId","=",user.id).executeTakeFirst(),
      serverMacroRisk(),
      db.selectFrom("cueExitAlerts").select(["symbol","reason"]).where("userId","=",user.id)
        .where("accountId","=",snapshot.selectedAccountId).where("status","=","open").execute(),
      db.selectFrom("cueTradeJournal").select(["realizedPnl","exitTime"]).where("userId","=",user.id)
        .where("status","=","closed").orderBy("exitTime","desc").limit(20).execute(),
    ]);
    const armed=Boolean(controls?.autoPaperEnabled&&!controls?.killSwitch);
    const todaysClosed=recentClosed.filter(row=>row.exitTime&&ptDateKey(new Date(row.exitTime))===today);
    let consecutiveLosses=0;
    for(const row of todaysClosed){
      const pnl=Number(row.realizedPnl??0);
      if(Number.isFinite(pnl)&&pnl<0)consecutiveLosses++;
      else break;
    }
    const blockers:string[]=[];
    if(!armed)blockers.push("Omega automatic PaperTrade is disarmed or the kill switch is on.");
    if(!["CLEAR","CAUTION"].includes(macro.state))blockers.push("Macro risk is blocked or unavailable; new buys are paused.");
    if(alerts.length)blockers.push("Open position-protection alerts require attention before new buys.");
    if(!Number.isFinite(accountBase)||accountBase<=0)blockers.push("Account equity is unavailable; percentage risk caps cannot be verified.");
    if(!Number.isFinite(dayPnl))blockers.push("Daily profit/loss is unavailable; the daily loss limit cannot be verified.");
    if(marketMode!=="RTH")blockers.push("Automatic stock orders wait for regular market hours.");
    if(marketMode==="RTH"&&!barFresh)blockers.push("SPY 5-minute market data is stale.");
    if(!Number.isFinite(buyingPower)||buyingPower<=0)blockers.push("No usable PaperTrade buying power was returned.");
    if(maxTrades>0&&tradesToday>=maxTrades)blockers.push("Maximum trades for today has been reached.");
    if(Number.isFinite(dayPnl)&&maxDailyLoss>0&&dayPnl<=-maxDailyLoss)blockers.push("Daily loss limit has been reached.");
    if(consecutiveLosses>=3)blockers.push("Three consecutive losses reached today; Omega is done trading until the next session.");
    const learning=await db.selectFrom("cueLearningProfiles").select(["tradeCount","expectancy","profitFactor","maxLosingStreak"]).where("userId","=",user.id).where("setup","=","ALL").executeTakeFirst();
    const gate=cueTrainingGate({tradeCount:learning?.tradeCount??0,expectancy:learning?.expectancy==null?null:Number(learning.expectancy),profitFactor:learning?.profitFactor==null?null:Number(learning.profitFactor),maxLosingStreak:learning?.maxLosingStreak??0});
    const maxPositions=Math.min(controls?.maxAutoPositions??3,gate.maxAutoPositions);
    const heldCount=snapshot.positions.filter(p=>Number(p.quantity)>0).length;
    if(heldCount>=maxPositions)blockers.push("Paper position limit reached ("+heldCount+"/"+maxPositions+"); new buys are paused.");
    const subsystems={
      execution:armed&&Boolean(snapshot.selectedAccountId),
      data:marketMode!=="RTH"||barFresh,
      scanner:bars.length>=30,
      strategy:strategySignal.available,
      risk:Boolean(risk&&Number(risk.maxRiskPerTrade)>0&&Number(risk.maxDailyLoss)>0&&Number(risk.maxTradesPerDay)>0),
      reporting:true,
    };
    const healthScore=omegaHealthScore(subsystems);
    const healthLabel=omegaHealthLabel(healthScore);
    const criticalErrors=blockers.filter(message=>/unavailable|stale|No usable|protection|loss limit|Three consecutive/i.test(message)).length;
    const tradingReady=omegaTradingReady(healthScore,criticalErrors);
    if(marketMode==="RTH"&&!tradingReady&&!blockers.length)blockers.push("Omega health score must be above 90 with no critical errors before a new trade.");
    const status=marketMode!=="RTH"?"WAITING":blockers.length?"BLOCKED":"READY";
    return {
      status,marketMode,accountId:snapshot.selectedAccountId,
      armed,macroState:macro.state,protectionAlerts:alerts,
      criticalErrors,accountBase:Number.isFinite(accountBase)&&accountBase>0?accountBase:null,
      buyingPower:Number.isFinite(buyingPower)?buyingPower:null,
      dayPnl:Number.isFinite(dayPnl)?dayPnl:null,
      positions:snapshot.positions.length,
      barCount:bars.length,
      latestBarTime:latest?.time??null,
      barFresh,tradesToday,maxTradesPerDay:maxTrades,
      maxRiskPerTrade:Number.isFinite(accountBase)&&accountBase>0?Math.min(Number(risk?.maxRiskPerTrade??10),accountBase*.01):Number(risk?.maxRiskPerTrade??10),
      maxDailyLoss,flatTimePt:risk?.dayTradeFlatTimePt??"12:30",
      consecutiveLosses,healthScore,healthLabel,subsystems,tradingReady,
      blockers,checkedAt:new Date().toISOString(),
    };
}
  114