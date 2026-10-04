import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Checkbox } from "./Checkbox";
import { Input } from "./Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./Select";
import { usePaperOrders } from "../helpers/usePaperOrders";
import styles from "./PaperOrderPanel.module.css";

export function PaperOrderPanel({
  enabled,
  accountId,
  symbol,
  latestPrice,
  positionQuantity = 0,
  longOnly = true,
  suggestedSide = null,
}: {
  enabled:boolean;
  accountId?:string;
  symbol:string;
  latestPrice?:number;
  positionQuantity?:number;
  longOnly?:boolean;
  suggestedSide?:"BUY"|"SELL"|null;
}) {
  const paper=usePaperOrders(enabled,accountId);
  const [side,setSide]=useState<"BUY"|"SELL">("BUY");
  const [orderType,setOrderType]=useState<"MARKET"|"LIMIT">("MARKET");
  const [quantity,setQuantity]=useState("1");
  const [limitPrice,setLimitPrice]=useState(latestPrice ? latestPrice.toFixed(2) : "");
  const [confirmed,setConfirmed]=useState(false);
  const [message,setMessage]=useState("");

  const quantityNumber=Number(quantity);
  const limitNumber=Number(limitPrice);
  const canSell=!longOnly||positionQuantity>0;

  useEffect(()=>{
    if(side==="SELL"&&!canSell)setSide("BUY");
  },[side,canSell]);

  useEffect(()=>{
    if(suggestedSide==="BUY")setSide("BUY");
    if(suggestedSide==="SELL"&&canSell)setSide("SELL");
  },[suggestedSide,canSell]);

  const valid=Boolean(
    enabled &&
    accountId &&
    Number.isInteger(quantityNumber) &&
    quantityNumber>0 &&
    quantityNumber<=100000 &&
    (side==="BUY" || (canSell && quantityNumber<=positionQuantity)) &&
    (orderType==="MARKET" || (Number.isFinite(limitNumber)&&limitNumber>0)) &&
    confirmed
  );

  const estimated=useMemo(()=>{
    const price=orderType==="LIMIT"?limitNumber:latestPrice;
    if(!Number.isFinite(price)||!Number.isFinite(quantityNumber))return null;
    return price!*quantityNumber;
  },[orderType,limitNumber,latestPrice,quantityNumber]);

  const submit=async()=>{
    if(!accountId||!valid)return;
    setMessage("");
    try{
      const result=await paper.place.mutateAsync({
        accountId,
        symbol,
        side,
        orderType,
        quantity:quantityNumber,
        limitPrice:orderType==="LIMIT"?limitNumber:undefined,
        confirmPaper:true,
      });
      setMessage("Paper order submitted to Webull: "+result.clientOrderId);
      setConfirmed(false);
    }catch(error){
      setMessage(error instanceof Error?error.message:"Paper order failed.");
    }
  };

  if(!enabled||!accountId){
    return <section className={styles.panel} id="paper-trading"><div className={styles.head}><div><small>WEBULL PAPERTRADING</small><h2>Paper orders unavailable</h2><p>Connect a Webull PaperTrade account first. TradeCUE will not submit a real-money order from this panel.</p></div><Badge variant="warning">CONNECTION REQUIRED</Badge></div></section>;
  }

  return <section className={styles.panel} id="paper-trading">
    <div className={styles.head}>
      <div><small>WEBULL PAPERTRADING</small><h2>Paper order ticket</h2><p>Sandbox account only.</p></div>
      <Badge variant="success">PAPER ONLY</Badge>
    </div>

    <div className={styles.notice}><AlertTriangle size={16}/><span>PAPER ONLY · Verify symbol, side, quantity and price.</span></div>

    <div className={styles.ticket}>
      <div><label>Symbol</label><strong>{symbol}</strong></div>
      <div><label>Side</label><Select value={side} onValueChange={(value)=>setSide(value as "BUY"|"SELL")}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="BUY">BUY / OPEN LONG</SelectItem>{canSell&&<SelectItem value="SELL">SELL / EXIT LONG</SelectItem>}</SelectContent></Select></div>
      <div><label>Order type</label><Select value={orderType} onValueChange={(value)=>setOrderType(value as "MARKET"|"LIMIT")}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="MARKET">Market</SelectItem><SelectItem value="LIMIT">Limit</SelectItem></SelectContent></Select></div>
      <div><label>Quantity</label><Input inputMode="numeric" value={quantity} onChange={(event)=>setQuantity(event.target.value.replace(/[^0-9]/g,""))}/></div>
      {orderType==="LIMIT"&&<div><label>Limit price</label><Input inputMode="decimal" value={limitPrice} onChange={(event)=>setLimitPrice(event.target.value)}/></div>}
      <div><label>Reference price</label><strong>{latestPrice&&Number.isFinite(latestPrice)?"$"+latestPrice.toFixed(2):"—"}</strong></div>
      <div><label>Approx. notional</label><strong>{estimated!=null&&Number.isFinite(estimated)?"$"+estimated.toLocaleString(undefined,{maximumFractionDigits:2}):"—"}</strong></div>
    </div>

    <label className={styles.confirm}><Checkbox checked={confirmed} onChange={(event)=>setConfirmed(event.target.checked)}/><span>I confirm this is a Webull PaperTrade order. {longOnly?"SELL is exit-only; TradeCUE will not open a short position.":""}</span></label>

    <div className={styles.actions}>
      <Button disabled={!valid||paper.place.isPending} onClick={submit}>{paper.place.isPending?"Submitting…":"Submit paper order"}</Button>
      <Button variant="outline" disabled={paper.orders.isFetching} onClick={()=>paper.orders.refetch()}><RefreshCw size={14}/>{paper.orders.isFetching?"Refreshing…":"Refresh orders"}</Button>
    </div>
    {message&&<p role="status" className={styles.message}>{message}</p>}
    {paper.orders.error&&<p role="alert" className={styles.error}>{paper.orders.error.message}</p>}

    <div className={styles.orders}>
      <h3>Recent Webull paper orders</h3>
      {paper.orders.data?.orders.length ? <div className={styles.tableWrap}><table><thead><tr><th>Symbol</th><th>Side</th><th>Type</th><th>Qty</th><th>Status</th><th>Action</th></tr></thead><tbody>
        {paper.orders.data.orders.map((order)=>(
          <tr key={order.clientOrderId}>
            <td>{order.symbol}</td><td>{order.side}</td><td>{order.orderType}{order.limitPrice?" @ $"+order.limitPrice:""}</td><td>{order.quantity??"—"}</td><td>{order.status}</td>
            <td>{["PENDING","OPEN","WORKING","SUBMITTED","NEW"].some((value)=>order.status.toUpperCase().includes(value))?<Button size="sm" variant="ghost" disabled={paper.cancel.isPending} onClick={()=>accountId&&paper.cancel.mutate({accountId,clientOrderId:order.clientOrderId,confirmCancel:true})}>Cancel</Button>:<span>—</span>}</td>
          </tr>
        ))}
      </tbody></table></div>:<p>No recent paper orders returned by Webull.</p>}
      {paper.cancel.error&&<p role="alert" className={styles.error}>{paper.cancel.error.message}</p>}
    </div>
  </section>;
}
