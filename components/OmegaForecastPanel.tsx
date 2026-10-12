import React,{useState} from "react";
import {BrainCircuit,Activity,ShieldAlert} from "lucide-react";
import {Badge} from "./Badge";
import {useOmegaForecastResearch,type ResearchModel} from "../helpers/useOmegaForecastResearch";
import styles from "./OmegaForecastPanel.module.css";
const choices:{key:ResearchModel;label:string}[]=[
  {key:"baseline",label:"Baseline Lab"},
  {key:"chronos2",label:"Chronos-2"},
  {key:"kronos",label:"Kronos"},
  {key:"nhits",label:"NeuralForecast"},
];
function price(n:number|null|undefined){return n==null||!Number.isFinite(n)?"—":"$"+n.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:4});}
export function OmegaForecastPanel({symbol,enabled}:{symbol:string;enabled:boolean}){
  const [model,setModel]=useState<ResearchModel>("baseline");
  const query=useOmegaForecastResearch(enabled,symbol,model);
  const result=query.data;
  const baseline=result?.baseline;
  const remote=result?.remote;
  return <section className={styles.card} aria-label="Omega predictive research">
    <div className={styles.header}>
      <div className={styles.title}><BrainCircuit size={20}/><div><small>OMEGA PREDICTIVE BRAIN · RESEARCH ONLY</small><strong>{symbol} · Model Comparison Laboratory</strong></div></div>
      <Badge variant="warning">NO AUTO EXECUTION</Badge>
    </div>
    <div className={styles.models} role="group" aria-label="Forecast model">
      {choices.map(choice=><button type="button" key={choice.key} onClick={()=>setModel(choice.key)} aria-pressed={model===choice.key} className={model===choice.key?styles.selected:undefined}>{choice.label}</button>)}
    </div>
    {!enabled?<p className={styles.note}>Open Omega or Advanced view to load historical research forecasts.</p>
    :query.isFetching&&!result?<p className={styles.note}>Retrieving authenticated Webull candles and evaluating models…</p>
    :query.isError?<p className={styles.error}>Forecast unavailable: {query.error instanceof Error?query.error.message:"market-data provider could not be reached"}</p>
    :result?<>
      <div className={styles.note}>
        <Activity size={14}/><span>{baseline?.barsUsed??0} validated 5m candles · Source: {result.source} · Last bar {baseline?.lastBarTime?new Date(baseline.lastBarTime).toLocaleString():"unavailable"}. Price projections are not quotes.</span>
      </div>
      {baseline?.status==="INSUFFICIENT_DATA"?<p className={styles.error}>Insufficient historical candles. Omega is withholding projections rather than inventing values.</p>:<>
        <div className={styles.summary}>
          <div><small>Selected baseline</small><strong>{baseline?.selectedBaseline==="shrunk_momentum"?"Damped momentum":"Last close"}</strong></div>
          <div><small>Held-out test</small><strong>{baseline?.backtest?.[0]?.testSamples??0} origins</strong></div>
          <div><small>Model readiness</small><strong>{model==="baseline"?"Research baseline":remote?.status??"Unconfigured"}</strong></div>
        </div>
        <div className={styles.grid}>
          {(model==="baseline"?baseline?.forecasts:remote?.status==="READY"?remote.points.map(p=>({
            horizonBars:p.horizonBars,median:p.median,lower:p.lower,upper:p.upper,
            intervalCoverage:null,testSamples:0,horizonLabel:p.horizonBars+" future 5m bars",
          })):[] )?.map(row=><div className={styles.prediction} key={row.horizonBars}>
            <small>{row.horizonBars} future completed 5m bar{row.horizonBars>1?"s":""}</small>
            <strong>{price(row.median)}</strong>
            <span>Projected range {price(row.lower)} – {price(row.upper)}</span>
            {model==="baseline"&&<span>Historical held-out range coverage: {row.intervalCoverage==null?"—":row.intervalCoverage.toFixed(0)+"%"} ({row.testSamples} samples)</span>}
          </div>)}
        </div>
        {model==="baseline"?<div className={styles.comparison}>
          <strong>Out-of-sample baseline comparison</strong>
          <table><thead><tr><th>Model</th><th>MAE</th><th>Direction hit rate</th></tr></thead><tbody>
            {baseline?.backtest.map(item=><tr key={item.method}>
              <td>{item.method.replace(/_/g," ")}</td><td>{price(item.mae)}</td><td>{item.directionalAccuracy==null?"—":item.directionalAccuracy.toFixed(1)+"%"}</td>
            </tr>)}
          </tbody></table>
          <p>Direction hit rate measures next-bar forecasts in historical samples. It does not measure profitable trades.</p>
        </div>
        :<p className={remote?.status==="READY"?styles.note:styles.error}>{
          remote?.status==="READY"
            ?"Model: "+remote.source+". This forecast has not passed independent market-profitability validation."
            :remote?.message??"Model server unavailable."
        }</p>}
      </>}
      <div className={styles.warning}><ShieldAlert size={16}/><span>Forecasts never override the existing 20 EMA entry strategy, risk firewall, economic-event blocks or broker permissions. No buy/sell orders originate from this panel.</span></div>
    </>:null}
  </section>;
}
