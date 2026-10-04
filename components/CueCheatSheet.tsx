import React from "react";
import { Check, CircleAlert, X } from "lucide-react";
import { Badge } from "./Badge";
import type { CueSignal, CueSignalUnavailable } from "../helpers/cueSignal";
import styles from "./CueCheatSheet.module.css";

function passIcon(pass:boolean){return pass?<Check size={13}/>:<X size={13}/>;}
function money(value:number|null|undefined){
  return value==null||!Number.isFinite(value)?"—":new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:value>=100?2:4}).format(value);
}

export function CueCheatSheet({
  symbol,
  timeframe,
  signal,
  action,
  fresh,
  hasPosition,
  intelligence,
}:{
  symbol:string;
  timeframe:string;
  signal:CueSignal|CueSignalUnavailable;
  action:"BUY"|"WAIT"|"HOLD"|"SELL"|null;
  fresh:boolean;
  hasPosition:boolean;
  intelligence?:{
    compositeScore:number|null;
    alignment:string;
    marketChangePercent:number|null;
    action:"ENTRY_READY"|"WAIT"|"AVOID";
  }|null;
}){
  if(!signal.available){
    return <div className={styles.empty}><CircleAlert size={15}/><span>Need more Webull candles before TradeCUE can score this chart.</span></div>;
  }

  const checks=[
    {label:"Trend",value:signal.componentScores.trend,pass:signal.componentScores.trend>=65},
    {label:"Momentum",value:signal.componentScores.momentum,pass:signal.componentScores.momentum>=60},
    {label:"Volume",value:signal.componentScores.volume,pass:signal.componentScores.volume>=50},
    {label:"Setup",value:signal.componentScores.setup,pass:signal.componentScores.setup>=65},
    {label:"Fresh data",value:fresh?"LIVE":"STALE",pass:fresh},
  ];

  const headline=action==="BUY"?"ENTRY READY":action==="SELL"?"EXIT REVIEW":action==="HOLD"?"HOLD / MANAGE":"DO NOT ENTER YET";
  const variant=action==="BUY"||action==="HOLD"?"success":action==="SELL"?"destructive":"warning";
  const failed=checks.filter(check=>!check.pass).map(check=>check.label);
  const why=failed.length
    ? "Blocked by "+failed.join(", ")+"."
    : hasPosition
      ? "Current position still meets the core technical checks."
      : "Core technical checks pass on the current chart.";

  return <section className={styles.sheet}>
    <div className={styles.head}>
      <div><small>PROFESSOR CUE • CURRENT CHART</small><strong>{symbol} · {timeframe}</strong></div>
      <Badge variant={variant as any}>{headline}</Badge>
    </div>
    <div className={styles.checks}>
      {checks.map(check=><div key={check.label} className={check.pass?styles.pass:styles.fail}>
        <span>{passIcon(check.pass)}{check.label}</span>
        <strong>{typeof check.value==="number"?check.value+"/100":check.value}</strong>
      </div>)}
    </div>
    <p><strong>Why:</strong> {why}</p>
    <div className={styles.quick}>
      <span><b>Price</b>{money(signal.metrics.close)}</span>
      <span><b>RVOL</b>{signal.metrics.relativeVolume.toFixed(2)}×</span>
      <span><b>RSI</b>{signal.metrics.rsi14.toFixed(1)}</span>
      <span><b>ATR</b>{signal.metrics.atrPercent.toFixed(2)}%</span>
      {intelligence&&<span><b>MTF</b>{intelligence.alignment}</span>}
      {intelligence&&<span><b>Composite</b>{intelligence.compositeScore??"—"}/100</span>}
      {intelligence&&<span><b>SPY</b>{intelligence.marketChangePercent==null?"—":(intelligence.marketChangePercent>=0?"+":"")+intelligence.marketChangePercent.toFixed(2)+"%"}</span>}
      {intelligence&&<span><b>Intelligence</b>{intelligence.action.replace("_"," ")}</span>}
    </div>
    {signal.plan&&fresh&&<div className={styles.levels}>
      <span><b>Entry</b>{money(signal.plan.entryLow)}–{money(signal.plan.entryHigh)}</span>
      <span><b>Stop</b>{money(signal.plan.stop)}</span>
      <span><b>Target</b>{money(signal.plan.target2)}</span>
    </div>}
    <div className={styles.playbook}>
      <span><b>BUY</b> All core checks green + fresh data + MTF confirms</span>
      <span><b>WAIT</b> Any core check fails, data is stale, or price is extended</span>
      <span><b>HOLD</b> You own it and the setup remains constructive</span>
      <span><b>EXIT</b> Position weakens into AVOID or your planned stop is threatened</span>
    </div>
  </section>;
}

