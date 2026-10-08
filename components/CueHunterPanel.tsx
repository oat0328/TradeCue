import React, { useState } from "react";
import { Activity, Radar, RefreshCw, WalletCards } from "lucide-react";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Input } from "./Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./Select";
import { useCueHunter } from "../helpers/useCueHunter";
import { useWatchlist } from "../helpers/useWatchlist";
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
  const [mode,setMode]=useState<"auto"|"active"|"momentum"|"buy_low"|"portfolio"|"bearish">("auto");
  const [budgetText,setBudgetText]=useState("100");
  const [maxPriceText,setMaxPriceText]=useState("");
  const [minScoreText,setMinScoreText]=useState("65");

  const budget=Number(budgetText)>0?Number(budgetText):undefined;
  const maxPrice=Number(maxPriceText)>0?Number(maxPriceText):undefined;
  const minScore=Math.max(0,Math.min(100,Number(minScoreText)||0));
  const hunter=useCueHunter(enabled,{mode,budget,maxPrice,minScore,limit:12});
  const watchlist=useWatchlist(enabled);

  if(!enabled)return null;
  const top=hunter.data?.rows[0];

  return <section className={styles.panel} id="hunter">
    <div className={styles.head}>
      <div>
        <small>MARKET SCANNER</small>
        <h2>{hunter.data?.marketMode==="WEEKEND_PREP"?"Monday Prep":"Opportunities"}</h2>
        <p>{hunter.data?.marketMode==="WEEKEND_PREP"?"Ranks the latest liquid movers for next-session review. No stock Entry Ready while the market is closed.":"Omega scans every 2 minutes. 1H direction + 15m confirmation + 5m execution. A/A+ only."}</p>
      </div>
      <div className={styles.liveState}><span/><strong>{hunter.isFetching?"SCANNING":"AUTO ON"}</strong></div>
    </div>

    <div className={styles.filters}>
      <label>Hunt<Select value={mode} onValueChange={(value)=>setMode(value as typeof mode)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>
        <SelectItem value="auto">Major stock movers</SelectItem>
        <SelectItem value="active">Most active</SelectItem>
        <SelectItem value="momentum">Top gainers</SelectItem>
        <SelectItem value="buy_low">Pullbacks</SelectItem>
        <SelectItem value="portfolio">Portfolio research</SelectItem>
        <SelectItem value="bearish">Bearish / short watch</SelectItem>
      </SelectContent></Select></label>
      <label>Budget<Input inputMode="decimal" value={budgetText} onChange={event=>setBudgetText(event.target.value)} placeholder="100"/></label>
      <label>Max price<Input inputMode="decimal" value={maxPriceText} onChange={event=>setMaxPriceText(event.target.value)} placeholder="100"/></label>
      <label>Min score<Input inputMode="numeric" value={minScoreText} onChange={event=>setMinScoreText(event.target.value.replace(/[^0-9]/g,""))} placeholder="65"/></label>
      <Button variant="outline" disabled={hunter.isFetching} onClick={()=>hunter.refetch()}><RefreshCw size={14}/>{hunter.isFetching?"Scanning":"Scan now"}</Button>
    </div>

    {hunter.error&&<p className={styles.error} role="alert">{hunter.error.message}</p>}
    {hunter.isFetching&&!hunter.data&&<div className={styles.loading}><Radar size={18}/><span>Reading Webull Top Gainers, Most Active and core liquid stocks…</span></div>}

    {top&&<button className={top.action==="ENTRY_READY"?styles.heroReady:styles.hero} onClick={()=>onOpenSymbol(top.symbol)}>
      <div className={styles.heroSignal}>
        <span>{hunter.data?.marketMode==="WEEKEND_PREP"?"TOP MONDAY WATCH":top.action==="ENTRY_READY"?"TOP ENTRY":"TOP WATCH"}</span>
        <strong>{top.symbol}</strong>
        <em>{top.action.replace("_"," ")}</em>
      </div>
      <div className={styles.heroMetrics}>
        <span><small>Price</small><strong>{money(top.price)}</strong></span>
        <span><small>Omega grade</small><strong>{top.setupGrade} · {top.setupScore12}/12</strong></span>
        <span><small>Confidence</small><strong>{top.confidence}%</strong></span>
        <span><small>Day</small><strong className={(top.changePercent??0)>=0?styles.positive:styles.negative}>{top.changePercent==null?"—":(top.changePercent>=0?"+":"")+top.changePercent.toFixed(2)+"%"}</strong></span>
        <span><small>RVOL</small><strong>{top.relativeVolume==null?"—":top.relativeVolume.toFixed(2)+"×"}</strong></span>
      </div>
      <div className={styles.sources}>{top.sourceTags.map(tag=><span key={tag}>{tag==="MOMENTUM"?"TOP GAINER":tag==="ACTIVE"?"MOST ACTIVE":tag==="CORE_LIQUID"?"CORE LIQUID":tag}</span>)}</div>
      <div className={styles.timeframes}>
        <span><small>5m</small><strong>{tf(top.timeframeScores.fiveMin)}</strong></span>
        <span><small>15m</small><strong>{tf(top.timeframeScores.fifteenMin)}</strong></span>
        <span><small>1H</small><strong>{tf(top.timeframeScores.oneHour)}</strong></span>
        <span><small>Align</small><strong>{top.timeframeScores.bullishFrames}/3 bullish</strong></span>
      </div>
      <div className={styles.heroCta}>Open chart →</div>
    </button>}

    {hunter.data&&<>
      <div className={styles.meta}>
        <span><Activity size={12}/>{hunter.data.marketMode.replace("_"," ")} <strong>AUTO</strong></span>
        <span>Omega market <strong>{hunter.data.marketContext.bias} · {hunter.data.marketContext.omegaMarketMode.replaceAll("_"," ")}</strong></span>
        <span>Breadth <strong>{hunter.data.marketContext.breadthScore}/100</strong></span>
        <span>A/D <strong>{hunter.data.marketContext.advancing}/{hunter.data.marketContext.declining}</strong></span>
        <span>New H/L <strong>{hunter.data.marketContext.newHighs}/{hunter.data.marketContext.newLows}</strong></span>
        <span>Universe <strong>{hunter.data.universeCount}</strong></span>
        <span>Deep-check <strong>{hunter.data.evaluatedCount}</strong></span>
        <span>SPY <strong>{hunter.data.marketContext.spyChangePercent==null?"—":(hunter.data.marketContext.spyChangePercent>=0?"+":"")+hunter.data.marketContext.spyChangePercent.toFixed(2)+"%"}</strong></span>
        <span>QQQ <strong>{hunter.data.marketContext.changePercent==null?"—":(hunter.data.marketContext.changePercent>=0?"+":"")+hunter.data.marketContext.changePercent.toFixed(2)+"%"}</strong></span>
        <span>Showing <strong>{hunter.data.rows.length}</strong></span>
      </div>

      <div className={styles.meta}>
        <span>Gainers <strong>{hunter.data.leaders.topGainers.map(row=>row.symbol).join(" · ")||"—"}</strong></span>
        <span>Losers <strong>{hunter.data.leaders.topLosers.map(row=>row.symbol).join(" · ")||"—"}</strong></span>
        <span>Buy team <strong>{hunter.data.leaders.topBuyTeam.join(" · ")||"—"}</strong></span>
        <span>Sell team <strong>{hunter.data.leaders.topSellTeam.join(" · ")||"—"}</strong></span>
        <span>Breakouts <strong>{hunter.data.leaders.breakoutCandidates.join(" · ")||"—"}</strong></span>
        <span>Retests <strong>{hunter.data.leaders.retestCandidates.join(" · ")||"—"}</strong></span>
        <span>Reversals <strong>{hunter.data.leaders.reversalCandidates.join(" · ")||"—"}</strong></span>
      </div>

      <div className={styles.grid}>
        {hunter.data.rows.slice(top?1:0).map(row=><article key={row.symbol} className={styles.card}>
          <div className={styles.cardHead}>
            <button onClick={()=>onOpenSymbol(row.symbol)}><strong>{row.symbol}</strong><span>{row.name||row.sourceTags.join(" · ")}</span></button>
            <div className={styles.cardActions}>
              <Badge variant={actionVariant(row.action)}>{row.action.replaceAll("_"," ")}</Badge>
              {(()=>{
                const watched=watchlist.list.data?.items.find(item=>item.symbol.toUpperCase()===row.symbol.toUpperCase());
                return <Button size="sm" variant={watched?"secondary":"outline"} disabled={watchlist.mutate.isPending} onClick={async()=>{
                  if(watched)await watchlist.mutate.mutateAsync({action:"remove",id:watched.id});
                  else await watchlist.mutate.mutateAsync({action:"add",symbol:row.symbol,assetType:"stocks"});
                }}>{watched?"Watching":"Watch"}</Button>;
              })()}
            </div>
          </div>
          <div className={styles.opportunityTag}>{row.opportunityType.replaceAll("_"," ")}</div>
          <div className={styles.sources}>{row.sourceTags.map(tag=><span key={tag}>{tag==="MOMENTUM"?"TOP GAINER":tag==="ACTIVE"?"MOST ACTIVE":tag==="CORE_LIQUID"?"CORE LIQUID":tag}</span>)}</div>
          <div className={styles.metrics}>
            <div><small>Price</small><strong>{money(row.price)}</strong></div>
            <div><small>Grade</small><strong>{row.setupGrade} · {row.setupScore12}/12</strong></div>
            <div><small>Confidence</small><strong>{row.confidence}%</strong></div>
            <div><small>Day</small><strong className={row.changePercent==null?undefined:row.changePercent>=0?styles.positive:styles.negative}>{row.changePercent==null?"—":(row.changePercent>=0?"+":"")+row.changePercent.toFixed(2)+"%"}</strong></div>
            <div><small>RVOL</small><strong>{row.relativeVolume==null?"—":row.relativeVolume.toFixed(2)+"×"}</strong></div>
          </div>
          <div className={styles.tfRow}>
            <span><b>5m trigger</b><strong>{tf(row.timeframeScores.fiveMin)}</strong></span>
            <span><b>15m context</b><strong>{tf(row.timeframeScores.fifteenMin)}</strong></span>
            <span><b>1H context</b><strong>{tf(row.timeframeScores.oneHour)}</strong></span>
            <span><b>Trend</b><strong>{row.timeframeScores.bullishFrames}/3 bullish</strong></span>
          </div>
          {(row.shadowShortGrade==="A"||row.shadowShortGrade==="A+")&&<div className={styles.budget}><Radar size={13}/><span>SELL TEAM SHADOW · {row.shadowShortGrade} {row.shadowShortScore12}/12 · {row.shadowShortConfidence}% · no short order submitted</span></div>}
          <div className={styles.budget}><WalletCards size={13}/><span>{budget?row.affordableShares&&row.affordableShares>0?row.affordableShares+" shares fit "+money(budget):"Over budget":"Budget off"}</span></div>
          {row.plan&&<div className={styles.plan}>
            <span><b>ENTRY</b>{money(row.plan.entryLow)}–{money(row.plan.entryHigh)}</span>
            <span><b>STOP</b>{money(row.plan.stop)}</span>
            <span><b>TP2 · 2R</b>{money(row.plan.target2)}</span>
          </div>}
          <Button size="sm" variant="outline" onClick={()=>onOpenSymbol(row.symbol)}>Open chart</Button>
        </article>)}
      </div>
      {!hunter.data.rows.length&&<p className={styles.empty}>No qualified setup right now. Auto Hunt keeps checking while this workstation is open.</p>}
      <p className={styles.note}>{hunter.data.note}</p>
    </>}
  </section>;
}
