import React, { useMemo, useState } from "react";
import { Activity, ChevronRight, Crosshair, RefreshCw } from "lucide-react";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { useCueHunter } from "../helpers/useCueHunter";
import styles from "./OpportunityCommandStrip.module.css";

function money(value:number|null|undefined){
  if(value==null||!Number.isFinite(value))return "—";
  return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:value>=100?2:4}).format(value);
}
function pct(value:number|null|undefined){
  return value==null||!Number.isFinite(value)?"—":(value>=0?"+":"")+value.toFixed(2)+"%";
}

export function OpportunityCommandStrip({
  enabled,
  buyingPower,
  maxRiskPerTrade,
  onOpenSymbol,
}:{
  enabled:boolean;
  buyingPower?:number|null;
  maxRiskPerTrade?:string|null;
  onOpenSymbol:(symbol:string)=>void;
}){
  const [expanded,setExpanded]=useState(false);
  const budget=Number.isFinite(Number(buyingPower))&&Number(buyingPower)>0?Number(buyingPower):100;
  const hunter=useCueHunter(enabled,{mode:"auto",budget,maxPrice:Math.max(100,Math.min(budget,5000)),minScore:60,limit:12});
  const rows=hunter.data?.rows??[];
  const maxRisk=Number(maxRiskPerTrade);

  const ranked=useMemo(()=>rows.map(row=>{
    let shares:number|null=null;
    if(row.plan&&Number.isFinite(maxRisk)&&maxRisk>0){
      const entry=(row.plan.entryLow+row.plan.entryHigh)/2;
      const perShare=Math.max(0,entry-row.plan.stop);
      const riskQty=perShare>0?Math.floor(maxRisk/perShare):0;
      const cashQty=entry>0?Math.floor(budget/entry):0;
      shares=Math.max(0,Math.min(riskQty,cashQty));
    }
    return {...row,riskShares:shares};
  }),[rows,maxRisk,budget]);

  if(!enabled)return null;

  return <section className={styles.panel} id="hunter">
    <div className={styles.head}>
      <div className={styles.title}>
        <span className={styles.pulse}/>
        <div><small>TOP OPPORTUNITIES</small><strong>{hunter.data?.marketMode==="WEEKEND_PREP"?"MONDAY PREP":"LIVE AI SCANS"}</strong></div>
      </div>
      <div className={styles.headActions}>
        <span>{hunter.isFetching?"Scanning Webull…":hunter.data?hunter.data.evaluatedCount+" deep-checked":"Waiting for Webull"}</span>
        <Button size="sm" variant="ghost" disabled={hunter.isFetching} onClick={()=>hunter.refetch()}><RefreshCw size={13}/></Button>
        <button className={styles.viewAll} onClick={()=>setExpanded(value=>!value)}>{expanded?"Show top 4":"View all"}<ChevronRight size={13}/></button>
      </div>
    </div>

    {hunter.error&&<p className={styles.error}>{hunter.error.message}</p>}

    <div className={styles.cards}>
      {ranked.slice(0,expanded?12:4).map((row,index)=><button key={row.symbol} className={row.action==="ENTRY_READY"?styles.readyCard:styles.card} onClick={()=>onOpenSymbol(row.symbol)}>
        <div className={styles.cardTop}>
          <span className={styles.rank}>{index+1}</span>
          <div className={styles.symbol}><strong>{row.symbol}</strong><small>{row.sourceTags[0]??"WEBULL"}</small></div>
          <Badge variant={row.action==="ENTRY_READY"?"success":row.action==="WATCH"?"outline":"warning"}>{row.action==="ENTRY_READY"?"TRADE":row.action}</Badge>
        </div>
        <div className={styles.priceLine}><strong>{money(row.price)}</strong><em className={(row.changePercent??0)>=0?styles.up:styles.down}>{pct(row.changePercent)}</em></div>
        <div className={styles.scoreLine}><span>CUE <b>{row.cueScore??"—"}</b></span><span>MTF <b>{row.timeframeScores.bullishFrames}/3</b></span><span>RVOL <b>{row.relativeVolume==null?"—":row.relativeVolume.toFixed(1)+"×"}</b></span></div>
        <div className={styles.meter}><span style={{width:Math.max(0,Math.min(100,row.cueScore??0))+"%"}}/></div>
        <div className={styles.footer}><span>{row.riskShares!=null&&row.riskShares>0?row.riskShares+" sh risk-size":row.action==="ENTRY_READY"?"Check sizing":"Open chart"}</span><Crosshair size={13}/></div>
      </button>)}
      {!hunter.isFetching&&hunter.data&&!ranked.length&&<div className={styles.empty}><Activity size={17}/><span>No qualified setup right now. Hunter keeps scanning the current session.</span></div>}
    </div>
  </section>;
}
