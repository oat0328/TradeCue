import React, { useMemo, useState } from "react";
import { Activity, ArrowDownRight, ArrowUpRight, Gauge, RefreshCw, Star } from "lucide-react";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { useMarketPulse } from "../helpers/useMarketDesk";
import { useWatchlist } from "../helpers/useWatchlist";
import styles from "./MarketPulsePanel.module.css";

function money(value:number|null){
  return value==null||!Number.isFinite(value)?"—":new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:value>=100?2:4}).format(value);
}
function pct(value:number|null){
  return value==null?"—":(value>=0?"+":"")+value.toFixed(2)+"%";
}

export function MarketPulsePanel({
  enabled,
  onOpenSymbol,
}:{
  enabled:boolean;
  onOpenSymbol:(symbol:string)=>void;
}){
  const pulse=useMarketPulse(enabled);
  const watchlist=useWatchlist(enabled);
  const [mode,setMode]=useState<"gainers"|"losers"|"active">("gainers");
  const watched=new Set((watchlist.list.data?.items??[]).map(item=>item.symbol.toUpperCase()));
  const watch=async(symbol:string)=>{
    if(watched.has(symbol.toUpperCase()))return;
    await watchlist.mutate.mutateAsync({action:"add",symbol,assetType:"stocks"});
  };

  const breadth=useMemo(()=>{
    const data=pulse.data?.breadth;
    if(!data)return null;
    const total=data.advancers+data.decliners+data.flat;
    return {
      total,
      advancePct:total?Math.round(data.advancers/total*100):0,
      declinePct:total?Math.round(data.decliners/total*100):0,
    };
  },[pulse.data?.breadth]);

  if(!enabled)return null;

  const rows=pulse.data?.[mode]??[];
  return <section className={styles.panel} id="market-pulse">
    <div className={styles.topLine}>
      <div className={styles.titleBlock}>
        <span className={styles.liveDot}/>
        <div><small>WEBULL MARKET WALL</small><strong>Live market pulse</strong></div>
      </div>
      <div className={styles.controls}>
        <Badge variant={pulse.data?"success":"outline"}>{pulse.data?"CONNECTED":"WAITING"}</Badge>
        <Button size="sm" variant="ghost" disabled={pulse.isFetching} onClick={()=>pulse.refetch()}><RefreshCw size={13}/>{pulse.isFetching?"Refreshing":"Refresh"}</Button>
      </div>
    </div>

    <div className={styles.tape}>
      {pulse.data?.benchmarks.map(item=><div className={styles.tapeItem} key={item.symbol}>
        <button className={styles.tapeOpen} onClick={()=>onOpenSymbol(item.symbol)}>
          <span>{item.symbol}</span><strong>{money(item.price)}</strong><em className={(item.changePercent??0)>=0?styles.up:styles.down}>{pct(item.changePercent)}</em>
        </button>
        <button className={styles.watchButton} aria-label={"Watch "+item.symbol} title={watched.has(item.symbol)?"Watching":"Add to Watching"} onClick={()=>watch(item.symbol)}>
          <Star size={14} fill={watched.has(item.symbol)?"currentColor":"none"}/>
        </button>
      </div>)}
      {!pulse.data&&<span className={styles.muted}>Connect Webull to load the market tape.</span>}
    </div>

    <div className={styles.body}>
      <div className={styles.breadthCard}>
        <div className={styles.cardIcon}><Gauge size={18}/></div>
        <small>Top-active breadth</small>
        <strong>{breadth?breadth.advancePct+"% advancing":"—"}</strong>
        <div className={styles.breadthBar}><span style={{width:(breadth?.advancePct??0)+"%"}}/></div>
        <div className={styles.breadthLegend}>
          <span><i className={styles.advanceDot}/>Adv {pulse.data?.breadth.advancers??"—"}</span>
          <span><i className={styles.declineDot}/>Dec {pulse.data?.breadth.decliners??"—"}</span>
        </div>
      </div>

      <div className={styles.moverBoard}>
        <div className={styles.modeTabs}>
          <button className={mode==="gainers"?styles.activeMode:undefined} onClick={()=>setMode("gainers")}><ArrowUpRight size={14}/>Gainers</button>
          <button className={mode==="losers"?styles.activeMode:undefined} onClick={()=>setMode("losers")}><ArrowDownRight size={14}/>Losers</button>
          <button className={mode==="active"?styles.activeMode:undefined} onClick={()=>setMode("active")}><Activity size={14}/>Active</button>
        </div>
        <div className={styles.rows}>
          {rows.slice(0,6).map((row,index)=><div className={styles.marketRow} key={row.symbol}>
            <button className={styles.marketOpen} onClick={()=>onOpenSymbol(row.symbol)}>
              <span className={styles.rank}>{String(index+1).padStart(2,"0")}</span>
              <span className={styles.symbol}><strong>{row.symbol}</strong><small>{row.name||"U.S. stock"}</small></span>
              <span className={styles.price}>{money(row.price)}</span>
              <span className={(row.changePercent??0)>=0?styles.up:styles.down}>{pct(row.changePercent)}</span>
              <span className={styles.rel}>{row.relativeVolume==null?"—":row.relativeVolume.toFixed(2)+"× RVOL"}</span>
            </button>
            <button className={styles.watchButton} aria-label={"Watch "+row.symbol} title={watched.has(row.symbol)?"Watching":"Add to Watching"} onClick={()=>watch(row.symbol)}>
              <Star size={15} fill={watched.has(row.symbol)?"currentColor":"none"}/>
            </button>
          </div>)}
          {pulse.data&&!rows.length&&<p className={styles.muted}>Webull returned no rows for this board.</p>}
        </div>
      </div>
    </div>

    {pulse.error&&<p className={styles.error}>{pulse.error.message}</p>}
  </section>;
}

