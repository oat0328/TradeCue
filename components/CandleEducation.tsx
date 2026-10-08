import React,{useMemo,useState} from "react";
import type { Candle } from "../helpers/chartMath";
import { historicalCandleLesson } from "../helpers/candleLesson";
import styles from "./CandleEducation.module.css";
const money=(n:number|undefined)=>n==null?"—":"$"+n.toFixed(4);
export function CandleEducation({bars,index,symbol,timeframe,replay}:{bars:Candle[];index:number;symbol:string;timeframe:string;replay:boolean}){
  const [tab,setTab]=useState<"story"|"review"|"rules">("story");
  const lesson=useMemo(()=>historicalCandleLesson(bars,index),[bars,index]);
  if(!lesson.story)return null;
  const bar=bars[index],study=lesson.study;
  const signal=lesson.signal;
  const provisional=index===bars.length-1;
  return <section className={styles.panel} aria-label="Candle education">
    <div className={styles.heading}><div><small>THE CHART IS THE LESSON</small><h3>{symbol} · {timeframe} · Read this candle</h3></div><span>{provisional?"Latest bar · may be forming":"Historical bar · study"}</span></div>
    <p className={styles.context}>{bar.time||"Timestamp unavailable"} · Raw market OHLC, even when Heikin-Ashi is displayed. Point at a candle, tap to pin it, or use Previous / Next candle to change the lesson.</p>
    <div className={styles.tabs} role="group" aria-label="Lesson sections">
      <button type="button" aria-pressed={tab==="story"} onClick={()=>setTab("story")}>What happened</button>
      <button type="button" aria-pressed={tab==="review"} onClick={()=>setTab("review")}>Could this setup work?</button>
      <button type="button" aria-pressed={tab==="rules"} onClick={()=>setTab("rules")}>Trading cheat sheet</button>
    </div>
    {tab==="story"&&<div className={styles.grid}>
      <article><h4>Visible price action</h4>{lesson.story.observations.map(p=><p key={p}>{p}</p>)}</article>
      <article><h4>Recovery, rejection & possible traps</h4><p>{lesson.story.pattern}</p><p>A recovery can be consistent with demand returning, selling easing, short covering or news. This chart does not establish which cause applies. A candle closes when its time interval ends; the newest interval may still change.</p><p>Confirmation to study: a reclaim holds on a later completed candle, participation supports the move, and the entry stays near a planned invalidation. A wick alone is not a buy.</p></article>
    </div>}
    {tab==="review"&&<div className={styles.grid}>
      <article><h4>What was known then</h4><p>{signal.available?"Technical state "+signal.state+" · score "+signal.score+"/100.":"Not enough reliable history: "+signal.reason}</p><p>Calculated from bars through the selected candle only. Future bars never set the entry signal.</p><p><b>Why Omega did not buy: not verified here.</b> This study does not have the historical news, session, account limits, arming state or decision log. A technical setup is only one gate.</p></article>
      <article><h4>{replay?"Replay outcome":"Hypothetical price-path result"}: {study.state.replace("_"," ")}</h4><p>{study.reason}</p>
        {study.entry!=null&&<p>Assumed entry {money(study.entry)} · stop {money(study.stop)} · TP1 {money(study.target)}</p>}
        {study.pnlPerShare!=null&&<p><b>{study.pnlPerShare>=0?"Potential gross gain":"Potential gross loss"}: {money(study.pnlPerShare)} per share</b></p>}
        <p>This is a price-touch study, not a broker fill or an actual win. It assumes entry at the next loaded bar's open only if inside the prior plan's zone. Fees, spread, slippage, liquidity and missing bars can change results. No future-perfect entry is selected.</p>
        {replay&&<p>Only revealed replay bars are considered. Step forward to see whether the idea survives.</p>}
      </article>
    </div>}
    {tab==="rules"&&<div className={styles.grid}>
      <article><h4>BUY checklist</h4><ol><li>Reliable, fresh data and an allowed trading session.</li><li>A completed trigger, confirming timeframes and acceptable market/news conditions.</li><li>Entry inside the planned zone; no chasing a rally.</li><li>A valid protective stop and position size within the account's risk limits.</li><li>Available buying power, no protection alert, and daily limits not reached.</li></ol></article>
      <article><h4>HOLD / SELL / WAIT checklist</h4><ol><li>Manage an existing position against its original stop and targets.</li><li>Review exits when the thesis breaks; verify the broker order status.</li><li>Wait when evidence is missing, stale or contradictory.</li><li>Never average down to hide a loss or enlarge size to recover it.</li><li>Review losing ideas and no-trades alongside profitable ideas. A later rally alone is not proof that waiting was wrong.</li></ol><p>A favorable risk/reward plan describes a possibility, not a guaranteed payout. Paper capital gets the same discipline as cash.</p></article>
    </div>}
  </section>;
}
