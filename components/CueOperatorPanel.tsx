import React,{useMemo,useState} from "react";
import { CheckCircle2,Crosshair,ShieldCheck,Target,TimerReset,TrendingUp,TrendingDown } from "lucide-react";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { usePaperOrders } from "../helpers/usePaperOrders";
import styles from "./CueOperatorPanel.module.css";

type Plan={entryLow:number;entryHigh:number;stop:number;target1:number;target2:number;target3:number};
type CueAction="BUY"|"SELL"|"WAIT"|"HOLD"|"AVOID"|null;
function money(v:number|null|undefined){return v==null||!Number.isFinite(v)?"—":"$"+v.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});}

export function CueOperatorPanel({
  enabled,accountId,symbol,action,score,price,plan,suggestedShares,positionQuantity,dataFresh,structure,macroState,onOpenOrderTicket,
}:{
  enabled:boolean;accountId?:string;symbol:string;action:CueAction;score:number|null;price?:number;plan:Plan|null;
  suggestedShares:number;positionQuantity:number;dataFresh:boolean;structure:string;macroState?:string;onOpenOrderTicket:(side?:"BUY"|"SELL")=>void;
}){
  const paper=usePaperOrders(enabled,accountId);
  const [message,setMessage]=useState("");
  const isBuy=action==="BUY"&&suggestedShares>0&&!!plan;
  const isSell=action==="SELL"&&positionQuantity>0;
  const executable=Boolean(enabled&&accountId&&dataFresh&&(isBuy||isSell));
  const order=useMemo(()=>{
    if(isBuy&&plan)return {side:"BUY" as const,orderType:"LIMIT" as const,quantity:suggestedShares,limitPrice:plan.entryHigh};
    if(isSell)return {side:"SELL" as const,orderType:"MARKET" as const,quantity:Math.round(positionQuantity*1e6)/1e6};
    return null;
  },[isBuy,isSell,plan,suggestedShares,positionQuantity]);

  const approve=async()=>{
    if(!accountId||!order)return;
    setMessage("");
    const limit=order.orderType==="LIMIT"?order.limitPrice:undefined;
    const intentId=paper.intentFor([accountId,symbol,order.side,order.orderType,order.quantity,limit??""].join("|"));
    try{
      const result=await paper.place.mutateAsync({
        accountId,symbol,side:order.side,orderType:order.orderType,quantity:order.quantity,
        limitPrice:limit,confirmPaper:true,intentId,
      });
      paper.settleAttempt();
      setMessage((result.duplicate?"Already sent — no duplicate placed · ":"Approved and sent to Webull PaperTrade · ")+result.clientOrderId);
    }catch(error){paper.settleAttempt(error);setMessage(error instanceof Error?error.message:"Paper order failed.");}
  };

  return <div className={styles.panel}>
    <div className={styles.execHead}>
      <div><small>EXECUTION</small><strong>{symbol} order controls</strong></div>
      <Badge variant="outline">{dataFresh?"LIVE DATA":"DATA CHECK"}</Badge>
    </div>

    <p className={styles.read}>
      {action==="BUY"?"Entry is available. Review size and protection below before sending a paper order.":
       action==="SELL"?"Exit review is active for the current paper position.":
       action==="HOLD"?"Position is being managed. No new order is needed.":
       action==="AVOID"?"No entry is available while the setup fails the trading gate.":
       "No executable order is available yet."}
    </p>

    <div className={styles.stateGrid}>
      <span><Crosshair size={13}/><b>Price</b><strong>{money(price)}</strong></span>
      <span><ShieldCheck size={13}/><b>Structure</b><strong>{structure}</strong></span>
      <span><TimerReset size={13}/><b>News guard</b><strong>{macroState??"CHECKING"}</strong></span>
    </div>

    <div className={styles.quickTrade}>
      <Button className={styles.buyButton} onClick={()=>onOpenOrderTicket("BUY")} disabled={!enabled||!accountId}>
        <TrendingUp size={15}/>BUY
      </Button>
      <Button className={styles.sellButton} variant="destructive" onClick={()=>onOpenOrderTicket("SELL")} disabled={!enabled||!accountId||positionQuantity<=0}>
        <TrendingDown size={15}/>SELL / EXIT
      </Button>
    </div>
    <p className={styles.quickHint}>
      {positionQuantity>0
        ? "Manual controls are always available. Omega still enforces the server risk rules before any PaperTrade is accepted."
        : "BUY opens the paper ticket; it is not an entry recommendation. Server risk checks still apply. SELL / EXIT requires shares in this account."}
    </p>

    {plan&&<div className={styles.plan}>
      <span><b>Entry</b><strong>{money(plan.entryLow)}–{money(plan.entryHigh)}</strong></span>
      <span><b>Stop</b><strong className={styles.loss}>{money(plan.stop)}</strong></span>
      <span><b>TP1 · 1:1</b><strong className={styles.win}>{money(plan.target1)}</strong></span>
      <span><b>TP2 · 1:2</b><strong className={styles.win}>{money(plan.target2)}</strong></span>
      <span><b>TP3 · 1:3</b><strong className={styles.win}>{money(plan.target3)}</strong></span>
      <span><b>Size</b><strong>{isSell?Math.round(positionQuantity*1e6)/1e6:suggestedShares||"—"} shares</strong></span>
    </div>}

    <div className={styles.actions}>
      <Button disabled={!executable||paper.place.isPending} onClick={approve}>
        {paper.place.isPending?"Sending…":isBuy?"Approve PAPER BUY":isSell?"Approve PAPER EXIT":action==="HOLD"?"Monitoring position":"Waiting for setup"}
      </Button>
      <Button variant="outline" onClick={()=>onOpenOrderTicket()}>Full order ticket</Button>
    </div>
    {message&&<div className={styles.confirmed}><CheckCircle2 size={14}/>{message}</div>}
    <div className={styles.foot}><Target size={13}/><span>Manual execution controls use Webull PaperTrade. Omega autonomous training is managed above.</span></div>
  </div>;
}