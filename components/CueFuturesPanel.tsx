import React,{useState} from "react";
import { Activity,RefreshCw } from "lucide-react";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Input } from "./Input";
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from "./Select";
import { useCueFutures } from "../helpers/useCueFutures";
import styles from "./CueFuturesPanel.module.css";
const presets=["MESmain","ESmain","NQmain","MNQmain","YMmain","GCmain"];
export function CueFuturesPanel({enabled}:{enabled:boolean}){
  const [draft,setDraft]=useState("MESmain");const [symbol,setSymbol]=useState("MESmain");
  const [timespan,setTimespan]=useState<"M1"|"M5"|"M15"|"M30"|"M60"|"M240">("M5");
  const data=useCueFutures(symbol,timespan,enabled);
  const d=data.data;
  const variant=d?.cue.state==="BUY"?"success":d?.cue.state==="AVOID"?"error":"warning";
  return <section className={styles.panel} id="cue-futures">
    <div className={styles.head}><div><small>FUTURES</small><h2>Futures intelligence</h2><p>Read-only futures analysis from the connected Webull market-data entitlement.</p></div><Badge variant="outline">NO AUTO ORDERS</Badge></div>
    <div className={styles.controls}>
      <div className={styles.presets}>{presets.map(preset=><button key={preset} className={symbol===preset?styles.active:undefined} onClick={()=>{setSymbol(preset);setDraft(preset);}}>{preset.replace(/main$/i,"")}</button>)}</div>
      <Input value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Contract or continuous symbol"/>
      <Button size="sm" onClick={()=>{
        const cleaned=draft.trim();
        const match=/^([A-Za-z0-9.-]+)main$/i.exec(cleaned);
        const canonical=match?match[1].toUpperCase()+"main":cleaned.toUpperCase();
        if(/^[A-Za-z0-9.-]{1,20}$/.test(canonical)){setSymbol(canonical);setDraft(canonical);}
      }}>Load</Button>
      <Select value={timespan} onValueChange={v=>setTimespan(v as any)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{["M1","M5","M15","M30","M60","M240"].map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select>
      <Button size="sm" variant="ghost" disabled={data.isFetching} onClick={()=>data.refetch()}><RefreshCw size={13}/></Button>
    </div>
    {data.error&&<div className={styles.error}><Activity size={16}/><span>{data.error.message}</span></div>}
    {d&&<><div className={styles.metrics}>
      <span><b>Contract</b><strong>{d.symbol}</strong></span><span><b>Last</b><strong>{d.latest==null?"—":d.latest.toFixed(2)}</strong></span>
      <span><b>Signal</b><strong><Badge variant={variant as any}>{d.cue.state??"DATA"}</Badge></strong></span><span><b>Score</b><strong>{d.cue.score??"—"}</strong></span>
      <span><b>Structure</b><strong>{d.structure.trend}</strong></span><span><b>Pattern</b><strong>{d.structure.pattern}</strong></span>
    </div>{d.cue.plan&&<div className={styles.plan}><span>Entry {d.cue.plan.entryLow.toFixed(2)}–{d.cue.plan.entryHigh.toFixed(2)}</span><span>Stop {d.cue.plan.stop.toFixed(2)}</span><span>TP1 {d.cue.plan.target1.toFixed(2)}</span><span>TP2 {d.cue.plan.target2.toFixed(2)}</span><span>TP3 {d.cue.plan.target3.toFixed(2)}</span></div>}<p className={styles.note}>{d.note}</p></>}
  </section>;
}