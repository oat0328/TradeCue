import React from "react";
import { AlertTriangle,CalendarClock,ShieldCheck } from "lucide-react";
import { Badge } from "./Badge";
import { useMacroRisk } from "../helpers/useMacroRisk";
import styles from "./MacroRiskGuard.module.css";
export function MacroRiskGuard({enabled=true}:{enabled?:boolean}){
  const risk=useMacroRisk(enabled);
  if(!enabled)return null;
  const data=risk.data;
  const variant=data?.state==="BLOCKED"?"destructive":data?.state==="CLEAR"?"success":"warning";
  return <section className={styles.panel} id="news-risk">
    <div className={styles.head}><div>{data?.state==="CLEAR"?<ShieldCheck size={16}/>:<AlertTriangle size={16}/>}<span><small>MACRO RISK</small><strong>{data?.state??(risk.isFetching?"CHECKING":"OFFLINE")}</strong></span></div><Badge variant={variant as any}>{data?.connected?"ECONOMIC CALENDAR":"FEED REQUIRED"}</Badge></div>
    <p>{data?.message??"Checking the macro calendar…"}</p>
    {data?.nearest&&<div className={styles.event}><CalendarClock size={14}/><span><b>{data.nearest.event}</b><small>{data.nearest.impact||"EVENT"} · {data.nearest.minutesFromNow>=0?"in "+data.nearest.minutesFromNow+" min":Math.abs(data.nearest.minutesFromNow)+" min ago"}</small></span></div>}
  </section>;
}