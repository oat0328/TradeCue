import React, { useState } from "react";
import { Activity, Radar, RefreshCw, WalletCards } from "lucide-react";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Input } from "./Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./Select";
import { useCueHunter } from "../helpers/useCueHunter";
import styles from "./CueHunterPanel.module.css";

function money(value:number|null|undefined){
  if(value==null||!Number.isFinite(value))return "—";
  return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:value>=100?2:4}).format(value);
}
function actionVariant(action:"ENTRY_READY"|"WATCH"|"WAIT"){
  return action==="ENTRY_READY"?"success":action==="WATCH"?"outline":"warning";
}
function tf(value:number|null){return value==null?"—":String(value);}

export function CueHunterPanel({
  enabled,
  onOpenSymbol,
}:{
  enabled:boolean;
  onOpenSymbol:(symbol:string)=>void;
}){
  const [mode,setMode]=useState<"auto"|"active"|"momentum"|"buy_low">("auto");
  const [budgetText,setBudgetText]=useState("100");
  const [maxPriceText,setMaxPriceText]=useState("100");
  const [minScoreText,setMinScoreText]=useState("65");

  const budget=Number(budgetText)>0?Number(budgetText):undefined;
  const maxPrice=Number(maxPriceText)>0?Number(maxPriceText):undefined;
  const minScore=Math.max(0,Math.min(100,Number(minScoreText)||0));
  const hunter=useCueHunter(enabled,{mode,budget,maxPrice,minScore,limit:12});

  if(!enabled)return null;
  const top=hunter.data?.rows[0];

  return <section className={styles.panel} id="hunter">
    <div className={styles.head}>
      <div>
        <small>CUE HUNTER</small>
        <h2>{hunter.data?.marketMode==="WEEKEND_PREP"?"Monday Prep Hunter":"Opportunity Hunt"}</h2>
        <p>{hunter.data?.marketMode==="WEEKEND_PREP"?"Ranks Friday-close setups for Monday review. No stock Entry Ready while the market is closed.":"Auto-scans Webull every 60s · 5m + 15m + 1H alignment."}</p>
      </div>
      <div className={styles.liveState}><span/><strong>{hunter.isFetching?"SCANNING":"AUTO ON"}</strong></div>
    </div>

    <div className={styles.filters}>
      <label>Hunt<Select value={mode} onValueChange={(value)=>setMode(value as typeof mode)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>
        <SelectItem value="auto">Auto Hunt</SelectItem>
        <SelectItem value="active">Most active</SelectItem>
        <SelectItem value="momentum">Top gainers</SelectItem>
        <SelectItem value="buy_low">Pullbacks</SelectItem>
      </SelectContent></Select></label>
      <label>Budget<Input inputMode="decimal" value={budgetText} onChange={event=>setBudgetText(event.target.value)} placeholder="100"/></label>
      <label>Max price<Input inputMode="decimal" value={maxPriceText} onChange={event=>setMaxPriceText(event.target.value)} placeholder="100"/></label>
      <label>Min score<Input inputMode="numeric" value={minScoreText} onChange={event=>setMinScoreText(event.target.value.replace(/[^0-9]/g,""))} placeholder="65"/></label>
      <Button variant="outline" disabled={hunter.isFetching} onClick={()=>hunter.refetch()}><RefreshCw size={14}/>{hunter.isFetching?"Scanning":"Scan now"}</Button>
    </div>

    {hunter.error&&<p className={styles.error} role="alert">{hunter.error.message}</p>}
    {hunter.isFetching&&!hunter.data&&<div className={styles.loading}><Radar size={18}/><span>Reading Webull candidates across three timeframes…</span></div>}

    {top&&<button className={top.action==="ENTRY_READY"?styles.heroReady:styles.hero} onClick={()=>onOpenSymbol(top.symbol)}>
      <div className={styles.heroSignal}>
        <span>{hunter.data?.marketMode==="WEEKEND_PREP"?"TOP MONDAY WATCH":top.action==="ENTRY_READY"?"TOP ENTRY":"TOP WATCH"}</span>
        <strong>{top.symbol}</strong>
        <em>{top.action.replace("_"," ")}</em>
      </div>
      <div className={styles.heroMetrics}>
        <span><small>Price</small><strong>{money(top.price)}</strong></span>
        <span><small>CUE Intel</small><strong>{top.cueScore??"—"}</strong></span>
        <span><small>Day</small><strong className={(top.changePercent??0)>=0?styles.positive:styles.negative}>{top.changePercent==null?"—":(top.changePercent>=0?"+":"")+top.changePercent.toFixed(2)+"%"}</strong></span>
        <span><small>RVOL</small><strong>{top.relativeVolume==null?"—":top.relativeVolume.toFixed(2)+"×"}</strong></span>
      </div>
      <div className={styles.timeframes}>
        <span><small>5m</small><strong>{tf(top.timeframeScores.fiveMin)}</strong></span>
        <span><small>15m</small><strong>{tf(top.timeframeScores.fifteenMin)}</strong></span>
        <span><small>1H</small><strong>{tf(top.timeframeScores.oneHour)}</strong></span>
        <span><small>Align</small><strong>{top.timeframeScores.bullishFrames}/3</strong></span>
      </div>
      <div className={styles.heroCta}>Open chart →</div>
    </button>}

    {hunter.data&&<>
      <div className={styles.meta}>
        <span><Activity size={12}/>{hunter.data.marketMode.replace("_"," ")} <strong>AUTO</strong></span>
        <span>Universe <strong>{hunter.data.universeCount}</strong></span>
        <span>Deep-check <strong>{hunter.data.evaluatedCount}</strong></span>
        <span>QQQ <strong>{hunter.data.marketContext.changePercent==null?"—":(hunter.data.marketContext.changePercent>=0?"+":"")+hunter.data.marketContext.changePercent.toFixed(2)+"%"}</strong></span>
        <span>Showing <strong>{hunter.data.rows.length}</strong></span>
      </div>

      <div className={styles.grid}>
        {hunter.data.rows.slice(top?1:0).map(row=><article key={row.symbol} className={styles.card}>
          <div className={styles.cardHead}>
            <button onClick={()=>onOpenSymbol(row.symbol)}><strong>{row.symbol}</strong><span>{row.name||row.sourceTags.join(" · ")}</span></button>
            <Badge variant={actionVariant(row.action) as any}>{row.action.replace("_"," ")}</Badge>
          </div>
          <div className={styles.metrics}>
            <div><small>Price</small><strong>{money(row.price)}</strong></div>
            <div><small>CUE</small><strong>{row.cueScore??"—"}</strong></div>
            <div><small>Day</small><strong className={row.changePercent==null?undefined:row.changePercent>=0?styles.positive:styles.negative}>{row.changePercent==null?"—":(row.changePercent>=0?"+":"")+row.changePercent.toFixed(2)+"%"}</strong></div>
            <div><small>RVOL</small><strong>{row.relativeVolume==null?"—":row.relativeVolume.toFixed(2)+"×"}</strong></div>
          </div>
          <div className={styles.tfRow}>
            <span>5m <strong>{tf(row.timeframeScores.fiveMin)}</strong></span>
            <span>15m <strong>{tf(row.timeframeScores.fifteenMin)}</strong></span>
            <span>1H <strong>{tf(row.timeframeScores.oneHour)}</strong></span>
            <span>{row.timeframeScores.bullishFrames}/3 bullish</span>
          </div>
          <div className={styles.budget}><WalletCards size={13}/><span>{budget?row.affordableShares&&row.affordableShares>0?row.affordableShares+" shares fit "+money(budget):"Over budget":"Budget off"}</span></div>
          {row.plan&&<div className={styles.plan}><span>Entry {money(row.plan.entryLow)}–{money(row.plan.entryHigh)}</span><span>Stop {money(row.plan.stop)}</span><span>TP2 {money(row.plan.target2)}</span></div>}
          <Button size="sm" variant="outline" onClick={()=>onOpenSymbol(row.symbol)}>Open chart</Button>
        </article>)}
      </div>
      {!hunter.data.rows.length&&<p className={styles.empty}>No qualified setup right now. Auto Hunt keeps checking while this workstation is open.</p>}
    </>}
  </section>;
}
