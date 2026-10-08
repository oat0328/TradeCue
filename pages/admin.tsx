import React,{useMemo,useState}from "react";
import {Link}from "react-router-dom";
import {useQueryClient}from "@tanstack/react-query";
import {Button}from "../components/Button";
import {Badge}from "../components/Badge";
import {Input}from "../components/Input";
import {Sheet,SheetContent,SheetDescription,SheetHeader,SheetTitle}from "../components/Sheet";
import {CouponManager}from "../components/CouponManager";
import {AdminMemberPanel}from "../components/AdminMemberPanel";
import {WebullPanel}from "../components/WebullPanel";
import {WebullLivePanel}from "../components/WebullLivePanel";
import {useAdminOverview}from "../helpers/useAdminOverview";
import {useAdminMembers}from "../helpers/useAdminMembers";
import {useWebullAccount}from "../helpers/useWebullAccount";
import {postBillingSetup}from "../endpoints/admin/billing-setup_POST.schema";
import styles from "./admin.module.css";

function when(value:Date|string|null|undefined){
  if(!value)return "—";
  return new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit",hour12:true}).format(new Date(value));
}

export default function AdminPage(){
 const [tab,setTab]=useState("Overview");
 const [accountId,setAccountId]=useState<string>();
 const [billingMessage,setBillingMessage]=useState("");
 const [billingBusy,setBillingBusy]=useState(false);
 const [memberQuery,setMemberQuery]=useState("");
 const [selectedMemberId,setSelectedMemberId]=useState<number|null>(null);
 const overview=useAdminOverview();
 const allowed=!!overview.data&&!overview.error;
 const members=useAdminMembers(allowed&&(tab==="Members"||tab==="Overview"));
 const webull=useWebullAccount(allowed&&tab==="Webull","NVDA","5m",accountId);
 const q=useQueryClient();

 const filteredMembers=useMemo(()=>{
   const all=members.data?.members??[];
   const query=memberQuery.trim().toLowerCase();
   if(!query)return all;
   return all.filter(m=>[m.displayName,m.email,m.tier,m.status,m.role].some(v=>String(v??"").toLowerCase().includes(query)));
 },[members.data?.members,memberQuery]);

 if(overview.isFetching&&!overview.data)return <div className={styles.loading}>Loading owner dashboard…</div>;
 if(!allowed)return <div className={styles.loading}><div className={styles.errorCard}><h1>Owner sign-in required</h1><p>{overview.error?.message||"Sign in with your owner account."}</p><Button asChild><Link to="/login">Sign in</Link></Button></div></div>;
 const d=overview.data!;

 return <div className={styles.shell}>
   <Sheet open={selectedMemberId!=null} onOpenChange={open=>{if(!open)setSelectedMemberId(null);}}>
     <SheetContent side="right" className={styles.memberSheet}>
       <SheetHeader><SheetTitle>Manage member account</SheetTitle><SheetDescription>Access, coupons, broker status, Omega controls, risk and activity. Broker credentials are never exposed.</SheetDescription></SheetHeader>
       {selectedMemberId!=null&&<div className={styles.memberSheetBody}><AdminMemberPanel userId={selectedMemberId}/></div>}
     </SheetContent>
   </Sheet>
   <header className={styles.topbar}>
     <Link to="/" className={styles.brand}><span>///</span>Trade<strong>Cue</strong></Link>
     <strong className={styles.consoleLabel}>OWNER DASHBOARD</strong>
     <Badge variant="outline">OWNER ACCESS</Badge>
     <Button asChild variant="outline"><Link to="/workstation">Open workstation</Link></Button>
   </header>

   <div className={styles.layout}>
     <aside className={styles.sidebar}>
       {["Overview","Members","Coupons","Webull","Billing","Audit trail"].map(t=><Button key={t} variant={tab===t?"secondary":"ghost"} onClick={()=>setTab(t)}>{t}</Button>)}
       <div className={styles.ownerNote}><small>OWNER ONLY</small><p>Member accounts and brokerage credentials stay isolated by user.</p></div>
     </aside>

     <main className={styles.main}>
       <div className={styles.pageHead}>
         <div><span>TRADECUE OPERATIONS</span><h1>{tab}</h1><p>Users, access, brokerage connections, billing and system activity.</p></div>
         <Button variant="outline" onClick={()=>q.invalidateQueries({queryKey:["admin"]})}>Refresh</Button>
       </div>

       {tab==="Overview"&&<>
         <section className={styles.kpis}>
           <article><strong>{d.users}</strong><span>Registered users</span></article>
           <article><strong>{d.memberships.autopilot}</strong><span>Autopilot</span></article>
           <article><strong>{d.memberships.copilot}</strong><span>Copilot</span></article>
           <article><strong>{d.memberships.scout}</strong><span>Scout</span></article>
           <article><strong>{members.data?.members.filter(m=>m.paperWebull).length??"—"}</strong><span>Paper Webull connected</span></article>
           <article><strong>{members.data?.members.filter(m=>m.liveWebull).length??"—"}</strong><span>Live Webull connected</span></article>
         </section>
         <section className={styles.panel}>
           <div className={styles.sectionHead}><div><span>LATEST REGISTRATIONS</span><h2>Newest users</h2></div><Button variant="outline" size="sm" onClick={()=>setTab("Members")}>View everyone</Button></div>
           <div className={styles.memberList}>
             {(members.data?.members??[]).slice(0,6).map(m=><article key={m.id}>
               <div><strong>{m.displayName}</strong><span>{m.email}</span></div>
               <div><small>Registered</small><b>{when(m.registeredAt)}</b></div>
               <div><small>Access</small><b>{m.role==="admin"?"Owner":(m.tier??"No tier")} · {m.status??"—"}</b></div>
               <div><small>Webull</small><b>{m.liveWebull?"LIVE":m.paperWebull?"PAPER":"Not connected"}</b></div>
             </article>)}
             {!members.isFetching&&!members.data?.members.length&&<p>No registered users yet.</p>}
           </div>
         </section>
       </>}

       {tab==="Members"&&<section className={styles.panel}>
         <div className={styles.sectionHead}><div><span>REGISTERED USERS</span><h2>Members & access</h2></div><Badge variant="outline">{members.data?.members.length??0} USERS</Badge></div>
         <div className={styles.memberTools}><Input value={memberQuery} onChange={e=>setMemberQuery(e.target.value)} placeholder="Search name, email, tier or status…"/></div>
         {members.isFetching&&<p>Loading members…</p>}
         {members.error&&<p role="alert" className={styles.error}>{members.error.message}</p>}
         <div className={styles.memberTableWrap}>
           <div className={styles.memberTable}>
             <div className={styles.memberHeader}><span>User</span><span>Registered</span><span>Membership</span><span>Webull</span><span>Last activity</span><span>Manage</span></div>
             {filteredMembers.map(m=><div className={styles.memberRow} key={m.id}>
               <span><strong>{m.displayName}</strong><small>{m.email}</small><em>{m.role==="admin"?"OWNER":"USER"} · ID {m.id}</em></span>
               <span><b>{when(m.registeredAt)}</b></span>
               <span><b>{m.role==="admin"?"Owner":m.tier??"No tier"}</b><small>{m.role==="admin"?"Permanent":m.status??"—"}</small></span>
               <span><b>{m.liveWebull?"LIVE "+(m.liveMask??""):m.paperWebull?"PAPER "+(m.paperMask??""):"Not connected"}</b>{m.paperWebull&&m.liveWebull&&<small>Paper also connected</small>}</span>
               <span><b>{when(m.lastSeen)}</b><small>{m.lastAction?.replaceAll("_"," ")??"No activity recorded"}</small></span>
               <span><Button size="sm" variant="outline" onClick={()=>setSelectedMemberId(m.id)}>Manage account</Button></span>
             </div>)}
           </div>
         </div>
         {!filteredMembers.length&&!members.isFetching&&<p>No users match that search.</p>}
       </section>}

       {tab==="Coupons"&&<CouponManager/>}

       {tab==="Webull"&&<>
         <WebullPanel webull={webull} isOwner onAccount={setAccountId}/>
         <WebullLivePanel enabled={allowed} symbol="AAPL"/>
         <section className={styles.panel}>
           <h2>Broker connections</h2>
           <p>PaperTrade and live-money Webull connections are intentionally separate. A user's brokerage credentials are private to that user.</p>
           <p>Live manual trading requires approved Webull Production OpenAPI credentials. Omega remains PaperTrade-only.</p>
         </section>
       </>}

       {tab==="Billing"&&<section className={styles.panel}>
         <h2>Membership billing</h2>
         <p>Check Stripe configuration before allowing paid checkout.</p>
         <Button disabled={billingBusy} onClick={async()=>{setBillingBusy(true);try{const r=await postBillingSetup();setBillingMessage(r.live?"Live Stripe payment notifications configured.":"Stripe test payment notifications configured. Customers cannot be charged in this mode.");}catch(e){setBillingMessage(e instanceof Error?e.message:"Setup failed");}finally{setBillingBusy(false);}}}>{billingBusy?"Checking…":"Check and configure billing"}</Button>
         <p role="status">{billingMessage}</p>
         <Button asChild variant="outline"><Link to="/membership">Membership and checkout</Link></Button>
       </section>}

       {tab==="Audit trail"&&<section className={styles.panel}>
         <h2>Recent activity</h2>
         <div className={styles.audit}>{d.recentAudit.length===0?<p>No activity yet.</p>:d.recentAudit.map(a=><div key={a.id}><span>{a.action.replaceAll("_"," ")}</span><strong>{a.entityType||"system"}</strong><time>{when(a.createdAt)}</time></div>)}</div>
       </section>}
     </main>
   </div>
 </div>;
}
