import React,{useMemo,useState} from "react";
import { Beaker,Play } from "lucide-react";
import { Badge } from "./Badge";
import { Button } from "./Button";
import type { Candle } from "../helpers/chartMath";
import { backtestCueLong } from "../helpers/cueBacktest";
import styles from "./CueLabPanel.module.css";

function n(value:number|null,digits=2){return value==null?"—":Number.isFinite(value)?value.toFixed(digits):"∞";}
export function CueLabPanel({bars,symbol,timeframe}:{bars:Candle[];symbol:string;timeframe:string}){
  const [runId,setRunId]=useState(0);
  const result=useMemo(()=>runId?backtestCueLong(bars):null,[bars,runId]);
  return <section className={styles.panel} id="cue-lab">
    <div className={styles.head}><div><small>STRATEGY LAB</small><h2>Historical rule check</h2><p>Tests the current deterministic long-entry rules on the loaded {symbol} {timeframe} candle history.</p></div><Button disabled={bars.length<50} onClick={()=>setRunId(id=>id+1)}><Play size={14}/>Run backtest</Button></div>
    {!result?<div className={styles.empty}><Beaker size={18}/><span>{bars.length<50?"Load at least 50 candles to test.":"Run the rules against the loaded history. No statistics are shown until computed."}</span></div>:<>
      <div className={styles.metrics}>
        <span><b>Resolved</b><strong>{result.resolved}</strong></span>
        <span><b>Win rate</b><strong>{result.winRate==null?"—":n(result.winRate,1)+"%"}</strong></span>
        <span><b>Expectancy</b><strong>{result.expectancy==null?"—":n(result.expectancy)+"R"}</strong></span>
        <span><b>Profit factor</b><strong>{n(result.profitFactor)}</strong></span>
        <span><b>Wins / Losses</b><strong>{result.wins} / {result.losses}</strong></span>
        <span><b>Max losing streak</b><strong>{result.maxLosingStreak}</strong></span>
      </div>
      <div className={styles.truth}><Badge variant={result.sampleWarning?"warning":"success"}>{result.sampleWarning?"SMALL SAMPLE":"SAMPLE CHECK"}</Badge><p>{result.sampleWarning??"This sample is large enough for a first look, but still does not guarantee future performance."}</p></div>
      <p className={styles.method}>Method: BUY signals only, next 20 bars, TP2 versus stop. If stop and target occur inside the same candle, the test counts the stop first (conservative). Open/unresolved trades are excluded from win rate and expectancy.</p>
    </>}
  </section>;
}