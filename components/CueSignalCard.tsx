import React from "react";
import {Crosshair,ShieldAlert,Trophy} from "lucide-react";
import {tradeTargetLadder,type PlanLike,type TargetMode} from "../helpers/tradeTargetLadder";
import styles from "./CueSignalCard.module.css";

function price(value:number|null|undefined){
  return value==null||!Number.isFinite(value)
    ?"—"
    :new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",minimumFractionDigits:2,maximumFractionDigits:value>=100?2:4}).format(value);
}

export function CueSignalCard({
  symbol,timeframe,setupLabel,action,grade,score,plan,mode,onModeChange,fresh,lastPrice,
}:{
  symbol:string;
  timeframe:string;
  setupLabel:string;
  action:string;
  grade:string;
  score:number|null;
  plan:PlanLike|null|undefined;
  mode:TargetMode;
  onModeChange:(mode:TargetMode)=>void;
  fresh:boolean;
  lastPrice:number|null|undefined;
}){
  const ladder=tradeTargetLadder(plan,mode);
  const ready=action==="ENTER"||action==="HOLD"||action.includes("TAKE")||action==="RAISE STOP";
  const signalLabel=action==="ENTER"?"OPTIMAL BUY":action==="WAIT / ARMED"?"WATCH / ARMED":action;
  const actionClass=action==="ENTER"||action==="HOLD"?styles.good:action==="EXIT"||action==="STAY AWAY"||action==="DATA CHECK"?styles.bad:styles.wait;

  return <section className={styles.card} aria-label="TradeCUE signal card">
    <div className={styles.head}>
      <div>
        <small>{ready?"🟢":"🟡"} {signalLabel}</small>
        <h3>{symbol} · {timeframe}</h3>
        <p>{setupLabel} · PAPER GUIDANCE</p>
      </div>
      <div className={styles.grade}><span>GRADE</span><strong>{grade}</strong><em>{score==null?"—":score+"/100"}</em></div>
    </div>

    <div className={styles.modeSwitch} role="group" aria-label="Profit target style">
      <button type="button" aria-pressed={mode==="standard"} className={mode==="standard"?styles.active:undefined} onClick={()=>onModeChange("standard")}>
        Standard <span>1R · 2R · 3R</span>
      </button>
      <button type="button" aria-pressed={mode==="crawl"} className={mode==="crawl"?styles.active:undefined} onClick={()=>onModeChange("crawl")}>
        Crawl <span>0.5R · 1R · 2R · 3R</span>
      </button>
    </div>

    <div className={styles.status}>
      <span><b>LAST</b>{price(lastPrice)}</span>
      <span><b>DATA</b>{fresh?"CURRENT":"STALE"}</span>
      <span><b>STATE</b><strong className={actionClass}>{action}</strong></span>
    </div>

    <div className={styles.levels}>
      <div className={styles.entry}><Crosshair size={15}/><span><b>ENTRY / TRIGGER</b><strong>{price(plan?.entryHigh)}</strong></span></div>
      <div className={styles.stop}><ShieldAlert size={15}/><span><b>STOP / INVALIDATION</b><strong>{price(plan?.stop)}</strong></span></div>
      {ladder.map(step=><div className={styles.target} key={step.key}>
        <Trophy size={14}/><span><b>{step.key} · {step.label}</b><strong>{price(step.price)}</strong></span>
      </div>)}
    </div>

    <p className={styles.foot}>{mode==="crawl"
      ?"Crawl Mode takes an earlier 0.5R checkpoint, then keeps 1R/2R/3R runner targets. It does not guarantee profit or place a partial order by itself."
      :"Standard Mode keeps the original 1R/2R/3R target ladder. A displayed plan is not a fill."}</p>
  </section>;
}
   70