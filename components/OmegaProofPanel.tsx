import React,{useEffect,useState} from "react";
import {useWorkerStatus} from "../helpers/useWorkerStatus";
import {omegaProofStatus} from "../helpers/omegaProofStatus";
import {useAutomationControl} from "../helpers/useAutomationControl";
import type {OutputType as WorkerData} from "../endpoints/bot/worker-status_GET.schema";
import styles from "./OmegaProofPanel.module.css";
const value=(n:number|null|undefined,suffix="")=>n==null||!Number.isFinite(n)?"—":n.toFixed(suffix==="%"?2:0)+suffix;
export function OmegaProofPanel({enabled}:{enabled:boolean}){
 const worker=useWorkerStatus(enabled);
 const control=useAutomationControl(enabled);
 const [now,setNow]=useState(Date.now());
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return ()=>clearInterval(timer)},[]);
 return <OmegaProofView data={worker.data} now={now} armed={Boolean(control.query.data?.autoPaperEnabled&&!control.query.data?.killSwitch)} checking={control.query.isPending} error={worker.error?.message}/>;
}
export function OmegaProofView({data,now,armed,checking,error}:{data?:WorkerData;now:number;armed:boolean;checking:boolean;error?:string}){
 const proof=data?.proof;
 const state=data?omegaProofStatus(data,now):null;
 const decision=error?"WAIT — TELEMETRY UNAVAILABLE":state?.decision??"WAIT — WORKER OFFLINE";
 const checked=proof?.lastScanTimestamp?new Date(proof.lastScanTimestamp).toLocaleString():"—";
 const metrics=[
 ["Omega status",checking?"CHECKING":armed?"ARMED · PAPER LONGS":"DISARMED"],
 ["Market state",proof?.marketState??"UNCONFIRMED"],
 ["Health score",value(proof?.healthScore)+"/100"],
 ["Critical errors",value(proof?.criticalErrors)],
 ["Worker",state?.online?"ONLINE":"OFFLINE"],
 ["Broker connection",state?.brokerConnection??"UNCONFIRMED"],
 ["Account reconciliation",proof?.reconciliation?.state??"UNCONFIRMED"],
 ["Broker cash",proof?.reconciliation?.cash==null?"—":proof.reconciliation.cash.toLocaleString("en-US",{style:"currency",currency:"USD"})],
 ["Usable buying power",proof?.opportunityComparison?proof.opportunityComparison.usableBuyingPower.toLocaleString("en-US",{style:"currency",currency:"USD"}):"—"],
 ["Scanner",state?.scannerState??"OFFLINE"],
 ["Last scan",checked],
 ["Candidates",value(proof?.candidateCount)],
 ["A / A+ grades",value(proof?.aSetupCount)+" / "+value(proof?.aPlusSetupCount)],
 ["Qualified entry plans",value(proof?.qualifiedSetupCount)],
 ["Open positions",value(proof?.openPositions)],
 ["Daily P/L",proof?.dayPnl==null?"—":proof.dayPnl.toLocaleString("en-US",{style:"currency",currency:"USD"})],
 ["Monthly goal","$10,000"],
 ["Month · closed paper P/L",proof?.monthlyGoal?proof.monthlyGoal.monthPnl.toLocaleString("en-US",{style:"currency",currency:"USD"}):"Unconfirmed"],
 ["$500 profit protection",proof?.dailyTargetMode==="PROTECT_AND_EXTEND"?"PROTECT & EXTEND":"$500 DAILY PACE"],
 ["Curriculum",proof?.curriculumVersion??"UNCONFIRMED"],
 ["Consecutive losses",value(proof?.consecutiveLosses)+" / 3"],
 ["Daily drawdown",value(proof?.drawdownPercent,"%")+" / 3%"],
 ["Skip learning",proof?.skipLearning?proof.skipLearning.evaluatedTotal+" reviewed · "+proof.skipLearning.pending+" pending":"—"],
 ["Skip precision",proof?.skipLearning?.skipPrecision==null?"Collecting evidence":proof.skipLearning.skipPrecision.toFixed(0)+"% validated"],
 ];
 return <section className={styles.panel} aria-label="Omega Proof Mode">
  <div className={styles.header}><div><small>OMEGA-26 · ACCOUNT & TRADE CHECKS</small><h2>{decision}</h2></div><span className={state?.online?styles.online:styles.offline}>{state?.online?"WORKER ONLINE":"WORKER OFFLINE"}</span></div>
  <dl className={styles.grid}>{metrics.map(([label,text])=><div key={label}><dt>{label}</dt><dd>{text}</dd></div>)}</dl>
  {proof?.reconciliation?.blockers.map(message=><p className={styles.notice} key={message} role="status"><strong>Account check:</strong> {message}</p>)}
  {proof?.opportunityComparison&&<div className={styles.finder}>
   <div className={styles.finderHead}><strong>TRADE COMPARISON</strong><span>{proof.opportunityComparison.feasible} feasible · selected {proof.opportunityComparison.selected??"none"}</span></div>
   <p>{proof.opportunityComparison.policy}</p>
   <p>Planned open stop risk: ${proof.opportunityComparison.openRisk?.toFixed(2)??"—"} · remaining capacity: ${proof.opportunityComparison.remainingRisk.toFixed(2)}. Gaps and slippage can exceed planned loss.</p>
   <div className={styles.candidates}>{proof.opportunityComparison.alternatives.map(option=><article className={styles.candidate} key={option.symbol}><strong>{option.symbol}</strong><p>{option.score}/12 · {option.rewardRisk.toFixed(2)}:1 planned reward/risk</p><p>{option.quantity} shares · ${option.capital.toFixed(2)} capital · ${option.plannedLoss.toFixed(2)} planned stop risk</p></article>)}</div>
  </div>}
  {!!proof?.discoveredCandidates?.length&&<div className={styles.finder}>
   <div className={styles.finderHead}><strong>OMEGA FINDER · FOUND NOW</strong><span>{proof.discoveredCandidates.length} highest-scored candidates</span></div>
   <div className={styles.candidates}>{proof.discoveredCandidates.map(candidate=><article key={candidate.symbol} className={candidate.executionAllowed?styles.candidateReady:styles.candidate}>
    <div><strong>{candidate.symbol}</strong><span>{candidate.setupGrade} · {candidate.setupScore12}/12 · {candidate.confidence}%</span></div>
    <b>{candidate.executionAllowed?"ENTRY READY":candidate.action}</b>
    <p>{candidate.reason}</p>
    {candidate.dataAgreement&&<p>Price/candle check: {candidate.dataAgreement.state}{candidate.dataAgreement.differencePercent==null?"":" · "+candidate.dataAgreement.differencePercent.toFixed(2)+"% difference"}</p>}
   </article>)}</div>
  </div>}
  {!state?.online&&<p className={styles.notice}>Automatic execution is paused. {data?.completedAt?"Last worker check-in "+new Date(data.completedAt).toLocaleString()+". Historical metrics may be stale.":"No background worker check-in has been recorded."}</p>}
  {proof?.protectionAlerts?.map(alert=><p key={alert.symbol} className={styles.notice} role="alert"><strong>{alert.symbol} protection:</strong> {alert.reason}</p>)}
  {error&&<p role="alert">{error}</p>}
  <p className={styles.policy}>DIY-10 curriculum · $10,000/month paper goal · $2,500/week and $500/day approximate pace, never quotas · after $500 daily profit switch to Protect & Extend: A+ 95%+ only, half normal risk, one position at a time · first 30 resolved paper trades remain calibration · mandatory stop · risk and drawdown rules always override profit targets</p>
 </section>;
}