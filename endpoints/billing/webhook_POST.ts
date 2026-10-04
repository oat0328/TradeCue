import type Stripe from "stripe";import {db}from "../../helpers/db";import {stripeClient}from "../../helpers/stripeClient";import {decryptBrokerSecret}from "../../helpers/brokerCrypto";
export async function handle(request:Request){
 const stripe=stripeClient();let event:Stripe.Event;
 try{const setting=await db.selectFrom("appSettings").select("value").where("key","=","stripe_webhook").executeTakeFirst();const c=setting?.value as any;if(!c?.secret)return new Response("Not configured",{status:503});
 event=stripe.webhooks.constructEvent(await request.text(),request.headers.get("stripe-signature")||"",decryptBrokerSecret(c.secret));
 if(event.livemode!==c.live)return new Response("Wrong environment",{status:400});
 }catch{return new Response("Invalid signature",{status:400});}
 try{
 await db.transaction().execute(async t=>{
 const obj=event.data.object as any;
 let subId:string|undefined;
 if(event.type.startsWith("checkout.session."))subId=typeof obj.subscription==="string"?obj.subscription:obj.subscription?.id;
 else if(event.type.startsWith("customer.subscription."))subId=obj.id;
 else if(event.type.startsWith("invoice."))subId=obj.parent?.subscription_details?.subscription||obj.subscription;
 let userId:number|undefined,checkout:any;
 if(event.type.startsWith("checkout.session.")){checkout=await t.selectFrom("billingCheckouts").selectAll().where("stripeSessionId","=",obj.id).executeTakeFirst();if(!checkout)return;userId=checkout.userId;}
 let latest:Stripe.Subscription|undefined;
 if(subId){latest=await stripe.subscriptions.retrieve(subId);if(latest.metadata.app!=="TradeCue")return;const inferred=Number(latest.metadata.userId);if(!Number.isSafeInteger(inferred)||inferred<1)return;if(userId&&userId!==inferred)throw new Error("Checkout owner mismatch");userId=inferred;}
 if(!userId)return;
 await t.selectFrom("userMemberships").select("id").where("userId","=",userId).forUpdate().executeTakeFirstOrThrow();
 const prior=await t.selectFrom("billingEvents").select("id").where("id","=",event.id).executeTakeFirst();if(prior)return;
 if(latest){
 // Re-fetch after taking the member lock so out-of-order events converge on Stripe's current state.
 latest=await stripe.subscriptions.retrieve(latest.id);
 const tier=latest.metadata.tier;if(!["scout","copilot","autopilot"].includes(tier))throw new Error("Invalid plan");
 const ends=latest.items.data.map(i=>i.current_period_end).filter(Number.isFinite);const end=ends.length?new Date(Math.min(...ends)*1000):null;
 const status=latest.status==="active"?"active":latest.status==="trialing"?"trial":latest.status==="past_due"?"past_due":"canceled";
 // A test subscription never grants paid access to a normal member.
 const member=await t.selectFrom("users").select("role").where("id","=",userId).executeTakeFirstOrThrow();
 if(event.livemode||member.role==="admin")await t.updateTable("userMemberships").set({tier:tier as "scout"|"copilot"|"autopilot",status,currentPeriodEndsAt:end,stripeCustomerId:typeof latest.customer==="string"?latest.customer:latest.customer.id,stripeSubscriptionId:latest.id,updatedAt:new Date()}).where("userId","=",userId).execute();
 }
 if(checkout){
 if(event.type==="checkout.session.expired"||event.type==="checkout.session.async_payment_failed")await t.updateTable("couponRedemptions").set({status:"released"}).where("checkoutSessionId","=",obj.id).where("status","=","reserved").execute();
 else if((event.type==="checkout.session.completed"||event.type==="checkout.session.async_payment_succeeded")&&["paid","no_payment_required"].includes(obj.payment_status))await t.updateTable("couponRedemptions").set({status:"redeemed",redeemedAt:new Date()}).where("checkoutSessionId","=",obj.id).where("status","=","reserved").execute();
 }
 await t.insertInto("billingEvents").values({id:event.id}).execute();
 await t.insertInto("cueAuditLog").values({userId,action:"billing_"+event.type,entityType:"membership",details:{live:event.livemode}}).execute();
 });return new Response(JSON.stringify({received:true}),{headers:{"Content-Type":"application/json"}});
 }catch{console.error("Billing webhook processing failed",event.id,event.type);return new Response("Please retry",{status:500});}
}
