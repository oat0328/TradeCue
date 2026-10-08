import React,{useEffect,useMemo,useRef,useState} from "react";
import { Bot,Power,ShieldCheck,RefreshCw,AlertOctagon } from "lucide-react";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Input } from "./Input";
import { useCueHunter } from "../helpers/useCueHunter";
import { usePositionMonitor } from "../helpers/useMarketDesk";
import { usePaperOrders } from "../helpers/usePaperOrders";
import { useMacroRisk } from "../helpers/useMacroRisk";
import { autoPaperMarketReady,autoPaperQuantity,isWorkingPaperOrder } from "../helpers/autoPaperRules";
import { useBotHealth } from "../helpers/useBotHealth";
import { buildCueDailyOutlook } from "../helpers/dailyOutlook";
import { useAutomationControl } from "../helpers/useAutomationControl";
import { useKillAutomation } from "../helpers/useKillAutomation";
import { useLatestOutlook } from "../helpers/useLatestOutlook";
import { useCueBrainRun } from "../helpers/useCueBrainRun";
import { useTrainingStatus } from "../helpers/useTrainingStatus";
import { autoIntentId } from "../helpers/paperOrderIntent";
import { useExitGuard } from "../helpers/useExitGuard";
import { useWorkerStatus } from "../helpers/useWorkerStatus";
import { autoEntryTiming } from "../helpers/marketClock";
import {omegaActivity,omegaGateReason} from "../helpers/omegaActivity";
import {OMEGA_TRADING_CURRICULUM,OMEGA_CURRICULUM_VERSION} from "../helpers/omegaCurriculum";
import styles from "./CueAutoPaperTrader.module.css";

