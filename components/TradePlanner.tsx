import React, { useMemo, useState } from "react";
import { AlertTriangle, Calculator } from "lucide-react";
import { Input } from "./Input";
import styles from "./TradePlanner.module.css";

function numeric(value:string|number|null|undefined){
  const number=Number(value);
  return Number.isFinite(number)?number:null;
}
function dollars(value:number|null){
  return value==null||!Number.isFinite(value)?"—":new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(value);
}

export function TradePlanner({
  accountEquity,
  entry,
  suggestedStop,
  suggestedTarget,
  maxRiskPerTrade,
}:{
  accountEquity?:string|null;
  entry?:number;
  suggestedStop?:number;
  suggestedTarget?:number;
  maxRiskPerTrade?:string|null;
}){
  const [account,setAccount]=useState(accountEquity&&numeric(accountEquity)!=null?String(accountEquity):"");
  const [entryValue,setEntry]=useState(entry?String(entry):"");
  const [stop,setStop]=useState(suggestedStop?String(suggestedStop):"");
  const [riskPercent,setRiskPercent]=useState("1");
  const [target,setTarget]=useState(suggestedTarget?String(suggestedTarget):"");

  React.useEffect(()=>{
    if(accountEquity&&numeric(accountEquity)!=null)setAccount(String(accountEquity));
  },[accountEquity]);
  React.useEffect(()=>{
    if(entry&&Number.isFinite(entry))setEntry(String(entry));
    if(suggestedStop&&Number.isFinite(suggestedStop))setStop(String(suggestedStop));
    if(suggestedTarget&&Number.isFinite(suggestedTarget))setTarget(String(suggestedTarget));
  },[entry,suggestedStop,suggestedTarget]);

  const result=useMemo(()=>{
    const accountNumber=numeric(account);
    const entryNumber=numeric(entryValue);
    const stopNumber=numeric(stop);
    const riskPct=numeric(riskPercent);
    const targetNumber=numeric(target);
    if(accountNumber==null||entryNumber==null||stopNumber==null||riskPct==null||accountNumber<=0||entryNumber<=0||riskPct<=0||entryNumber===stopNumber)return null;
    const perShareRisk=Math.abs(entryNumber-stopNumber);
    const dollarRisk=accountNumber*(riskPct/100);
    const shares=Math.floor(dollarRisk/perShareRisk);
    const actualRisk=shares*perShareRisk;
    const potentialGain=targetNumber!=null?shares*Math.abs(targetNumber-entryNumber):null;
    const rr=targetNumber!=null&&actualRisk>0?potentialGain!/actualRisk:null;
    return {accountNumber,entryNumber,stopNumber,riskPct,targetNumber,perShareRisk,dollarRisk,shares,actualRisk,potentialGain,rr,capital:shares*entryNumber};
  },[account,entryValue,stop,riskPercent,target]);

  const configuredMax=numeric(maxRiskPerTrade);
  const exceedsConfigured=result&&configuredMax!=null&&result.actualRisk>configuredMax;

  return <section className={styles.panel}>
    <div className={styles.head}><Calculator size={19}/><div><small>TRADE PLANNER</small><h3>Position sizing from defined risk</h3><p>This calculator sizes a trade from your inputs. It does not predict whether the target will be reached.</p></div></div>
    <div className={styles.inputs}>
      <label>Account size<Input inputMode="decimal" value={account} onChange={event=>setAccount(event.target.value)} placeholder="10000"/></label>
      <label>Entry<Input inputMode="decimal" value={entryValue} onChange={event=>setEntry(event.target.value)} placeholder="100.00"/></label>
      <label>Stop<Input inputMode="decimal" value={stop} onChange={event=>setStop(event.target.value)} placeholder="98.00"/></label>
      <label>Risk %<Input inputMode="decimal" value={riskPercent} onChange={event=>setRiskPercent(event.target.value)} placeholder="1"/></label>
      <label>Target<Input inputMode="decimal" value={target} onChange={event=>setTarget(event.target.value)} placeholder="104.00"/></label>
    </div>
    {result?<div className={styles.results}>
      <div><small>Dollar risk budget</small><strong>{dollars(result.dollarRisk)}</strong></div>
      <div><small>Shares</small><strong>{result.shares.toLocaleString()}</strong></div>
      <div><small>Capital required</small><strong>{dollars(result.capital)}</strong></div>
      <div><small>Planned max loss</small><strong>{dollars(result.actualRisk)}</strong></div>
      <div><small>Potential target gain</small><strong>{dollars(result.potentialGain)}</strong></div>
      <div><small>Risk / reward</small><strong>{result.rr==null?"—":"1 : "+result.rr.toFixed(2)}</strong></div>
    </div>:<p className={styles.empty}>Enter valid account, entry, stop and risk values to calculate position size.</p>}
    {exceedsConfigured&&<div className={styles.warning}><AlertTriangle size={16}/><span>This plan risks {dollars(result!.actualRisk)}, above your configured per-trade limit of {dollars(configuredMax)}. Reduce shares or risk percentage before using it.</span></div>}
  </section>;
}
