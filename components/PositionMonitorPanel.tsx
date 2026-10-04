import React from "react";
import { AlertTriangle, Crosshair, ShieldCheck } from "lucide-react";
import { Badge } from "./Badge";
import { usePositionMonitor } from "../helpers/useMarketDesk";
import styles from "./PositionMonitorPanel.module.css";

function money(value:string|number|null|undefined){
  const number=Number(value);
  return value==null||value===""||!Number.isFinite(number)?"—":new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(number);
}
function price(value:number|null){
  return value==null?"—":new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:value>=100?2:4}).format(value);
}

export function PositionMonitorPanel({
  enabled,
  accountId,
  onOpenSymbol,
}:{
  enabled:boolean;
  accountId?:string;
  onOpenSymbol:(symbol:string)=>void;
}){
  const monitor=usePositionMonitor(enabled,accountId);
  if(!enabled)return null;

  return <section className={styles.panel} id="position-monitor">
    <div className={styles.head}>
      <div><small>POSITION SENTINEL</small><h2>TradeCUE exit & hold monitor</h2><p>Your open Webull paper positions are re-checked against fresh 5-minute TradeCUE technical conditions.</p></div>
      <Badge variant={monitor.data?"success":"outline"}>{monitor.data?"MONITORING":"WAITING"}</Badge>
    </div>

    {monitor.isFetching&&!monitor.data&&<p className={styles.note}>Evaluating open positions…</p>}
    {monitor.error&&<p className={styles.error}>{monitor.error.message}</p>}

    <div className={styles.grid}>
      {monitor.data?.positions.map(row=>{
        const danger=row.cue==="EXIT REVIEW";
        const good=row.cue==="HOLD";
        return <button key={row.symbol} className={danger?styles.dangerCard:good?styles.goodCard:styles.card} onClick={()=>onOpenSymbol(row.symbol)}>
          <div className={styles.cardHead}>
            <div><strong>{row.symbol}</strong><small>{row.quantity??"—"} shares</small></div>
            <span className={danger?styles.exit:good?styles.hold:styles.watch}>{row.cue}</span>
          </div>
          <div className={styles.metrics}>
            <div><small>Last</small><strong>{price(row.lastPrice)}</strong></div>
            <div><small>Cost</small><strong>{money(row.costPrice)}</strong></div>
            <div><small>Unrealized</small><strong className={Number(row.unrealizedPnl??0)>=0?styles.positive:styles.negative}>{money(row.unrealizedPnl)}</strong></div>
            <div><small>CUE Score</small><strong>{row.cueScore??"—"}</strong></div>
          </div>
          <p>{row.reason}</p>
          <div className={styles.levels}>
            <span><ShieldCheck size={12}/>Stop {price(row.stop)}</span>
            <span><Crosshair size={12}/>Target {price(row.target)}</span>
          </div>
          {danger&&<div className={styles.alert}><AlertTriangle size={13}/>Review exit now; do not treat this as guaranteed advice.</div>}
        </button>;
      })}
      {monitor.data&&!monitor.data.positions.length&&<div className={styles.empty}>No open Webull paper positions to monitor.</div>}
    </div>
  </section>;
}

