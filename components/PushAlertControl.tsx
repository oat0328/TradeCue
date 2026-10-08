import React,{useEffect,useState} from "react";
import { BellRing,BellOff,Send } from "lucide-react";
import { Button } from "./Button";
import { enablePush,disablePush,onPushEnabledChange } from "../helpers/pushClient";
import { sendTestPush } from "../endpoints/push/test_POST.schema";
import styles from "./PushAlertControl.module.css";
export function PushAlertControl(){
  const [enabled,setEnabled]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  useEffect(()=>onPushEnabledChange(setEnabled),[]);
  const toggle=async()=>{setBusy(true);setMessage("");try{enabled?await disablePush():await enablePush();}catch(e){setMessage(e instanceof Error?e.message:"Push setup failed");}finally{setBusy(false);}};
  const test=async()=>{setBusy(true);try{const r=await sendTestPush();setMessage(r.sent?"Test alert sent.":"No test alert was delivered.");}catch(e){setMessage(e instanceof Error?e.message:"Test failed");}finally{setBusy(false);}};
  return <div className={styles.wrap}><Button size="sm" variant={enabled?"secondary":"outline"} disabled={busy} onClick={toggle}>{enabled?<BellRing size={13}/>:<BellOff size={13}/>} {enabled?"Push enabled":"Enable push alerts"}</Button>{enabled&&<Button size="sm" variant="ghost" disabled={busy} onClick={test}><Send size={13}/>Test</Button>}{message&&<span role="status">{message}</span>}</div>;
}