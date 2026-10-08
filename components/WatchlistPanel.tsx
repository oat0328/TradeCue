import React, { useState } from "react";
import { ArrowDown, ArrowUp, Bell, BellOff, Plus, Trash2 } from "lucide-react";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Input } from "./Input";
import { useWatchlist } from "../helpers/useWatchlist";
import { useMarketPulse } from "../helpers/useMarketDesk";
import { PushAlertControl } from "./PushAlertControl";
import styles from "./WatchlistPanel.module.css";

function price(value:number|null){
  return value==null?"—":new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:value>=100?2:4}).format(value);
}

export function WatchlistPanel({
  enabled,
  onOpenSymbol,
}:{
  enabled:boolean;
  onOpenSymbol:(symbol:string)=>void;
}){
  const {list,mutate}=useWatchlist(enabled);
  const pulse=useMarketPulse(enabled);
  const movers=pulse.data?.active??[];
  const [draft,setDraft]=useState("");
  const [message,setMessage]=useState("");

  const add=async(event:React.FormEvent)=>{
    event.preventDefault();
    const symbol=draft.trim().toUpperCase();
    if(!/^[A-Z0-9.-]{1,15}$/.test(symbol)){
      setMessage("Enter a valid U.S. stock or ETF symbol.");
      return;
    }
    try{
      await mutate.mutateAsync({action:"add",symbol,assetType:"stocks"});
      setDraft("");
      setMessage("");
    }catch(error){
      setMessage(error instanceof Error?error.message:"Unable to add symbol.");
    }
  };

  if(!enabled)return null;

  return <section className={styles.panel} id="watchlist">
    <div className={styles.head}>
      <div><small>WATCHLIST</small><h2>Saved symbols</h2><p>Persists to your TradeCUE account. Quote fields come from your connected Webull PaperTrade data when available.</p></div>
      <Badge variant={list.data?.quoteStatus==="connected"?"success":"outline"}>{list.data?.quoteStatus==="connected"?"WEBULL QUOTES":"SAVED LIST ONLY"}</Badge>
    </div>
    <div className={styles.rows}><h3>Major stocks · activity watch</h3>{movers.map(item=><button type="button" className={styles.mover} key={item.symbol} onClick={()=>onOpenSymbol(item.symbol)}><span><b>{item.symbol}</b><small>{item.name||"Stock / ETF"}</small></span><span><b>{price(item.price)}</b><small className={item.changePercent!=null&&item.changePercent<0?styles.negative:styles.positive}>{item.changePercent==null?"—":(item.changePercent>=0?"+":"")+item.changePercent.toFixed(2)+"%"}</small></span></button>)}{pulse.data&&!movers.length&&<p className={styles.empty}>No qualifying major-stock quotes available. Missing data is not a buy signal.</p>}{pulse.error&&<p className={styles.error}>Quotes unavailable. {pulse.error.message}</p>}<small>Refreshes every 2 minutes · click to chart</small></div>
    <details><summary>Saved symbols & alerts</summary><PushAlertControl/>

    <form className={styles.add} onSubmit={add}>
      <Input value={draft} onChange={event=>setDraft(event.target.value.toUpperCase())} placeholder="AAPL" aria-label="Add symbol to watchlist"/>
      <Button type="submit" disabled={mutate.isPending}><Plus size={14}/>Add symbol</Button>
    </form>
    {message&&<p className={styles.error}>{message}</p>}
    {list.data?.quoteMessage&&<p className={styles.note}>{list.data.quoteMessage}</p>}
    {list.isFetching&&<p className={styles.note}>Refreshing watchlist…</p>}
    {list.error&&<p className={styles.error}>{list.error.message}</p>}

    <div className={styles.rows}>
      {list.data?.items.map((item,index)=>(
        <div className={styles.row} key={item.id}>
          <button className={styles.symbol} onClick={()=>onOpenSymbol(item.symbol)}>
            <strong>{item.symbol}</strong><small>{item.assetType}</small>
          </button>
          <div><small>Price</small><strong>{price(item.price)}</strong></div>
          <div><small>Change</small><strong className={item.changePercent==null?undefined:item.changePercent>=0?styles.positive:styles.negative}>{item.changePercent==null?"—":(item.changePercent>=0?"+":"")+item.changePercent.toFixed(2)+"%"}</strong></div>
          <div className={styles.actions}>
            <Button size="sm" variant={item.alertEnabled?"secondary":"ghost"} disabled={mutate.isPending} title={item.alertEnabled?"Disable Cue alerts":"Enable Cue alerts"} onClick={()=>mutate.mutate({action:"toggle_alert",id:item.id,enabled:!item.alertEnabled})}>
              {item.alertEnabled?<Bell size={13}/>:<BellOff size={13}/>}
            </Button>
            <Button size="sm" variant="ghost" disabled={index===0||mutate.isPending} onClick={()=>mutate.mutate({action:"move",id:item.id,direction:"up"})}><ArrowUp size={13}/></Button>
            <Button size="sm" variant="ghost" disabled={index===((list.data?.items.length??1)-1)||mutate.isPending} onClick={()=>mutate.mutate({action:"move",id:item.id,direction:"down"})}><ArrowDown size={13}/></Button>
            <Button size="sm" variant="ghost" disabled={mutate.isPending} onClick={()=>mutate.mutate({action:"remove",id:item.id})}><Trash2 size={13}/></Button>
          </div>
        </div>
      ))}
      {list.data&&!list.data.items.length&&<p className={styles.empty}>Your watchlist is empty. Add a symbol above.</p>}
    </div>
    {list.data?.items.some(item=>item.alertEnabled)&&<p className={styles.note}>Cue alerts are armed on selected symbols. The watchlist stores your alert preference; signal-change delivery will use this list when automated notification jobs are enabled.</p>}
    </details>
  </section>;
}
