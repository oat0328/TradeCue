import React from "react";
import { BrainCircuit,ShieldCheck,ShieldAlert } from "lucide-react";
import type { GeniusReport } from "../helpers/omegaGenius";
import { Badge } from "./Badge";
import styles from "./OmegaGeniusPanel.module.css";
export function OmegaGeniusPanel({symbol,report}:{symbol:string;report:GeniusReport}){
  const ready=report.verdict==="SETUP_CANDIDATE";
  const variant=ready?"success":report.verdict==="RISK_VETO"?"error":"warning";
  return <section className={styles.card} aria-label="Omega Genius reasoning panel">
    <div className={styles.header}>
      <div className={styles.heading}><BrainCircuit size={20}/><div><small>OMEGA GENIUS • EVIDENCE REVIEW</small><strong>{symbol} · {report.headline}</strong></div></div>
      <Badge variant={variant}>{report.verdict.replace(/_/g," ")}</Badge>
    </div>
    <p className={styles.description}>{report.explanation}</p>
    <div className={styles.twoCol}>
      <div className={styles.block}><strong>{report.qualityScore==null?"—":report.qualityScore+"/100"}</strong><span>Technical setup score — NOT a win probability</span></div>
      <div className={styles.block}><strong>{report.plan?report.plan.grossR.toFixed(2)+"R":"—"}</strong><span>Gross planned reward-to-risk, before costs</span></div>
    </div>
    {report.plan&&<div className={styles.plan}>
      <span><b>Entry</b> {report.plan.entryLow.toFixed(2)}–{report.plan.entryHigh.toFixed(2)}</span>
      <span><b>Stop</b> {report.plan.stop.toFixed(2)}</span>
      <span><b>TP2</b> {report.plan.target.toFixed(2)}</span>
      <span><b>Paper size ceiling</b> {report.plan.maxPaperShares??"—"} shares</span>
      <span><b>Planned gross risk</b> {report.plan.plannedRisk!=null?"$"+report.plan.plannedRisk.toFixed(2):"—"}</span>
    </div>}
    <ul className={styles.reasons}>{report.reasons.map((reason,i)=><li key={i}>{reason}</li>)}</ul>
    <div className={styles.footer}>{ready?<ShieldCheck size={16}/>:<ShieldAlert size={16}/>}<span><b>What changes Omega's mind:</b> {report.nextTrigger}</span></div>
    <small className={styles.disclaimer}>Read-only stock analysis. Existing paper orders use separate controls. No AI-generated score guarantees a profitable trade, and this panel does not execute orders.</small>
  </section>;
}
