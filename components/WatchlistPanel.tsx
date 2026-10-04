import React, { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Input } from "./Input";
import { useWatchlist } from "../helpers/useWatchlist";
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
      <div><small>WATCHING</small><h2>Watching Center</h2><p>Your saved market radar. Watch from the Live Market Wall, then open any symbol in Cue Vision for the current chart, CUE, risk plan and teaching read.</p></div>
      <Badge variant={list.data?.quoteStatus==="connected"?"success":"outline"}>{list.data?.quoteStatus==="connected"?"WEBULL QUOTES":"SAVED LIST ONLY"}</Badge>
    </div>

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
            <Button size="sm" variant="ghost" disabled={index===0||mutate.isPending} onClick={()=>mutate.mutate({action:"move",id:item.id,direction:"up"})}><ArrowUp size={13}/></Button>
            <Button size="sm" variant="ghost" disabled={index===((list.data?.items.length??1)-1)||mutate.isPending} onClick={()=>mutate.mutate({action:"move",id:item.id,direction:"down"})}><ArrowDown size={13}/></Button>
            <Button size="sm" variant="ghost" disabled={mutate.isPending} onClick={()=>mutate.mutate({action:"remove",id:item.id})}><Trash2 size={13}/></Button>
          </div>
        </div>
      ))}
      {list.data&&!list.data.items.length&&<p className={styles.empty}>Your watchlist is empty. Add a symbol above.</p>}
    </div>
  </section>;
}

