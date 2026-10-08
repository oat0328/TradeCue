import {db}from "./db";import {stripeClient}from "./stripeClient";import {encryptBrokerSecret}from "./brokerCrypto";
export async function configureBilling() {
 const stripe=stripeClient();const balance=await stripe.balance.retrieve();
 const old=await db.selectFrom("appSettings").select("value").where("key","=","stripe_webhook").executeTakeFirst();
 const prior=old?.value as any;
 if(prior?.secret && prior.live===balance.livemode) return {ready:true,live:balance.livemode};
 const hook=await stripe.webhookEndpoints.create({url:"https://cuetrade.floot.app/_api/billing/webhook",enabled_events:["checkout.session.completed","checkout.session.async_payment_succeeded","checkout.session.expired","checkout.session.async_payment_failed","customer.subscription.updated","customer.subscription.deleted","invoice.paid","invoice.payment_failed"],metadata:{app:"TradeCue"}},{idempotencyKey:"tradecue-webhook-"+(balance.livemode?"live":"test")+"-v1"});
 if(!hook.secret)throw new Error("Webhook signing secret was not returned.");
 const signingSecret=encryptBrokerSecret(hook.secret);
 await db.insertInto("appSettings").values({key:"stripe_webhook",value:{id:hook.id,secret:signingSecret,live:balance.livemode}}).onConflict(o=>o.column("key").doUpdateSet({value:{id:hook.id,secret:signingSecret,live:balance.livemode},updatedAt:new Date()})).execute();
 return {ready:true,live:balance.livemode};
}