function ptDay(){return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Los_Angeles",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());}
function positiveInt(value:string,fallback:number){const n=Math.floor(Number(value));return Number.isFinite(n)&&n>0?n:fallback;}
function readableGate(value:string){
  return value
    .replaceAll("_"," ")
    .replace("5M","5m")
    .replace("15M","15m")
    .replace("1H","1H")
    .toLowerCase()
    .replace(/^./,letter=>letter.toUpperCase());
}

export function CueAutoPaperTrader({enabled,accountId,buyingPower,maxRiskPerTrade,onOpenSymbol}:{enabled:boolean;accountId?:string;buyingPower:number;maxRiskPerTrade:number;onOpenSymbol?:(symbol:string)=>void}){
  const control=useAutomationControl(enabled);
  const kill=useKillAutomation();
  const serverOutlook=useLatestOutlook(enabled);
  const brainRun=useCueBrainRun();
  const training=useTrainingStatus(enabled);
  const [budgetText,setBudgetText]=useState("500");
  const [maxPositionsText,setMaxPositionsText]=useState("3");
  const [status,setStatus]=useState("Standing by — arm Omega to let the AI scan, enter, manage and exit simulated trades.");
  const busy=useRef(false);
  const processed=useRef(new Set<string>());

  useEffect(()=>{
    if(control.query.data){
      setBudgetText(String(control.query.data.perTradeBudget));
      setMaxPositionsText(String(control.query.data.maxAutoPositions));
    }
  },[control.query.data?.updatedAt]);
  const armed=Boolean(control.query.data?.autoPaperEnabled)&&!control.query.data?.killSwitch;

  const hunter=useCueHunter(enabled,{mode:"auto",minScore:70,limit:12});
  const monitor=usePositionMonitor(enabled,accountId);
  const paper=usePaperOrders(enabled&&armed,accountId);
  const macro=useMacroRisk(enabled&&armed);
  const health=useBotHealth(accountId);
  const exitGuard=useExitGuard(enabled,accountId);
  const worker=useWorkerStatus(enabled);
  const monthlyGoal=worker.data?.proof?.monthlyGoal;
  const money=(n:number|null|undefined)=>n==null||!Number.isFinite(n)?"Unconfirmed":n.toLocaleString("en-US",{style:"currency",currency:"USD"});
  const exitAlerts=exitGuard.data?.alerts??[];
  const protectionCheckedAt=exitGuard.data?.checkedAt?Date.parse(exitGuard.data.checkedAt):NaN;
  const budget=Math.max(1,Number(budgetText)||500);
  const requestedMaxPositions=positiveInt(maxPositionsText,3);
  const maxPositions=Math.min(requestedMaxPositions,training.data?.maxAutoPositions??requestedMaxPositions);
  const openPositions=monitor.data?.positions.filter(row=>Number(row.quantity??0)>0)??[];
  const activeOrderSymbols=useMemo(()=>new Set((paper.orders.data?.orders??[])
    .filter(order=>isWorkingPaperOrder(order.status))
    .map(order=>order.symbol.toUpperCase())),[paper.orders.data?.orders]);
  const workingBuyOrders=useMemo(()=>(paper.orders.data?.orders??[])
    .filter(order=>order.side.toUpperCase()==="BUY"&&isWorkingPaperOrder(order.status)),[paper.orders.data?.orders]);
  const outlook=useMemo(()=>buildCueDailyOutlook({
    marketMode:hunter.data?.marketMode,
    rows:hunter.data?.rows,
    macroState:macro.data?.state,
    maxPositions,
    openPositions:openPositions.length,
  }),[hunter.data?.generatedAt,hunter.data?.marketMode,hunter.data?.rows,macro.data?.state,maxPositions,openPositions.length]);
  const minTrainingScore=training.data?.minCueScore??82;
  const buyQueue=useMemo(()=>(hunter.data?.rows??[])
    .filter(row=>row.fresh&&(row.setupGrade==="A"||row.setupGrade==="A+")&&(row.cueScore??0)>=Math.max(70,minTrainingScore-8))
    .sort((a,b)=>b.setupScore12-a.setupScore12||(b.cueScore??0)-(a.cueScore??0))
    .slice(0,5),[hunter.data?.generatedAt,hunter.data?.rows,minTrainingScore]);
  const sellQueue=useMemo(()=>(hunter.data?.rows??[])
    .filter(row=>row.fresh&&(row.shadowShortGrade==="A"||row.shadowShortGrade==="A+"))
    .sort((a,b)=>b.shadowShortScore12-a.shadowShortScore12)
    .slice(0,3),[hunter.data?.generatedAt,hunter.data?.rows]);

  useEffect(()=>{
    setStatus(worker.error?"WAIT — worker status unavailable":worker.data?.fresh?worker.data.message:"WAIT — WORKER OFFLINE. Start the persistent worker to run automatic paper trades.");
  },[worker.data,worker.error]);

  const [activityNow,setActivityNow]=useState(Date.now());
  useEffect(()=>{const timer=setInterval(()=>setActivityNow(Date.now()),1000);return ()=>clearInterval(timer)},[]);
  const activity=omegaActivity({online:Boolean(worker.data?.fresh)&&!worker.error,armed,assigned:Boolean(worker.data?.paperExecutionEnabled),proof:worker.data?.proof,now:activityNow});
  const workerFinder=worker.data?.proof?.discoveredCandidates??[];
  const finderCandidates=workerFinder.length
    ? workerFinder
    : buyQueue.map(row=>({
        symbol:row.symbol,
        action:row.action,
        setupGrade:row.setupGrade,
        setupScore12:row.setupScore12,
        confidence:row.confidence,
        fresh:row.fresh,
        executionAllowed:Boolean(row.action==="ENTRY_READY"&&row.fresh&&row.plan),
        entryPlan:row.plan?{entryLow:row.plan.entryLow,entryHigh:row.plan.entryHigh,stop:row.plan.stop,target:row.plan.target2}:null,
        reason:row.omegaEvidence?.rejectedReasons?.join(" · ")??row.whyNow?.[0]??"Waiting for a qualifying setup.",
      }));
  const finderReady=worker.data?.proof?.qualifiedSetupCount??finderCandidates.filter(row=>row.executionAllowed).length;
  const workerOnline=Boolean(worker.data?.fresh);
  const lastFinderScan=worker.data?.proof?.lastScanTimestamp
    ?new Date(worker.data.proof.lastScanTimestamp).toLocaleTimeString([], {hour:"numeric",minute:"2-digit",second:"2-digit"})
    :hunter.data?.generatedAt?new Date(hunter.data.generatedAt).toLocaleTimeString([], {hour:"numeric",minute:"2-digit",second:"2-digit"}):"—";

  const toggle=async()=>{
    const next=!armed;
    await control.update.mutateAsync({brainEnabled:next?true:control.query.data?.brainEnabled,autoPaperEnabled:next,killSwitch:false});
    setStatus(next?"Omega armed — scanning for qualified simulated entries and managing exits.":"Omega disarmed.");
  };

  return <section className={styles.panel} id="auto-paper">
    {exitAlerts.length>0&&<div className={styles.exitAlert} role="alert" aria-live="assertive">
      <details><summary className={styles.exitAlertHead}><AlertOctagon size={18}/><strong>{exitAlerts.map(a=>a.symbol).join(", ")} protection needs attention · new BUYs paused</strong></summary>
      {exitAlerts.map(alert=><div key={alert.id} className={styles.exitAlertRow}>
        <b>{alert.symbol}</b>
        <span>{alert.reason}</span>
        <small>{alert.state.replaceAll("_"," ").toUpperCase()} · attempts {alert.attempts} · updated {new Date(alert.updatedAt).toLocaleTimeString()}</small>
      </div>)}
      <p>{armed?"Omega retries only after Webull confirms a rejection (max 3). New automated entries are paused until this clears.":"Omega is disarmed, so it will not retry. Exit manually from the Paper order ticket."}</p></details>
    </div>}
    {exitGuard.data&&!exitGuard.data.brokerReachable&&<div className={styles.exitAlert} role="status">Exit guard cannot reach Webull right now — exit status is unconfirmed.</div>}
    <div className={styles.head}>
      <div className={styles.icon}><Bot size={22}/></div>
      <div><small>OMEGA MARKET HUNTER</small><strong>{!enabled?"Connect paper account":hunter.error?"Scanner unavailable":workerOnline?activity.activity:"Waiting for server worker"}</strong><span>Find stocks first. Green Gate decides whether a paper entry is allowed.</span></div>
      <Badge variant={armed?"success":"outline"}>{armed?"PAPER AUTO":"SCAN ONLY"}</Badge>
    </div>
    <div className={styles.finderHero} aria-live="polite">
      <div className={styles.finderDecision}>
        <small>OMEGA DECISION</small>
        <strong>{finderReady>0?finderReady+" SETUP CANDIDATE"+(finderReady===1?"":"S"):"WAIT — NO QUALIFIED ENTRY"}</strong>
        <span>{status}</span>
      </div>
      <div className={styles.finderStats} aria-label="Omega activity and readiness">
        <span><b>Doing now</b>{activity.activity}</span>
        <span><b>Worker heartbeat</b>{worker.data?.completedAt?new Date(worker.data.completedAt).toLocaleTimeString():"Unconfirmed"}</span>
        <span><b>Next worker scan</b>{activity.nextScanSeconds==null?"Unconfirmed":activity.nextScanSeconds===0?"Due — awaiting worker":activity.nextScanSeconds+"s"}</span>
        <span><b>Market data</b>{activity.scanFresh?"Fresh scan": "Unconfirmed / stale"}</span>
        <span><b>Entry readiness</b>{activity.ready?"Checks passed — broker rechecks before order":"Waiting / blocked"}</span>
        <span><b>Broker</b>{workerOnline?worker.data?.proof?.brokerConnection??"UNCONFIRMED":"UNCONFIRMED"}</span>
        <span><b>Strategy</b>{worker.data?.proof?.strategyVersion??"Unconfirmed"}</span>
      </div>
      <div className={styles.finderStats}>
        <span><b>Scanner</b>{workerOnline?"ONLINE":"CHECKING"}</span>
        <span><b>Found</b>{worker.data?.proof?.candidateCount??hunter.data?.rows.length??0}</span>
        <span><b>A / A+</b>{(worker.data?.proof?.aSetupCount??0)+" / "+(worker.data?.proof?.aPlusSetupCount??0)}</span>
        <span><b>Ready</b>{finderReady}</span>
        <span><b>Last scan</b>{lastFinderScan}</span>
      </div>
      <div className={styles.dailyGoal}>
        <div>
          <small>{monthlyGoal?.month??"CURRENT MONTH"} · $10,000 MONTHLY PAPER GOAL</small>
          <strong>{money(monthlyGoal?.monthPnl)+" / $10,000"}</strong>
          <span>{worker.data?.proof?.dailyTargetReached
            ?"BASE GOAL REACHED — Protect & Extend: only elite A+ 95%+ setups, reduced risk, one position at a time."
            :"MONTHLY GOAL: $10,000. $500/day and $2,500/week are approximate pace guides. Risk rules always win; no forced trades or catch-up sizing."}</span>
        </div>
        <div className={styles.goalTrack}><i style={{width:(monthlyGoal?.progress??0)+"%"}}/></div>
        <b>{money(monthlyGoal?.remaining)+" remaining this month"}</b>
        <div className={styles.finderStats}>
          <span><b>Today · $500 pace</b>{money(worker.data?.proof?.dayPnl)}</span>
          <span><b>This week · $2,500 pace</b>{money(monthlyGoal?.weekPnl)}</span>
          <span><b>Weekdays left, including today</b>{monthlyGoal?.weekdaysLeft??"Unconfirmed"}</span>
          <span><b>Required average / weekday</b>{money(monthlyGoal?.requiredAveragePerWeekday)}</span>
        </div>
        <span>Month/week totals: tracked closed paper journal P/L, before fees and any profit split; open positions excluded. Remaining weekdays are an estimate before market holidays. Today's figure is broker day P/L. {monthlyGoal?.reached?"Monthly goal reached — protect gains.":""}</span>
      </div>
      <div className={styles.trainingBanner}>
        <strong>{training.data?.phase==="CALIBRATING"?"PROP TRAINING MODE":"STRICT GREEN MODE"}</strong>
        <span>{training.data?.phase==="CALIBRATING"
          ?(training.data.tradeCount??0)+"/30 resolved paper trades · broader liquid-stock hunt · up to 200 shares when risk/cash permit · 5m BUY + A/A+ · stop + adaptive protected target"
          :"Evidence phase "+(training.data?.phase??"CHECKING")+" · strict higher-timeframe alignment applies"}</span>
      </div>
      <div className={styles.finderTopline}>
        <div><strong>ACTIVE STOCK HUNT</strong><span>{worker.data?.proof?.scanCapacity?("Up to "+worker.data.proof.scanCapacity+" liquid stocks · "+(worker.data.proof.scanIntervalSeconds??120)+"s scan interval · qualified entries first"):"Waiting for active hunt telemetry"}</span></div>
        <Button size="sm" variant="outline" disabled={!enabled||hunter.isFetching} onClick={()=>hunter.refetch()}><RefreshCw size={13}/>{hunter.isFetching?"Scanning…":"Scan now"}</Button>
      </div>
      <div className={styles.finderCards}>
        {finderCandidates.slice(0,8).map(row=><button type="button" key={row.symbol} onClick={()=>onOpenSymbol?.(row.symbol)} className={row.executionAllowed?styles.finderReady:styles.finderCard}>
          <div><strong>{row.symbol}</strong><b>{row.setupGrade} · {row.setupScore12}/12</b></div>
          <span>{row.executionAllowed?"READY":row.action==="WATCH"?"WATCHING":"WAIT"}</span>
          <small>{row.confidence}% confidence</small>
          {row.entryPlan&&<div className={styles.tradeLevels}>
            <span><b>Entry zone</b>{money(row.entryPlan.entryLow)+" – "+money(row.entryPlan.entryHigh)}</span>
            <span><b>Stop / invalidation</b>{money(row.entryPlan.stop)}</span>
            <span><b>Protected target</b>{money(row.entryPlan.target)}</span>
          </div>}
          <p>{row.executionAllowed?"Setup qualifies; health, risk and broker checks still apply.":omegaGateReason(row.reason)}</p>
        </button>)}
        {!finderCandidates.length&&<div className={styles.finderEmpty}>{hunter.isFetching?"Omega is scanning the market now…":"No qualified candidate yet. Omega checks every minute during regular market hours, every 2 minutes outside the session."}</div>}
      </div>
      <div className={styles.finderStats} aria-label="Broker order and protection evidence">
        <span><b>Order sent</b>{paper.orders.isError?"Unconfirmed":workingBuyOrders.length+" working buys"}</span>
        <span><b>Broker positions</b>{monitor.isError?"Unconfirmed":openPositions.length}</span>
        <span><b>Stop coverage</b>{!exitGuard.data?.brokerReachable||exitGuard.error||activityNow-protectionCheckedAt>60000||!Number.isFinite(protectionCheckedAt)?"Unconfirmed":exitGuard.data.rows.some(row=>row.heldQty>0&&row.alert)?"Needs attention":exitGuard.data.rows.some(row=>row.heldQty>0)?"Broker stop coverage verified":"Flat — no stop needed"}</span>
        <span><b>Protection checked</b>{exitGuard.data?.checkedAt?new Date(exitGuard.data.checkedAt).toLocaleTimeString():"Unconfirmed"}</span>
      </div>
      <p className={styles.finderNote}>Order sent → broker fill → verified stop coverage. Submission never means filled or protected. Finding a stock does not mean buying it.</p>
    </div>
    <div className={styles.positionDesk} aria-label="Omega entry and exit decisions">
      <div className={styles.finderTopline}><div><strong>MANAGE & EXIT</strong><span>Hold the setup while it works. Exit on invalidation, target, flat time or the profit give-back rule.</span></div></div>
      {monitor.error&&<p role="status">Position decisions unavailable — {monitor.error.message}</p>}
      {!monitor.data&&!monitor.error&&<p>Waiting for position data.</p>}
      {monitor.data&&!monitor.data.positions.length&&<p>No open paper positions. Omega is looking for the next qualified entry.</p>}
      <div className={styles.finderCards}>{monitor.data?.positions.map(row=><article key={row.symbol} className={styles.positionCard}>
        <div><strong>{row.symbol}</strong><b>{row.commanderAction}</b></div>
        <p>{row.reason}</p>
        <div className={styles.tradeLevels}>
          <span><b>Entry cost</b>{money(row.costPrice==null?null:Number(row.costPrice))}</span>
          <span><b>Current / peak observed R</b>{(row.currentR?.toFixed(2)??"—")+" / "+(row.peakR?.toFixed(2)??"—")}</span>
          <span><b>Stop · target</b>{money(row.stop)+" · "+money(row.target)}</span>
        </div>
        <small>{row.commanderAction==="EXIT"?"Full exit uses the guarded paper path; broker confirmation is required.":row.commanderAction==="HOLD"?"Hold while protection and the setup remain valid.":"Stop changes and partial exits are recommendations; broker brackets have not been amended."}</small>
      </article>)}</div>
      <p>After at least +1.5R on observed closes, a give-back of 0.75R requests a guarded full paper exit. Active broker orders can defer execution; existing protection remains in place. R measures price movement against the original stop distance. This rule does not predict the top.</p>
    </div>
    <details><summary>Advanced details, risk controls & learning</summary>
    <div className={styles.flow}>
      <span className={armed?styles.activeStep:undefined}>SCAN</span>
      <i>→</i>
      <span>ENTER</span>
      <i>→</i>
      <span>MANAGE</span>
      <i>→</i>
      <span>EXIT</span>
    </div>
    <div className={styles.training}>
      <div><small>PAPER CALIBRATION · {Number.isFinite(buyingPower)?new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(buyingPower):"—"} BUYING POWER</small><strong>{training.data?.phase??"LOADING"}</strong></div>
      <span><b>Entry gate</b>{training.data?"Score "+training.data.minCueScore+"+":"—"}</span>
      <span><b>Resolved</b>{training.data?.tradeCount??0}</span>
      <span><b>Expectancy</b>{training.data?.expectancy==null?"—":training.data.expectancy.toFixed(2)+"R"}</span>
      <p>{training.data?.explanation??"Loading the learning gate from resolved PaperTrades."}</p>
      <p>Training log saves the top 5 scanner observations once per completed 5-minute bar so skipped setups can be reviewed later too.</p>
    </div>
    <div className={styles.stats}>
      <span><b>Top gainers</b>{hunter.data?.leaders.topGainers.map(row=>row.symbol).join(" · ")||"—"}</span>
      <span><b>Top losers</b>{hunter.data?.leaders.topLosers.map(row=>row.symbol).join(" · ")||"—"}</span>
      <span><b>Buy team</b>{hunter.data?.leaders.topBuyTeam.join(" · ")||"—"}</span>
      <span><b>Sell team · shadow</b>{hunter.data?.leaders.topSellTeam.join(" · ")||"—"}</span>
      <span><b>Breakouts</b>{hunter.data?.leaders.breakoutCandidates.join(" · ")||"—"}</span>
      <span><b>Retests</b>{hunter.data?.leaders.retestCandidates.join(" · ")||"—"}</span>
      <span><b>Reversals</b>{hunter.data?.leaders.reversalCandidates.join(" · ")||"—"}</span>
    </div>
    <div className={styles.buyQueue}>
      <div className={styles.buyQueueHead}>
        <div>
          <small>{hunter.data?.marketMode==="WEEKEND_PREP"?"MONDAY BUY WATCH":"OMEGA BUY QUEUE"}</small>
          <strong>{buyQueue.length?buyQueue.length+" candidates":"Building candidates"}</strong>
        </div>
        <Badge variant="outline">{hunter.data?.marketMode==="RTH"?"LIVE SESSION":"NOT ORDERS YET"}</Badge>
      </div>
      <div className={styles.curriculum}>
        <div className={styles.curriculumHead}>
          <div><small>{"OMEGA CURRICULUM · "+OMEGA_CURRICULUM_VERSION}</small><strong>10 rules he trains by every session</strong></div>
          <span>$10,000/month goal · $500/day pace · risk rules always win</span>
        </div>
        <div className={styles.curriculumGrid}>
          {OMEGA_TRADING_CURRICULUM.map(item=><article key={item.step}>
            <b>{String(item.step).padStart(2,"0")}</b>
            <div><strong>{item.title}</strong><p>{item.rule}</p></div>
          </article>)}
        </div>
      </div>
      <p>{hunter.data?.marketMode==="WEEKEND_PREP"
        ?"These are Omega's best setups from the latest available market data. Monday entries still require fresh regular-session confirmation."
        :"These are the names closest to Omega's current entry gate. A watch candidate is not automatically a buy."}</p>
      <div className={styles.buyQueueRows}>
        {buyQueue.map((row,index)=><article key={row.symbol}>
          <div className={styles.buyQueueSymbol}><em>#{index+1}</em><span><b>{row.symbol}</b><small>{row.name||"US stock"}</small></span></div>
          <div><small>Grade</small><strong>{row.setupGrade} · {row.setupScore12}/12</strong></div>
          <div><small>Confidence</small><strong>{row.confidence}%</strong></div>
          <div><small>Status</small><strong className={row.action==="ENTRY_READY"?styles.queueReady:styles.queueWatch}>{row.action.replaceAll("_"," ")}</strong></div>
          {row.plan?<div className={styles.queuePlan}>
            <span><b>Entry</b>${row.plan.entryLow.toFixed(2)}–${row.plan.entryHigh.toFixed(2)}</span>
            <span><b>Stop</b>${row.plan.stop.toFixed(2)}</span>
            <span><b>Estimated shares</b>{autoPaperQuantity({budget,buyingPower,entry:row.plan.entryHigh,stop:row.plan.stop,maxRiskPerTrade,maxShares:training.data?.phase==="CALIBRATING"?200:undefined})}</span>
            <span><b>Planned loss at stop</b>${(autoPaperQuantity({budget,buyingPower,entry:row.plan.entryHigh,stop:row.plan.stop,maxRiskPerTrade,maxShares:training.data?.phase==="CALIBRATING"?200:undefined})*(row.plan.entryHigh-row.plan.stop)).toFixed(2)} · server rechecks size</span>
            <span><b>TP1 · 1:1</b>${row.plan.target1.toFixed(2)}</span>
            <span><b>Protected target</b>${row.plan.target2.toFixed(2)}</span>
            <span><b>TP3 · 1:3</b>${row.plan.target3.toFixed(2)}</span>
          </div>:<div className={styles.queuePending}>Waiting for a valid entry/stop plan before this can become an order.</div>}
          <p>{row.whyNow?.[0]??"Omega is monitoring structure, momentum, volume and location."}</p>
        </article>)}
        {!buyQueue.length&&<div className={styles.queueEmpty}>{hunter.isFetching?"Scanning the market now…":"No candidate is strong enough for the next-session watch list yet."}</div>}
      </div>
    </div>
    <div className={styles.buyQueue}>
      <div className={styles.buyQueueHead}>
        <div><small>OMEGA SELL TEAM · SHADOW MODE</small><strong>{sellQueue.length?sellQueue.length+" bearish candidates":"No qualified short study"}</strong></div>
        <Badge variant="outline">NO SHORT ORDERS</Badge>
      </div>
      <p>Omega studies the mirrored bearish recipe — below a falling EMA20, below VWAP, lower highs/lows, bounce, red confirmation and bearish market alignment. These are logged for learning only until broker-native protected short brackets are separately validated.</p>
      <div className={styles.buyQueueRows}>
        {sellQueue.map((row,index)=><article key={"short-"+row.symbol}>
          <div className={styles.buyQueueSymbol}><em>#{index+1}</em><span><b>{row.symbol}</b><small>{row.name||"US stock"}</small></span></div>
          <div><small>Short grade</small><strong>{row.shadowShortGrade} · {row.shadowShortScore12}/12</strong></div>
          <div><small>Confidence</small><strong>{row.shadowShortConfidence}%</strong></div>
          <div><small>Status</small><strong className={row.shadowShortReady?styles.queueReady:styles.queueWatch}>{row.shadowShortReady?"SHADOW READY":"WATCH"}</strong></div>
          <p>Shadow mode records the setup without placing a SELL-short order.</p>
        </article>)}
        {!sellQueue.length&&<div className={styles.queueEmpty}>No A/A+ bearish setup is qualified right now.</div>}
      </div>
    </div>
    <div className={styles.outlook}>
      <div className={styles.outlookHead}>
        <div><small>{outlook.label}</small><strong>{outlook.bias}</strong></div>
        <span>{outlook.watch.length?"WATCH "+outlook.watch.join(" · "):"BUILDING WATCHLIST"}</span>
      </div>
      <h4>{outlook.headline}</h4>
      <p>{outlook.summary}</p>
      <div className={styles.outlookGrid}>
        <span><b>WHAT MAKES ME BUY</b>{outlook.buyTrigger}</span>
        <span><b>WHAT MAKES ME STAY OUT</b>{outlook.stayOut}</span>
        <span className={styles.full}><b>MY PLAN</b>{outlook.openPlan}</span>
      </div>
      {serverOutlook.data?.outlook&&<div className={styles.serverOutlook}>
        <b>SERVER BRAIN · {serverOutlook.data.outlook.outlookType.toUpperCase()}</b>
        <span>{serverOutlook.data.outlook.bias??"—"} · {serverOutlook.data.outlook.headline??"No headline"}</span>
        <small>Saved {new Date(serverOutlook.data.outlook.updatedAt).toLocaleString()}</small>
      </div>}
      <Button size="sm" variant="outline" disabled={!enabled||brainRun.isPending} onClick={()=>brainRun.mutate()}><RefreshCw size={13}/>{brainRun.isPending?"Thinking…":"Refresh Omega Outlook"}</Button>
    </div>

    <div className={styles.settings}>
      <label>Per trade $<Input inputMode="decimal" value={budgetText} onChange={e=>setBudgetText(e.target.value.replace(/[^0-9.]/g,""))} onBlur={()=>control.update.mutate({perTradeBudget:Math.max(1,Number(budgetText)||500)})}/></label>
      <label>Max positions<Input inputMode="numeric" value={maxPositionsText} onChange={e=>setMaxPositionsText(e.target.value.replace(/\D/g,""))} onBlur={()=>control.update.mutate({maxAutoPositions:positiveInt(maxPositionsText,3)})}/></label>
    </div>
    <div className={styles.stats}>
      <span><b>Hunter</b>{hunter.isFetching?"SCANNING":(hunter.data?.rows.filter(r=>r.action==="ENTRY_READY").length??0)+" ready"}</span>
      <span><b>Positions</b>{openPositions.length}/{maxPositions}</span>
      <span><b>Market</b>{hunter.data?.marketMode??"CHECKING"}</span>
      <span><b>Omega market</b>{hunter.data?hunter.data.marketContext.bias+" · "+hunter.data.marketContext.omegaMarketMode.replaceAll("_"," "):"CHECKING"}</span>
      <span><b>Breadth</b>{hunter.data?hunter.data.marketContext.breadthScore+"/100 · A "+hunter.data.marketContext.advancing+" / D "+hunter.data.marketContext.declining+" · H "+hunter.data.marketContext.newHighs+" / L "+hunter.data.marketContext.newLows:"CHECKING"}</span>
      <span><b>News guard</b>{macro.data?.state??"CHECKING"}</span>
    </div>
    <div className={styles.health}>
      <div><b>BACKGROUND RUNNER</b><strong>{worker.isFetching&&!worker.data?"CHECKING":worker.data?.executionMode==="SERVER_PAPER"?"PAPER CHECK-IN":worker.data?.executionMode==="SERVER_OBSERVE"?"OBSERVING":"NOT CONNECTED"}</strong></div>
      <p>{worker.data?.message??"Checking background runner status."} {worker.data?.completedAt?"Last check-in "+new Date(worker.data.completedAt).toLocaleTimeString():""}</p>
      <div>
        <b>OMEGA HEALTH SCORE</b>
        <strong className={health.data?.status==="READY"?styles.healthReady:health.data?.status==="BLOCKED"?styles.healthBlocked:styles.healthWaiting}>
          {health.isFetching?"CHECKING":health.data?health.data.healthScore+"/100 · "+health.data.healthLabel:"NOT RUN"}
        </strong>
      </div>
      <Button size="sm" variant="outline" disabled={!enabled||health.isFetching} onClick={()=>health.refetch()}><RefreshCw size={13}/>Run self-test</Button>
      {health.data&&<>
        <p>{health.data.blockers.length?health.data.blockers.join(" · "):"Execution, data, scanner, strategy, risk and reporting engines passed."}</p>
        <p>Execution {health.data.subsystems.execution?"✓":"✕"} · Data {health.data.subsystems.data?"✓":"✕"} · Scanner {health.data.subsystems.scanner?"✓":"✕"} · Strategy {health.data.subsystems.strategy?"✓":"✕"} · Risk {health.data.subsystems.risk?"✓":"✕"} · Reporting {health.data.subsystems.reporting?"✓":"✕"} · Loss streak {health.data.consecutiveLosses}/3</p>
      </>}
      {health.error&&<p className={styles.healthBlocked}>{health.error.message}</p>}
    </div>
    <div className={styles.controlActions}>
    <Button onClick={toggle} disabled={control.update.isPending||kill.isPending} variant={armed?"destructive":"primary"}><Power size={14}/>{armed?"Disarm Omega":"Arm Omega"}</Button>
    <Button onClick={async()=>{
      const r=await kill.mutateAsync({accountId});
      setStatus("KILL SWITCH ACTIVE — Auto Paper is off. "+r.cancelRequested+" working BUY order"+(r.cancelRequested===1?"":"s")+" sent for cancellation.");
    }} disabled={kill.isPending} variant="destructive"><Power size={14}/>{kill.isPending?"Stopping…":"STOP ALL AUTOMATION"}</Button>
    </div></details>
    {control.query.data?.killSwitch&&<div className={styles.killState}>KILL SWITCH ACTIVE · New automated entries are blocked until you arm Omega again.</div>}
    <div className={styles.note}><ShieldCheck size={13}/><span>Omega can autonomously submit and manage simulated PaperTrade orders after you arm it. Cash trading remains disabled.</span></div>
  </section>;
}
