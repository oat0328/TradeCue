import React,{useMemo,useState} from "react";
import { ShieldAlert } from "lucide-react";
import { Badge } from "./Badge";
import { Input } from "./Input";
import styles from "./FundedRiskPanel.module.css";
function num(v:string){const n=Number(v);return Number.isFinite(n)?n:0;}
export function FundedRiskPanel(){
  const [balance,setBalance]=useState("50000"),[drawdownFloor,setDrawdownFloor]=useState("47500"),[dailyLossLeft,setDailyLossLeft]=useState("1200"),[plannedRisk,setPlannedRisk]=useState("250"),[maxContracts,setMaxContracts]=useState("5"),[plannedContracts,setPlannedContracts]=useState("1");
  const read=useMemo(()=>{
    const cushion=Math.max(0,num(balance)-num(drawdownFloor));const risk=num(plannedRisk);const contracts=num(plannedContracts);
    const blocked=risk<=0||risk>cushion||risk>num(dailyLossLeft)||contracts>num(maxContracts);
    const reasons:string[]=[];if(risk>cushion)reasons.push("planned risk exceeds drawdown cushion");if(risk>num(dailyLossLeft))reasons.push("planned risk exceeds daily-loss room");if(contracts>num(maxContracts))reasons.push("contracts exceed configured maximum");if(risk<=0)reasons.push("enter planned risk");
    return {cushion,blocked,reasons};
  },[balance,drawdownFloor,dailyLossLeft,plannedRisk,maxContracts,plannedContracts]);
  return <section className={styles.panel} id="funded-mode"><div className={styles.head}><div><small>FUNDED RISK</small><h2>Prop-rule risk guard</h2><p>Enter the current rules from your firm; TradeCUE does not hardcode changing prop-firm terms.</p></div><Badge variant={read.blocked?"destructive":"success"}>{read.blocked?"BLOCK TRADE":"WITHIN CONFIGURED LIMITS"}</Badge></div>
    <div className={styles.grid}>
      <label>Current balance<Input inputMode="decimal" value={balance} onChange={e=>setBalance(e.target.value)}/></label>
      <label>Drawdown floor<Input inputMode="decimal" value={drawdownFloor} onChange={e=>setDrawdownFloor(e.target.value)}/></label>
      <label>Daily loss room<Input inputMode="decimal" value={dailyLossLeft} onChange={e=>setDailyLossLeft(e.target.value)}/></label>
      <label>Planned risk<Input inputMode="decimal" value={plannedRisk} onChange={e=>setPlannedRisk(e.target.value)}/></label>
      <label>Max contracts<Input inputMode="numeric" value={maxContracts} onChange={e=>setMaxContracts(e.target.value)}/></label>
      <label>Planned contracts<Input inputMode="numeric" value={plannedContracts} onChange={e=>setPlannedContracts(e.target.value)}/></label>
    </div>
    <div className={styles.read}><ShieldAlert size={17}/><span><b>{"Remaining drawdown cushion: $"+read.cushion.toLocaleString(undefined,{maximumFractionDigits:2})}</b><small>{read.blocked?read.reasons.join(" · "):"Trade fits the limits you entered. Confirm the firm's official current rules before execution."}</small></span></div>
  </section>;
}