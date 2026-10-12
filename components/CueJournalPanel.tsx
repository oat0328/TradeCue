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
function startOfWeek(date=new Date()){
  const d=new Date(date);
  const day=d.getDay();
  const diff=day===0?6:day-1;
  d.setHours(0,0,0,0);
  d.setDate(d.getDate()-diff);
  return d;
}
function shortDate(value:Date){return new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric"}).format(value);}
function bestSetup(rows:Array<{setup:string;realizedPnl:number|null}>){
  const sums=new Map<string,number>();
  for(const row of rows)sums.set(row.setup,(sums.get(row.setup)??0)+(row.realizedPnl??0));
  return [...sums.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]??"—";
}
function bestHour(rows:Array<{entryTime:string;realizedPnl:number|null}>){
  const sums=new Map<number,number>();
  for(const row of rows){
    const hour=new Date(row.entryTime).getHours();
    sums.set(hour,(sums.get(hour)??0)+(row.realizedPnl??0));
  }
  const hour=[...sums.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0];
  if(hour==null)return "—";
  return new Intl.DateTimeFormat("en-US",{hour:"numeric",hour12:true}).format(new Date(2026,0,1,hour));
}

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

  const weekStart=startOfWeek();
  const weekEnd=new Date(weekStart);weekEnd.setDate(weekEnd.getDate()+6);
  const weekly=resolved.filter(row=>row.exitTime&&new Date(row.exitTime)>=weekStart);
  const weeklyWins=weekly.filter(row=>(row.realizedPnl??0)>0);
  const weeklyLosses=weekly.filter(row=>(row.realizedPnl??0)<0);
  const weeklyGrossWins=weeklyWins.reduce((sum,row)=>sum+(row.realizedPnl??0),0);
  const weeklyGrossLosses=Math.abs(weeklyLosses.reduce((sum,row)=>sum+(row.realizedPnl??0),0));
  const weeklyNet=weeklyGrossWins-weeklyGrossLosses;
  const weeklyWinRate=weekly.length?weeklyWins.length/weekly.length*100:null;
  const weeklyProfitFactor=weeklyGrossLosses>0?weeklyGrossWins/weeklyGrossLosses:weeklyGrossWins>0?999:null;
  const weeklyAvgWinner=weeklyWins.length?weeklyGrossWins/weeklyWins.length:null;
  const weeklyAvgLoser=weeklyLosses.length?weeklyLosses.reduce((sum,row)=>sum+(row.realizedPnl??0),0)/weeklyLosses.length:null;

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

    <article className={styles.weekly}>
      <div className={styles.weeklyHead}>
        <div><small>OMEGA WEEKLY SCORECARD</small><h3>{shortDate(weekStart)} – {shortDate(weekEnd)}</h3><p>Confirmed paper fills only. No submitted order is counted as a win.</p></div>
        <Badge variant={weeklyNet>=0?"success":"destructive"}>{weekly.length} CLOSED TRADES</Badge>
      </div>
      <div className={styles.weeklyGrid}>
        <span><b>Wins / losses</b><strong>{weeklyWins.length} / {weeklyLosses.length}</strong></span>
        <span><b>Win rate</b><strong>{weeklyWinRate==null?"—":weeklyWinRate.toFixed(1)+"%"}</strong></span>
        <span><b>Gross wins</b><strong className={styles.win}>{money(weeklyGrossWins)}</strong></span>
        <span><b>Gross losses</b><strong className={styles.loss}>{weeklyGrossLosses?money(-weeklyGrossLosses):money(0)}</strong></span>
        <span><b>Net P&L</b><strong className={pnlClass(weeklyNet)}>{money(weeklyNet)}</strong></span>
        <span><b>Profit factor</b><strong>{weeklyProfitFactor==null?"—":weeklyProfitFactor>=999?"∞":weeklyProfitFactor.toFixed(2)}</strong></span>
        <span><b>Avg winner</b><strong className={styles.win}>{money(weeklyAvgWinner)}</strong></span>
        <span><b>Avg loser</b><strong className={styles.loss}>{money(weeklyAvgLoser)}</strong></span>
        <span><b>Best setup</b><strong>{weekly.length?bestSetup(weekly):"—"}</strong></span>
        <span><b>Best entry hour</b><strong>{weekly.length?bestHour(weekly):"—"}</strong></span>
      </div>
    </article>

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
  144