import React from "react";
import { BriefcaseBusiness,ShieldAlert } from "lucide-react";
import { Badge } from "./Badge";
import styles from "./PortfolioBrainPanel.module.css";

type Position={symbol:string;quantity:string|null;marketValue:string|null;unrealizedPnl:string|null;costPrice:string|null};
function num(v:string|null|undefined){const n=Number(v);return Number.isFinite(n)?n:0;}
function money(v:number){return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(v);}
export function PortfolioBrainPanel({positions,buyingPower,currentSymbol,plannedAmount,maxPositions}:{positions:Position[];buyingPower:number;currentSymbol:string;plannedAmount:number;maxPositions:number}){
  const open=positions.filter(p=>num(p.quantity)>0);
  const totalValue=open.reduce((s,p)=>s+Math.max(0,num(p.marketValue)),0);
  const duplicate=open.some(p=>p.symbol.toUpperCase()===currentSymbol.toUpperCase());
  const largest=open.map(p=>({symbol:p.symbol,value:Math.max(0,num(p.marketValue))})).sort((a,b)=>b.value-a.value)[0];
  const concentration=largest&&totalValue>0?largest.value/totalValue*100:0;
  const capacity=Math.max(0,maxPositions-open.length);
  const notionalOk=plannedAmount<=buyingPower||buyingPower<=0;
  const blocked=duplicate||capacity<=0||!notionalOk;
  const risk=blocked?"BLOCKED":concentration>=50?"CAUTION":"CLEAR";
  return <section className={styles.panel} id="portfolio-brain">
    <div className={styles.head}><div><BriefcaseBusiness size={17}/><span><small>PORTFOLIO BRAIN</small><strong>Exposure before entry</strong></span></div><Badge variant={risk==="CLEAR"?"success":risk==="BLOCKED"?"destructive":"warning"}>{risk}</Badge></div>
    <div className={styles.grid}>
      <span><b>Open positions</b><strong>{open.length}/{maxPositions}</strong></span>
      <span><b>Buying power</b><strong>{money(Math.max(0,buyingPower))}</strong></span>
      <span><b>Planned trade</b><strong>{money(Math.max(0,plannedAmount))}</strong></span>
      <span><b>Largest holding</b><strong>{largest?largest.symbol+" "+concentration.toFixed(0)+"%":"—"}</strong></span>
    </div>
    <div className={styles.read}><ShieldAlert size={15}/><p>{duplicate
      ?"CUE already sees an open "+currentSymbol+" position. It should not stack another automated entry."
      :capacity<=0
        ?"Maximum automated position capacity is reached. Close or reduce a position before adding another."
        :!notionalOk
          ?"The planned trade exceeds current buying power."
          :concentration>=50
            ?"Portfolio is concentrated in "+largest?.symbol+". CUE should demand a stronger setup before adding more exposure."
            :"There is room for another position under the current exposure rules."}</p></div>
  </section>;
}