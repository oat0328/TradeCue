import React,{useEffect,useMemo,useState}from "react";
import {AlertTriangle,RefreshCw,ShieldCheck,WalletCards}from "lucide-react";
import {useMutation}from "@tanstack/react-query";
import {Button}from "./Button";
import {Input}from "./Input";
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue}from "./Select";
import {useWebullLive}from "../helpers/useWebullLive";
import {postWebullLiveOrder}from "../endpoints/webull/live-order_POST.schema";
import styles from "./WebullLivePanel.module.css";

function money(value:string|number|null|undefined){
 const n=Number(value);
 return value==null||value===""||!Number.isFinite(n)?"—":new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:2}).format(n);
}

export function WebullLivePanel({enabled,symbol,latestPrice}:{enabled:boolean;symbol:string;latestPrice?:number}){
 const [accountId,setAccountId]=useState<string>();
 const live=useWebullLive(enabled,accountId);
 const [showConnect,setShowConnect]=useState(false);
 const [appKey,setAppKey]=useState("");
 const [appSecret,setAppSecret]=useState("");
 const [side,setSide]=useState<"BUY"|"SELL">("BUY");
 const [orderType,setOrderType]=useState<"MARKET"|"LIMIT">("MARKET");
 const [quantityText,setQuantityText]=useState("1");
 const [limitText,setLimitText]=useState("");
 const [confirmation,setConfirmation]=useState("");
 const [previewKey,setPreviewKey]=useState<string|null>(null);
 const [message,setMessage]=useState("");

 const selected=accountId||live.account.data?.selectedAccountId;
 const quantity=Number(quantityText);
 const limitPrice=orderType==="LIMIT"?Number(limitText):undefined;
 const currentKey=[selected,symbol,side,orderType,quantityText,limitText].join("|");
 const held=Number(live.account.data?.positions.find(p=>p.symbol.toUpperCase()===symbol.toUpperCase())?.quantity??0);
 const notional=Number.isFinite(quantity)&&quantity>0?(orderType==="LIMIT"&&Number.isFinite(limitPrice as number)?quantity*(limitPrice as number):latestPrice?quantity*latestPrice:null):null;

 const order=useMutation({
   mutationFn:postWebullLiveOrder,
   onSuccess:data=>{
     if(data.action==="preview"){setPreviewKey(currentKey);setMessage("Webull accepted the live preview. Type LIVE to enable the final submit button.");}
     else{setPreviewKey(null);setConfirmation("");setMessage("LIVE order submitted to Webull. Refresh the account to confirm broker status.");void live.account.refetch();}
   },
   onError:error=>{setPreviewKey(null);setMessage(error instanceof Error?error.message:"Live order failed.");},
 });

 useEffect(()=>{setPreviewKey(null);setConfirmation("");setMessage("");},[currentKey]);

 if(!enabled)return null;
 const connected=Boolean(live.account.data);

 return <section className={styles.panel} id="webull-live">
   <div className={styles.head}>
     <div>
       <small>WEBULL LIVE · REAL MONEY</small>
       <h2>{connected?"Manual live trading":"Connect Webull Production"}</h2>
       <p>Separate from PaperTrade. Omega cannot submit orders from this live ticket.</p>
     </div>
     <div className={styles.headActions}>
       {connected&&<Button size="sm" variant="outline" onClick={()=>live.account.refetch()} disabled={live.account.isFetching}><RefreshCw size={14}/>{live.account.isFetching?"Syncing":"Refresh"}</Button>}
       <Button size="sm" variant="outline" onClick={()=>setShowConnect(v=>!v)}>{showConnect?"Close":"Production keys"}</Button>
     </div>
   </div>

   <div className={styles.warning}><AlertTriangle size={18}/><div><strong>REAL MONEY</strong><span>Orders in this panel go to Webull Production. Paper automation remains separate.</span></div></div>

   {showConnect&&<div className={styles.connect}>
     <label>Production App Key<Input type="password" value={appKey} onChange={e=>setAppKey(e.target.value)} autoComplete="off"/></label>
     <label>Production App Secret<Input type="password" value={appSecret} onChange={e=>setAppSecret(e.target.value)} autoComplete="off"/></label>
     <Button disabled={live.connect.isPending||appKey.length<16||appSecret.length<16} onClick={async()=>{
       try{await live.connect.mutateAsync({appKey,appSecret});setAppKey("");setAppSecret("");setShowConnect(false);await live.account.refetch();}catch{}
     }}>{live.connect.isPending?"Verifying Production…":"Connect Webull Live"}</Button>
     <p>Use Production OpenAPI keys from Webull, not your sandbox keys. TradeCUE encrypts the credentials before storage.</p>
     {live.connect.error&&<p className={styles.error}>{live.connect.error.message}</p>}
   </div>}

   {!connected&&<div className={styles.empty}>
     <ShieldCheck size={22}/>
     <div><strong>Live account not connected</strong><p>Apply for Webull Production OpenAPI, generate production App Key/App Secret, then connect them here. PaperTrade keeps working meanwhile.</p><a href="https://developer.webull.com/apis/docs/authentication/IndividualApplicationAPI/" target="_blank" rel="noreferrer">Open Webull Production API instructions →</a></div>
   </div>}

   {connected&&<>
     <div className={styles.accountBar}>
       <Select value={live.account.data!.selectedAccountId} onValueChange={id=>setAccountId(id)}>
         <SelectTrigger aria-label="Webull live account"><SelectValue/></SelectTrigger>
         <SelectContent>{live.account.data!.accounts.map(a=><SelectItem key={a.accountId} value={a.accountId}>{a.accountType} {a.accountMask}</SelectItem>)}</SelectContent>
       </Select>
       <span>Production · updated {new Date(live.account.data!.updatedAt).toLocaleTimeString()}</span>
     </div>

     <div className={styles.stats}>
       <span><small>Buying power</small><strong>{money(live.account.data!.balance.buyingPower)}</strong></span>
       <span><small>Cash</small><strong>{money(live.account.data!.balance.cash)}</strong></span>
       <span><small>Equity</small><strong>{money(live.account.data!.balance.equity)}</strong></span>
       <span><small>Day P&L</small><strong>{money(live.account.data!.balance.dayPnl)}</strong></span>
     </div>

     <div className={styles.ticket}>
       <div className={styles.ticketHead}><WalletCards size={18}/><div><strong>{symbol} LIVE ORDER</strong><span>Reference {money(latestPrice)} · held {Number.isFinite(held)?held:"—"} shares</span></div></div>
       <div className={styles.sideButtons}>
         <button className={side==="BUY"?styles.buyActive:undefined} onClick={()=>setSide("BUY")}>BUY</button>
         <button className={side==="SELL"?styles.sellActive:undefined} onClick={()=>setSide("SELL")} disabled={held<=0}>SELL</button>
       </div>
       <div className={styles.fields}>
         <label>Order type<Select value={orderType} onValueChange={v=>setOrderType(v as "MARKET"|"LIMIT")}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="MARKET">Market</SelectItem><SelectItem value="LIMIT">Limit</SelectItem></SelectContent></Select></label>
         <label>Quantity<Input inputMode="decimal" value={quantityText} onChange={e=>setQuantityText(e.target.value.replace(/[^0-9.]/g,""))}/></label>
         {orderType==="LIMIT"&&<label>Limit price<Input inputMode="decimal" value={limitText} onChange={e=>setLimitText(e.target.value.replace(/[^0-9.]/g,""))} placeholder={latestPrice?String(latestPrice):""}/></label>}
         <div className={styles.notional}><small>Approx. notional</small><strong>{money(notional)}</strong></div>
       </div>
       <Button variant="outline" disabled={order.isPending||!selected||!Number.isFinite(quantity)||quantity<=0||(side==="SELL"&&quantity>held)} onClick={()=>order.mutate({accountId:selected!,symbol,side,orderType,quantity,limitPrice,action:"preview"})}>{order.isPending?"Checking…":"Preview LIVE order"}</Button>
       {previewKey===currentKey&&<div className={styles.confirmLive}>
         <label>Type <b>LIVE</b> to confirm<Input value={confirmation} onChange={e=>setConfirmation(e.target.value.toUpperCase())} placeholder="LIVE"/></label>
         <Button variant="destructive" disabled={order.isPending||confirmation!=="LIVE"} onClick={()=>order.mutate({accountId:selected!,symbol,side,orderType,quantity,limitPrice,action:"place",confirmationText:confirmation})}>SUBMIT REAL-MONEY {side}</Button>
       </div>}
       {message&&<p className={order.isError?styles.error:styles.message}>{message}</p>}
     </div>

     <div className={styles.positions}>
       <h3>Live positions</h3>
       {live.account.data!.positions.length?<div>{live.account.data!.positions.map(p=><span key={p.symbol}><b>{p.symbol}</b><em>{p.quantity??"—"} shares</em><strong>{money(p.unrealizedPnl)}</strong></span>)}</div>:<p>No open live positions.</p>}
     </div>

     <Button size="sm" variant="ghost" disabled={live.disconnect.isPending} onClick={()=>live.disconnect.mutate()}>Disconnect live credentials</Button>
   </>}
   {live.account.error&&<p className={styles.error}>{live.account.error.message}</p>}
 </section>;
}
