import React from "react";
import { BrainCircuit, CheckCircle2, Circle } from "lucide-react";
import { Badge } from "./Badge";
import type { CueSignal, CueSignalUnavailable } from "../helpers/cueSignal";
import styles from "./ProfessorCueLive.module.css";

type Action="BUY"|"WAIT"|"HOLD"|"SELL"|"AVOID"|null;

function money(value:number|null|undefined){
  return value==null||!Number.isFinite(value)
    ?"—"
    :new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:value>=100?2:4}).format(value);
}
function stageText(stage:CueSignal["setupStage"]){
  if(stage==="PRICE_ACTION_BEARISH")return "Price action is bearish. Lower highs + lower lows block the long.";
  if(stage==="PRICE_ACTION_NOT_BULLISH")return "Price action is not a clean higher-high + higher-low uptrend yet.";
  if(stage==="BELOW_EMA20")return "Price is below EMA20.";
  if(stage==="EMA20_NOT_RISING")return "EMA20 is not rising yet.";
  if(stage==="VWAP_UNAVAILABLE")return "Regular-session VWAP is not available yet.";
  if(stage==="BELOW_VWAP")return "Price is below VWAP. Buyers do not have full control.";
  if(stage==="VOLUME_NOT_RISING")return "Volume is not expanding on the confirmation candle.";
  if(stage==="TOO_EXTENDED")return "Price is too extended. Do not chase.";
  if(stage==="TARGET_UNREALISTIC")return "The 2R target is too far relative to current ATR. No trade.";
  if(stage==="WAIT_PULLBACK")return "Wait for a pullback toward EMA20.";
  if(stage==="WAIT_GREEN")return "Pullback is in. Wait for a green confirmation candle.";
  return "Setup confirmed. Entry, stop and targets are defined.";
}

export function ProfessorCueLive({
  symbol,timeframe,signal,action,fresh,hasPosition,
}:{
  symbol:string;
  timeframe:string;
  signal:CueSignal|CueSignalUnavailable;
  action:Action;
  fresh:boolean;
  trend:"BULLISH"|"BEARISH"|"RANGE";
  pattern:string;
  structureSummary:string;
  hasPosition:boolean;
  alignment?:string|null;
}){
  const variant=action==="BUY"||action==="HOLD"?"success":action==="SELL"||action==="AVOID"?"destructive":"warning";
  const headline=action==="BUY"?"ENTER":action==="SELL"?"EXIT":action==="HOLD"?"HOLD":action==="AVOID"?"STAY OUT":"WAIT";

  if(!signal.available){
    return <section className={styles.panel} id="professor-cue">
      <div className={styles.head}>
        <div className={styles.avatar}><BrainCircuit size={20}/></div>
        <div className={styles.identity}><small>PROFESSOR CUE</small><strong>{symbol} · {timeframe}</strong></div>
        <Badge variant="warning">WAIT</Badge>
      </div>
      <div className={styles.decision}>
        <small>CHART CALL</small>
        <strong>WAIT</strong>
        <p>Need more completed candles before I can grade this setup.</p>
      </div>
    </section>;
  }

  const checks=[
    {
      label:"Price action",
      pass:signal.metrics.priceActionTrend==="BULLISH",
      detail:signal.metrics.priceActionTrend+" · "+signal.metrics.priceActionPattern,
    },
    {
      label:"EMA20 trend",
      pass:signal.metrics.ema20Rising,
      detail:signal.metrics.ema20Rising?"EMA20 rising":"EMA20 not rising",
    },
    {
      label:"Above EMA20",
      pass:signal.metrics.aboveEma20,
      detail:money(signal.metrics.close)+" vs "+money(signal.metrics.ema20),
    },
    {
      label:"Above VWAP",
      pass:signal.metrics.aboveVwap,
      detail:signal.metrics.vwap==null?"VWAP unavailable":money(signal.metrics.close)+" vs "+money(signal.metrics.vwap),
    },
    {
      label:"Volume",
      pass:signal.metrics.volumeIncreasing,
      detail:signal.metrics.volumeIncreasing?"Increasing":"Not increasing",
    },
    {
      label:"Pullback",
      pass:signal.metrics.pullback,
      detail:signal.metrics.pullback?"Reached EMA20 area":"Waiting for pullback",
    },
    {
      label:"Green candle",
      pass:signal.metrics.greenConfirmation,
      detail:signal.metrics.greenConfirmation?"Confirmed":"Waiting for confirmation",
    },
    {
      label:"Stop",
      pass:Boolean(signal.plan),
      detail:signal.plan?money(signal.plan.stop):"Not defined",
    },
    {
      label:"Target",
      pass:Boolean(signal.plan),
      detail:signal.plan?money(signal.plan.target2)+" · 2R":"Not defined",
    },
  ];

  const reason=!fresh
    ?"Market data is stale."
    :action==="BUY"
      ?"Enter only inside the planned zone. Do not chase."
      :action==="HOLD"
        ?"Position is open. Follow the original stop and targets."
        :action==="SELL"
          ?"The setup broke. Protect capital."
          :stageText(signal.setupStage);

  return <section className={styles.panel} id="professor-cue">
    <div className={styles.head}>
      <div className={styles.avatar}><BrainCircuit size={20}/></div>
      <div className={styles.identity}>
        <small>PROFESSOR CUE</small>
        <strong>{symbol} · {timeframe}</strong>
      </div>
      <Badge variant={variant as any}>{headline}</Badge>
    </div>

    <div className={styles.decision}>
      <small>{hasPosition?"POSITION CALL":"CHART CALL"}</small>
      <strong className={action==="BUY"||action==="HOLD"?styles.positive:action==="SELL"||action==="AVOID"?styles.negative:styles.caution}>{headline}</strong>
      <p>{reason}</p>
    </div>

    <div className={styles.checklist}>
      {checks.map(item=><div key={item.label} className={item.pass?styles.checkPass:styles.checkWait}>
        {item.pass?<CheckCircle2 size={18}/>:<Circle size={18}/>}
        <b>{item.label}</b>
        <span>{item.detail}</span>
      </div>)}
    </div>

    {signal.plan&&<div className={styles.plan}>
      <div className={styles.planWide}><small>ENTRY</small><strong>{money(signal.plan.entryLow)} – {money(signal.plan.entryHigh)}</strong></div>
      <div><small>STOP</small><strong className={styles.negative}>{money(signal.plan.stop)}</strong></div>
      <div><small>TP1 · 1R</small><strong>{money(signal.plan.target1)}</strong></div>
      <div><small>TP2 · 2R</small><strong className={styles.positive}>{money(signal.plan.target2)}</strong></div>
      <div><small>TP3 · 3R</small><strong>{money(signal.plan.target3)}</strong></div>
    </div>}

    <div className={styles.footer}>
      <span>{signal.setupStage==="ENTRY_READY"?"A+ SETUP READY":"WAIT FOR A+ SETUP"}</span>
      <p>Bullish price action + rising EMA20 + above VWAP + increasing volume + pullback + green confirmation. Primary training target: 2R.</p>
    </div>
  </section>;
}
