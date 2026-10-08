import React,{useMemo,useState}from "react";
import {useMutation,useQuery,useQueryClient}from "@tanstack/react-query";
import {Badge}from "./Badge";
import {Button}from "./Button";
import {Input}from "./Input";
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue}from "./Select";
import {getAdminMember}from "../endpoints/admin/member_GET.schema";
import {postAdminMemberCoupon}from "../endpoints/admin/member-coupon_POST.schema";
import {postAdminMemberControl}from "../endpoints/admin/member-control_POST.schema";
import {useCoupons}from "../helpers/useCoupons";
import styles from "./AdminMemberPanel.module.css";

function money(value:number|null|undefined){return value==null||!Number.isFinite(value)?"—":new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:2}).format(value);}
function when(value:Date|string|null|undefined){return value?new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit",hour12:true}).format(new Date(value)):"—";}

export function AdminMemberPanel({userId}:{userId:number}){
 const cache=useQueryClient();
 const member=useQuery({queryKey:["admin","member",userId],queryFn:()=>getAdminMember(userId),retry:false});
 const coupons=useCoupons(true);
 const [couponCode,setCouponCode]=useState("");
 const [message,setMessage]=useState("");
 const [endConfirm,setEndConfirm]=useState("");
 const activeCoupons=useMemo(()=>coupons.list.data?.coupons.filter(c=>c.active&&c.kind==="free_access"&&new Date(c.redeemBy)>new Date())??[],[coupons.list.data?.coupons]);

 const refresh=async()=>{
  await Promise.all([
   cache.invalidateQueries({queryKey:["admin","member",userId]}),
   cache.invalidateQueries({queryKey:["admin","members"]}),
   cache.invalidateQueries({queryKey:["admin"]}),
  ]);
 };
 const applyCoupon=useMutation({
  mutationFn:postAdminMemberCoupon,
  onSuccess:async data=>{setMessage(data.code+" applied through "+new Date(data.expiresAt).toLocaleDateString()+".");setCouponCode("");await refresh();},
  onError:error=>setMessage(error instanceof Error?error.message:"Unable to apply coupon."),
 });
 const control=useMutation({
  mutationFn:postAdminMemberControl,
  onSuccess:async data=>{const msg=data.action==="pause_axiom"?"Omega paused for this member.":data.action==="unlock_axiom"?"Omega unlocked. The member still has to turn automation on themselves.":data.action==="end_access"?"Account access ended and active sessions were signed out.": "Account access restored.";setMessage(msg);setEndConfirm("");await refresh();},
  onError:error=>setMessage(error instanceof Error?error.message:"Unable to update Omega."),
 });

 if(member.isFetching&&!member.data)return <div className={styles.loading}>Loading member account…</div>;
 if(member.error)return <div className={styles.error}>{member.error.message}</div>;
 if(!member.data)return null;
 const d=member.data;

 return <div className={styles.panel}>
  <div className={styles.identity}>
   <div><small>MEMBER ACCOUNT</small><h2>{d.member.displayName}</h2><p>{d.member.email} · ID {d.member.id}</p></div>
   <Badge variant={d.membership.accessActive?"success":"warning"}>{d.member.role==="admin"?"OWNER":d.membership.accessActive?"ACCESS ACTIVE":"ACCESS INACTIVE"}</Badge>
  </div>

  <div className={styles.summary}>
   <span><small>Membership</small><strong>{d.membership.tier.toUpperCase()}</strong><em>{d.membership.status}</em></span>
   <span><small>Registered</small><strong>{when(d.member.registeredAt)}</strong></span>
   <span><small>Paper Webull</small><strong>{d.brokers.paperConnected?"CONNECTED":"NO"}</strong><em>{d.brokers.paperMask??""}</em></span>
   <span><small>Live Webull</small><strong>{d.brokers.liveConnected?"CONNECTED":"NO"}</strong><em>{d.brokers.liveMask??""}</em></span>
  </div>

  <section className={styles.section}>
   <div className={styles.sectionHead}><div><small>ACCESS</small><h3>Apply coupon to this member</h3></div></div>
   <p>Free-access coupons can be assigned here without making the member enter the code themselves.</p>
   <div className={styles.couponRow}>
    <Select value={couponCode} onValueChange={setCouponCode}>
     <SelectTrigger aria-label="Coupon code"><SelectValue placeholder="Choose active free-access coupon"/></SelectTrigger>
     <SelectContent>{activeCoupons.map(c=><SelectItem key={c.id} value={c.code}>{c.code} · {c.tier} · {c.durationValue} {c.durationUnit}</SelectItem>)}</SelectContent>
    </Select>
    <Input value={couponCode} onChange={e=>setCouponCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g,""))} placeholder="Or type coupon code"/>
    <Button disabled={applyCoupon.isPending||couponCode.length<4} onClick={()=>applyCoupon.mutate({userId,code:couponCode})}>{applyCoupon.isPending?"Applying…":"Apply to member"}</Button>
   </div>
   <div className={styles.grants}>
    <strong>Coupon history</strong>
    {d.coupons.length?d.coupons.map((c,i)=><div key={c.code+i}><span>{c.code}</span><b>{c.tier}</b><em>{c.status} · {c.accessExpiresAt?"through "+when(c.accessExpiresAt):"billing coupon"}</em></div>):<p>No coupon grants on this account.</p>}
   </div>
  </section>

  <section className={styles.section}>
   <div className={styles.sectionHead}><div><small>ACCOUNT ACCESS</small><h3>End or restore this user's access</h3></div><Badge variant={d.adminAccess.suspended?"destructive":"success"}>{d.adminAccess.suspended?"ENDED":"ACTIVE"}</Badge></div>
   <p>Ending access signs the user out, disables effective membership access, and kill-switches Omega. Their history and broker connection records are preserved.</p>
   {d.adminAccess.suspended?<>
     <div className={styles.actions}><Button variant="outline" disabled={control.isPending||d.member.role==="admin"} onClick={()=>control.mutate({userId,action:"restore_access"})}>Restore access</Button></div>
     <p>You can also apply a free-access coupon above; applying it clears the admin suspension and extends the member.</p>
   </>:<>
     <div className={styles.dangerRow}>
       <Input value={endConfirm} onChange={e=>setEndConfirm(e.target.value.toUpperCase())} placeholder="Type END ACCESS"/>
       <Button variant="destructive" disabled={control.isPending||d.member.role==="admin"||endConfirm!=="END ACCESS"} onClick={()=>control.mutate({userId,action:"end_access",confirmationText:endConfirm})}>End account access</Button>
     </div>
   </>}
  </section>

  <section className={styles.section}>
   <div className={styles.sectionHead}><div><small>OMEGA</small><h3>Paper automation control</h3></div><Badge variant={d.automation?.killSwitch?"destructive":d.automation?.autoPaperEnabled?"success":"outline"}>{d.automation?.killSwitch?"PAUSED":d.automation?.autoPaperEnabled?"AUTO PAPER ON":"NOT ARMED"}</Badge></div>
   <div className={styles.controlGrid}>
    <span><small>Brain</small><strong>{d.automation?.brainEnabled?"ON":"OFF"}</strong></span>
    <span><small>Auto Paper</small><strong>{d.automation?.autoPaperEnabled?"ON":"OFF"}</strong></span>
    <span><small>Max positions</small><strong>{d.automation?.maxAutoPositions??"—"}</strong></span>
    <span><small>Budget / trade</small><strong>{money(d.automation?.perTradeBudget)}</strong></span>
   </div>
   <div className={styles.actions}>
    <Button variant="destructive" disabled={control.isPending||d.member.role==="admin"} onClick={()=>control.mutate({userId,action:"pause_axiom"})}>Pause Omega</Button>
    <Button variant="outline" disabled={control.isPending||d.member.role==="admin"||!d.automation?.killSwitch} onClick={()=>control.mutate({userId,action:"unlock_axiom"})}>Unlock Omega</Button>
   </div>
   <p>Unlocking does not start trades. It only clears the admin pause; the member must arm PaperTrade themselves.</p>
  </section>

  <section className={styles.section}>
   <div className={styles.sectionHead}><div><small>RISK</small><h3>Current safeguards</h3></div></div>
   <div className={styles.controlGrid}>
    <span><small>Risk / trade</small><strong>{money(d.risk?.maxRiskPerTrade)}</strong></span>
    <span><small>Daily loss</small><strong>{money(d.risk?.maxDailyLoss)}</strong></span>
    <span><small>Max trades</small><strong>{d.risk?.maxTradesPerDay??"—"}</strong></span>
    <span><small>Safe mode</small><strong>{d.risk?.safeModeEnabled?"ON":"OFF"}</strong></span>
    <span><small>Long only</small><strong>{d.risk?.longOnly?"ON":"OFF"}</strong></span>
    <span><small>No chase</small><strong>{d.risk?.noChaseEnabled?"ON":"OFF"}</strong></span>
   </div>
  </section>

  <section className={styles.section}>
   <div className={styles.sectionHead}><div><small>ACTIVITY</small><h3>Recent account activity</h3></div></div>
   <div className={styles.activity}>{d.recentActivity.length?d.recentActivity.map((a,i)=><div key={a.action+i}><span>{a.action.replaceAll("_"," ")}</span><b>{a.entityType??"system"}</b><time>{when(a.createdAt)}</time></div>):<p>No activity recorded yet.</p>}</div>
  </section>

  {message&&<p className={applyCoupon.isError||control.isError?styles.error:styles.message}>{message}</p>}
 </div>;
}
