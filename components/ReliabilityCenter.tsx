import React from "react";
import { Activity,ShieldCheck } from "lucide-react";
import { Badge } from "./Badge";
import { useReliabilityStatus } from "../helpers/useReliabilityStatus";
import styles from "./ReliabilityCenter.module.css";
export function ReliabilityCenter({enabled=true}:{enabled?:boolean}){
  const q=useReliabilityStatus(enabled);
  const a=q.data?.automation;
  return <section className={styles.panel} id="reliability-center">
    <div className={styles.head}><div><Activity size={17}/><span><small>SYSTEM STATUS</small><strong>What is actually working</strong></span></div><Badge variant={a?.killSwitch?"destructive":q.error?"warning":"success"}>{a?.killSwitch?"KILL SWITCH":q.error?"DEGRADED":"ONLINE"}</Badge></div>
    <div className={styles.grid}>
      <span><b>Server brain</b><strong>{a?.brainEnabled?"ON":"OFF"}</strong></span>
      <span><b>Omega</b><strong>{a?.autoPaperEnabled&&!a?.killSwitch?"ARMED":"OFF"}</strong></span>
      <span><b>Last outlook</b><strong>{q.data?.latestOutlook?.bias??"—"}</strong></span>
    </div>
    <div className={styles.services}>
      {(q.data?.services??[]).slice(0,6).map(s=><div key={s.service}><ShieldCheck size={13}/><span><b>{s.service}</b><small>{s.message??"No message"}</small></span><strong>{s.status}</strong></div>)}
      {!q.data?.services.length&&!q.isFetching&&<p>No scheduled reliability snapshot yet. The morning health job will populate this.</p>}
    </div>
  </section>;
}