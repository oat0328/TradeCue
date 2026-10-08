import React from "react";
import { Radar } from "lucide-react";
import { useCueHunter } from "../helpers/useCueHunter";
import { useWatchlist } from "../helpers/useWatchlist";
import styles from "./CueOpportunityStrip.module.css";

function price(value:number|null|undefined){
  return value==null||!Number.isFinite(value)?"—":new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:value>=100?2:4}).format(value);
}

export function CueOpportunityStrip({enabled,onOpenSymbol}:{enabled:boolean;onOpenSymbol:(symbol:string)=>void}){
  const hunter=useCueHunter(enabled,{mode:"auto",minScore:70,limit:12});
  const watchlist=useWatchlist(enabled);
  if(!enabled)return null;
  const rows=hunter.data?.rows.slice(0,4)??[];

  return <section className={styles.panel} id="opportunity-strip">
    <div className={styles.head}>
      <div><small>TOP OPPORTUNITIES</small><strong>Live CUE scans</strong></div>
      <span className={styles.live}><i/>{hunter.isFetching?"SCANNING":"AUTO WATCH ON"}</span>
    </div>

    <div className={styles.cards}>
      {rows.map((row,index)=>{
        const watched=watchlist.list.data?.items.find(item=>item.symbol.toUpperCase()===row.symbol.toUpperCase());
        return <article key={row.symbol} className={row.action==="ENTRY_READY"?styles.ready:styles.card}>
          <span className={styles.rank}>{index+1}</span>

          <button className={styles.identity} onClick={()=>onOpenSymbol(row.symbol)}>
            <b>{row.symbol}</b>
            <em>{row.name||row.opportunityType.replaceAll("_"," ")}</em>
          </button>

          <button
            className={watched?styles.watching:styles.watch}
            disabled={watchlist.mutate.isPending}
            onClick={async()=>{
              if(watched)await watchlist.mutate.mutateAsync({action:"remove",id:watched.id});
              else await watchlist.mutate.mutateAsync({action:"add",symbol:row.symbol,assetType:"stocks"});
            }}
          >
            {watched?"WATCHING":"WATCH"}
          </button>

          <span className={styles.market}>
            <b>{price(row.price)}</b>
            <em className={(row.changePercent??0)>=0?styles.up:styles.down}>
              {row.changePercent==null?"—":(row.changePercent>=0?"+":"")+row.changePercent.toFixed(2)+"%"}
            </em>
          </span>

          <span className={styles.score}>Score <b>{row.cueScore??"—"}</b></span>
          <button className={styles.open} onClick={()=>onOpenSymbol(row.symbol)}>
            {row.action==="ENTRY_READY"?"TRADE":"OPEN CHART"}
          </button>
        </article>;
      })}

      {!rows.length&&!hunter.isFetching&&<div className={styles.empty}>No qualified setup right now. CUE keeps scanning every 60 seconds while the workstation is open.</div>}
      {hunter.isFetching&&!rows.length&&<div className={styles.empty}><Radar size={16}/>Scanning the Webull opportunity universe…</div>}
    </div>

    {hunter.data&&<div className={styles.meta}>Universe {hunter.data.universeCount} · deep-check {hunter.data.evaluatedCount} · refresh 60s</div>}
  </section>;
}
