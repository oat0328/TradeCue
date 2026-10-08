import React,{useState}from "react";import {Link}from "react-router-dom";import type {useWebullAccount}from "../helpers/useWebullAccount";import {schema}from "../endpoints/webull/keys_POST.schema";
import {Button}from "./Button";import {Input}from "./Input";import {Form,FormItem,FormLabel,FormControl,FormMessage,useForm}from "./Form";import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem}from "./Select";
import styles from "./WebullPanel.module.css";
export function WebullPanel({webull,isOwner,onAccount,className=""}:{webull:ReturnType<typeof useWebullAccount>;isOwner:boolean;onAccount:(id:string)=>void;className?:string}) {
 const [showKeys,setShowKeys]=useState(false);const {account,connect,disconnect}=webull;
 const f=useForm({schema,defaultValues:{appKey:"",appSecret:""}});
 const money=(v:string|null|undefined)=>v!=null&&v!==""&&Number.isFinite(Number(v))?new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(v)):"—";
 return <section id="portfolio" className={styles.panel+" "+className}>
 <div className={styles.head}><div><small>WEBULL • PAPER ACCOUNT</small><h2>{account.data?"Your connected portfolio":"Connect your Webull paper account"}</h2><p>Sandbox balances and positions. Each member uses their own approved PaperTrade API keys.</p></div><div className={styles.actions}><Button variant="outline" size="sm" disabled={account.isFetching} onClick={()=>account.refetch()}>{account.isFetching?"Syncing…":"Refresh account"}</Button><Button variant="ghost" size="sm" onClick={()=>setShowKeys(!showKeys)}>{showKeys?"Close form":"App Key + App Secret"}</Button></div></div>
 {showKeys&&<Form {...f}><form className={styles.keys} onSubmit={f.handleSubmit(async values=>{try{await connect.mutateAsync(values);f.setValues({appKey:"",appSecret:""});setShowKeys(false);await account.refetch();}catch{}})}>
 {(["appKey","appSecret"]as const).map(name=><FormItem key={name} name={name}><FormLabel>{name==="appKey"?"App Key":"App Secret"}</FormLabel><FormControl><Input type="password" autoComplete="off" value={f.values[name]} onChange={e=>f.setValues(v=>({...v,[name]:e.target.value}))}/></FormControl><FormMessage/></FormItem>)}
 <Button type="submit" disabled={connect.isPending}>{connect.isPending?"Verifying…":"Verify and connect"}</Button><p>Your keys are encrypted on the server and never shown to other members.</p>
 {connect.error&&<p role="alert">{connect.error.message}</p>}</form></Form>}
 {account.error&&<p role="alert" className={styles.error}>{account.error.message}</p>}
 {account.data&&<>
 <div className={styles.accountPicker}><Select value={account.data.selectedAccountId} onValueChange={onAccount}><SelectTrigger aria-label="Webull paper account"><SelectValue/></SelectTrigger><SelectContent>{account.data.accounts.map(a=><SelectItem key={a.accountId} value={a.accountId}>{a.accountType} {a.accountMask}</SelectItem>)}</SelectContent></Select><small>Updated {new Date(account.data.updatedAt).toLocaleTimeString()}</small></div>
 <div className={styles.stats}><div><small>Buying power</small><strong>{money(account.data.balance.buyingPower)}</strong></div><div><small>Cash</small><strong>{money(account.data.balance.cash)}</strong></div><div><small>Account equity</small><strong>{money(account.data.balance.equity)}</strong></div><div><small>Day P&L</small><strong>{money(account.data.balance.dayPnl)}</strong></div></div>
 <div className={styles.tableWrap}><table><thead><tr><th>Position</th><th>Quantity</th><th>Average cost</th><th>Market value</th><th>Unrealized P&L</th></tr></thead><tbody>{account.data.positions.map((r,i)=><tr key={r.symbol+i}><td>{r.symbol}</td><td>{r.quantity??"—"}</td><td>{money(r.costPrice)}</td><td>{money(r.marketValue)}</td><td>{money(r.unrealizedPnl)}</td></tr>)}</tbody></table>{account.data.positions.length===0&&<p>No open positions in this paper account.</p>}</div>
 {!isOwner&&<Button size="sm" variant="ghost" disabled={disconnect.isPending} onClick={()=>disconnect.mutate()}>Remove saved keys</Button>}
 </>}
 {disconnect.error&&<p role="alert">{disconnect.error.message}</p>}
 <p className={styles.note}>This panel is PaperTrade only. Live Webull is a separate connection and order ticket so paper automation can never be confused with real money. <Link to="/membership">Membership & coupons</Link>{isOwner&&<> · <Link to="/admin">Owner dashboard</Link></>}</p>
 </section>;
}
