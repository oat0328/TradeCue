import React from "react";
import { BookOpen,RefreshCw } from "lucide-react";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { useCueJournal } from "../helpers/useCueJournal";
import styles from "./CueJournalPanel.module.css";

function money(value:number|null|undefined){
  return value==null||!Number.isFinite(value)?"—":new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:2}).format(value);
}
function when(value:string|null|undefined){
  if(!value)return "—";
  return new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit",hour12:true}).format(new Date(value));
}
function pnlClass(value:number|null|undefined){return value==null?undefined:value>=0?styles.win:styles.loss;}

export function CueJournalPanel({enabled}:{enabled:boolean}){
  const journal=useCueJournal(enabled);
  if(!enabled)return null;
  const trades=journal.activity.data?.trades??[];
  const decisions=journal.activity.data?.decisions??[];
  const orders=journal.activity.data?.orders??[];
  const resolved=trades.filter(row=>row.realizedPnl!=null);
  const realized=resolved.reduce((sum,row)=>sum+(row.realizedPnl??0),0);
  const wins=resolved.filter(row=>(row.realizedPnl??0)>0).length;
  const winRate=resolved.length?wins/resolved.length*100:null;

  return <section className={styles.panel} id="journal">
    <div className={styles.head}>
      <div><small>TRADE JOURNAL</small><h2>What Omega actually did</h2><p>Confirmed fills, paired trades, signals and broker orders. No invented performance.</p></div>
      <div className={styles.headActions}>
        <Badge variant="outline">{trades.length} TRADES · {orders.length} ORDERS</Badge>
        <Button size="sm" variant="outline" disabled={journal.sync.isFetching} onClick={()=>journal.sync.refetch()}><RefreshCw size={14}/>{journal.sync.isFetching?"Syncing":"Sync Webull"}</Button>
      </div>
    </div>

    <div className={styles.summary}>
      <span><small>Resolved</small><strong>{resolved.length}</strong></span>
      <span><small>Wins</small><strong>{wins}</strong></span>
      <span><small>Win rate</small><strong>{winRate==null?"—":winRate.toFixed(1)+"%"}</strong></span>
      <span><small>Realized P&L</small><strong className={pnlClass(realized)}>{money(realized)}</strong></span>
    </div>

    <div className={styles.syncLine}>
      {journal.sync.isFetching?"Syncing confirmed Webull fills…":journal.sync.data?"Last broker sync: "+when(journal.sync.data.syncedAt):"Broker sync pending"}
      <span>Auto-sync every 2 minutes while the workstation is open.</span>
    </div>
    {journal.sync.error&&<p className={styles.error} role="alert">{journal.sync.error.message}</p>}
    {journal.activity.error&&<p className={styles.error} role="alert">{journal.activity.error.message}</p>}

    <article className={styles.section}>
      <div className={styles.sectionHead}><h3>Confirmed paper trades</h3><span>Entry → exit → realized result</span></div>
      {trades.length?<div className={styles.tradeTable}>
        <div className={styles.tableHead}><span>Trade</span><span>Entry</span><span>Exit</span><span>Result</span><span>Time</span></div>
        {trades.map(row=><div className={styles.tradeRow} key={row.id}>
          <span><b>{row.symbol}</b><em>{row.status.toUpperCase()}</em><small>{row.quantity??"—"} shares · {row.setup==="EXTERNAL_PAPER"?"Broker import":"TradeCUE"}</small>{row.exitTime==null&&row.stopPrice!=null&&<small>Stop {money(row.stopPrice)} · TP2 {money(row.target2)}</small>}</span>
          <span><small>Entry</small><strong>{money(row.entryPrice)}</strong></span>
          <span><small>Exit</small><strong>{money(row.exitPrice)}</strong></span>
          <span><small>Realized</small><strong className={pnlClass(row.realizedPnl)}>{row.realizedPnl==null?"Pending":money(row.realizedPnl)}</strong></span>
          <span><small>Opened</small><strong>{when(row.entryTime)}</strong>{row.exitTime&&<small>Closed {when(row.exitTime)}</small>}</span>
        </div>)}
      </div>:<div className={styles.empty}>No paired fills yet. Missing broker fill prices or times remain unconfirmed instead of being guessed.</div>}
    </article>

    <div className={styles.grid}>
      <article className={styles.section}>
        <div className={styles.sectionHead}><h3>Recent signals</h3><span>What the strategy saw</span></div>
        {decisions.length?<div className={styles.activityList}>{decisions.slice(0,16).map(row=><div key={row.id}>
          <span><b>{row.symbol}</b><em>{row.action}</em></span>
          <p>{typeof row.details.score==="number"?"Score "+row.details.score:"Signal recorded"}{typeof row.details.structure==="string"?" · "+row.details.structure:""}</p>
          <time>{when(row.createdAt)}</time>
        </div>)}</div>:<div className={styles.empty}>No signals logged yet.</div>}
      </article>

      <article className={styles.section}>
        <div className={styles.sectionHead}><h3>Webull paper orders</h3><span>What was sent to the broker</span></div>
        {orders.length?<div className={styles.activityList}>{orders.slice(0,16).map(row=><div key={row.id}>
          <span><b>{row.symbol}</b><em>{row.side}</em></span>
          <p>{row.quantity??"—"} shares · {row.orderType}{row.limitPrice?" @ "+money(row.limitPrice):""}</p>
          <time>{row.status} · {when(row.createdAt)}</time>
        </div>)}</div>:<div className={styles.empty}>No paper orders logged yet.</div>}
      </article>
    </div>

    <div className={styles.note}><BookOpen size={16}/><span>Use this screen as the truth source. Submitted orders are not counted as profits; performance requires confirmed fills and paired exits.</span></div>
  </section>;
}
