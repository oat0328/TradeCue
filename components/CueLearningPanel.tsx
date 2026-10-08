import React from "react";
import { BrainCircuit,ChartNoAxesCombined,Trophy } from "lucide-react";
import { Badge } from "./Badge";
import { useLearningSummary } from "../helpers/useLearningSummary";
import styles from "./CueLearningPanel.module.css";
function n(value:number|null,d=2){return value==null?"—":Number.isFinite(value)?value.toFixed(d):"—";}
function money(value:number|null){return value==null?"—":(value>=0?"+":"-")+"$"+Math.abs(value).toFixed(2);}
export function CueLearningPanel({enabled=true}:{enabled?:boolean}){
  const q=useLearningSummary(enabled);
  const o=q.data?.overall;
  const p=q.data?.performance;
  const best=(q.data?.setups??[]).filter(s=>s.tradeCount>=5&&s.expectancy!=null).sort((a,b)=>(b.expectancy??-99)-(a.expectancy??-99))[0];
  return <section className={styles.panel} id="cue-learning">
    <div className={styles.head}><div><small>OMEGA PERFORMANCE</small><h2>Prove the edge</h2><p>Omega learns from completed PaperTrade results. No synthetic win rates.</p></div><Badge variant={o?.confidence==="HIGH"?"success":o?.confidence==="MEDIUM"?"warning":"outline"}>{o?.confidence??"NO SAMPLE"}</Badge></div>
    <div className={styles.metrics}>
      <span><b>Resolved trades</b><strong>{o?.tradeCount??0}</strong></span>
      <span><b>Win rate</b><strong>{o?.winRate==null?"—":n(o.winRate,1)+"%"}</strong></span>
      <span><b>Expectancy</b><strong>{o?.expectancy==null?"—":n(o.expectancy)+"R"}</strong></span>
      <span><b>Profit factor</b><strong>{n(o?.profitFactor??null)}</strong></span>
      <span><b>Average R</b><strong>{o?.avgR==null?"—":n(o.avgR)+"R"}</strong></span>
      <span><b>Max losing streak</b><strong>{o?.maxLosingStreak??"—"}</strong></span>
      <span><b>Sharpe</b><strong>{p?.sharpeRatio==null?"—":n(p.sharpeRatio)}</strong></span>
      <span><b>Max drawdown</b><strong>{p? n(p.maxDrawdownR)+"R":"—"}</strong></span>
      <span><b>Best symbol</b><strong>{p?.bestSymbol? p.bestSymbol.key+" · "+n(p.bestSymbol.avgR)+"R":"—"}</strong></span>
      <span><b>Worst symbol</b><strong>{p?.worstSymbol? p.worstSymbol.key+" · "+n(p.worstSymbol.avgR)+"R":"—"}</strong></span>
      <span><b>Best time</b><strong>{p?.bestTime? p.bestTime.key+" · "+n(p.bestTime.avgR)+"R":"—"}</strong></span>
      <span><b>Worst time</b><strong>{p?.worstTime? p.worstTime.key+" · "+n(p.worstTime.avgR)+"R":"—"}</strong></span>
    </div>
    {q.data?.sampleWarning&&<div className={styles.warning}><BrainCircuit size={15}/>{q.data.sampleWarning}</div>}
    <div className={styles.insight}>
      <Trophy size={17}/><span><b>Best proven setup</b>{best?best.setup+" · "+n(best.expectancy)+"R expectancy over "+best.tradeCount+" trades":"Not enough resolved setup data yet."}</span>
    </div>
    {p&&<div className={styles.insight}>
      <ChartNoAxesCombined size={17}/><span><b>Omega success gate</b>
        PF &gt; 1.50 {p.successCriteria.profitFactorMet?"✓":"· building"} ·
        Win rate &gt; 50% {p.successCriteria.winRateMet?"✓":"· building"} ·
        Rule compliance &gt; 90% {p.ruleCompliance==null?"· no Omega sample":p.successCriteria.ruleComplianceMet?"✓":n(p.ruleCompliance,1)+"%"} ·
        Drawdown &lt; 10R {p.successCriteria.maxDrawdownUnder10R?"✓":"✕"} ·
        200 trades {p.successCriteria.sampleSizeMet?"✓":"· building"}
      </span>
    </div>}
    {q.data?.learningReview&&<div className={styles.insight}>
      <BrainCircuit size={17}/><span><b>100-trade review</b>
        {q.data.learningReview.completedMilestone
          ?" Reviewed through "+q.data.learningReview.completedMilestone+" trades. Next review at "+q.data.learningReview.nextMilestone+"."
          :" First formal review at 100 resolved trades."}
        {" "}Omega never changes the strategy automatically.
        {q.data.learningReview.recommendations.length>0&&<><br/>{q.data.learningReview.recommendations.slice(0,3).join(" · ")}</>}
      </span>
    </div>}
    <div className={styles.trades}>
      <div className={styles.tradesHead}><ChartNoAxesCombined size={15}/><strong>Recent resolved trades</strong></div>
      {(q.data?.recentTrades??[]).slice(0,8).map(t=><div key={t.id}><b>{t.symbol}</b><span>{t.outcome??"—"}</span><em>{t.realizedR==null?"—":n(t.realizedR)+"R"}</em><strong>{money(t.realizedPnl)}</strong></div>)}
      {!q.isFetching&&!q.data?.recentTrades.length&&<p>No resolved Omega paper trades yet. The journal will populate from actual fills.</p>}
    </div>
  </section>;
}