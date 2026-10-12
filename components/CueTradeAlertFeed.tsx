import React,{useEffect,useMemo,useRef,useState} from "react";
import {BellRing,CheckCircle2,ShieldAlert} from "lucide-react";
import {PushAlertControl} from "./PushAlertControl";
import {tradeTargetLadder,crossedStop,crossedTarget,type PlanLike,type TargetMode} from "../helpers/tradeTargetLadder";
import {sendTradeAlert,type TradeAlertEvent} from "../endpoints/push/trade-alert_POST.schema";
import styles from "./CueTradeAlertFeed.module.css";

type FeedItem={id:string;event:TradeAlertEvent;symbol:string;price:number;message:string;at:string};
const HISTORY_KEY="tradecue:signal-alert-history:v1";

function fmt(value:number){
  return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:value>=100?2:4}).format(value);
}
function readHistory():FeedItem[]{
  try{
    const raw=localStorage.getItem(HISTORY_KEY);
    const parsed=JSON.parse(raw??"[]");
    return Array.isArray(parsed)?parsed.slice(0,30):[];
  }catch{return [];}
}
function saveHistory(items:FeedItem[]){
  try{localStorage.setItem(HISTORY_KEY,JSON.stringify(items.slice(0,30)));}catch{}
}

export function CueTradeAlertFeed({
  enabled,symbol,setupLabel,action,plan,lastPrice,mode,positionOpen,
}:{
  enabled:boolean;
  symbol:string;
  setupLabel:string;
  action:string;
  plan:PlanLike|null|undefined;
  lastPrice:number|null|undefined;
  mode:TargetMode;
  positionOpen:boolean;
}){
  const [history,setHistory]=useState<FeedItem[]>([]);
  const previous=useRef<number|null>(null);
  const ladder=useMemo(()=>tradeTargetLadder(plan,mode),[plan,mode]);
  const planKey=plan
    ?[symbol,mode,plan.entryHigh,plan.stop,plan.target1,plan.target2,plan.target3].join(":")
    :symbol+":"+mode+":none";
  const triggerKey="tradecue:signal-alert-triggered:v1:"+planKey;

  useEffect(()=>{setHistory(readHistory());},[]);

  const emit=(event:TradeAlertEvent,price:number,message:string)=>{
    let seen:string[]=[];
    try{seen=JSON.parse(localStorage.getItem(triggerKey)??"[]");}catch{}
    if(seen.includes(event))return;
    try{localStorage.setItem(triggerKey,JSON.stringify([...seen,event]));}catch{}
    const item:FeedItem={id:planKey+":"+event,event,symbol,price,message,at:new Date().toISOString()};
    setHistory(current=>{
      const next=[item,...current.filter(row=>row.id!==item.id)].slice(0,30);
      saveHistory(next);
      return next;
    });
    if(enabled)void sendTradeAlert({symbol,event,price,setup:setupLabel}).catch(()=>{});
  };

  useEffect(()=>{
    if(!plan||!Number.isFinite(lastPrice??NaN)){
      previous.current=lastPrice??null;
      return;
    }
    const current=Number(lastPrice);
    if(action==="ENTER"&&!positionOpen)emit("ENTRY_READY",plan.entryHigh,setupLabel+" entry gates passed");
    if(positionOpen){
      const prev=previous.current;
      for(const step of ladder){
        if((prev==null&&current>=step.price)||crossedTarget(prev,current,step.price))emit(step.key,step.price,step.label+" reached");
      }
      if((prev==null&&current<=plan.stop)||crossedStop(prev,current,plan.stop))emit("STOP",plan.stop,"Protected invalidation level reached");
    }
    previous.current=current;
  // planKey intentionally represents all price levels; emit is local and idempotent.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[planKey,lastPrice,action,positionOpen,ladder,setupLabel]);

  return <section className={styles.panel} aria-label="TradeCUE trade alerts">
    <div className={styles.head}>
      <div><small>LIVE SIGNAL ALERTS</small><h3>Entry and target notifications</h3><p>TradeCUE records milestones here and sends device push alerts when push is enabled.</p></div>
      <PushAlertControl/>
    </div>
    <div className={styles.status}><BellRing size={14}/><span>{positionOpen?"Watching the live position for target/stop crossings.":"Watching for a fresh ENTRY READY signal."}</span></div>
    <div className={styles.feed}>
      {history.slice(0,8).map(item=><div key={item.id} className={item.event==="STOP"?styles.stop:styles.hit}>
        {item.event==="STOP"?<ShieldAlert size={15}/>:<CheckCircle2 size={15}/>}
        <span><b>{item.event==="ENTRY_READY"?"ENTRY READY":item.event==="STOP"?"STOP / INVALIDATION":item.event+" HIT"} · {item.symbol}</b><small>{item.message} · {fmt(item.price)}</small></span>
        <time>{new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}).format(new Date(item.at))}</time>
      </div>)}
      {!history.length&&<p className={styles.empty}>No entry or target alerts yet. Alerts appear only from actual chart-level transitions.</p>}
    </div>
  </section>;
}
   96