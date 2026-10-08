import superjson from "superjson";import {randomUUID}from "crypto";import {db}from "../../helpers/db";import {stripeClient}from "../../helpers/stripeClient";import {apiUser,apiJson,apiFailure,ApiError}from "../../helpers/apiAccess";import {schema}from "./checkout_POST.schema";
const prices={scout:3900,copilot:12900,autopilot:24900};
export async function handle(request:Request){try{
 const u=await apiUser(request);const v=schema.parse(superjson.parse(await request.text()));const stripe=stripeClient();
 const setting=await db.selectFrom("appSettings").select("value").where("key","=","stripe_webhook").executeTakeFirst();const config=setting?.value as any;
 if(!config?.secret)throw new ApiError(503,"Billing setup is not complete. Free access codes can still be redeemed.");
 if(!config.live && u.role!=="admin")throw new ApiError(503,"Paid memberships are not open yet. The owner is testing billing.");
 const output=await db.transaction().execute(async t=>{
 const membership=await t.selectFrom("userMemberships").selectAll().where("userId","=",u.id).forUpdate().executeTakeFirstOrThrow();
 if(membership.stripeSubscriptionId){const s=await stripe.subscriptions.retrieve(membership.stripeSubscriptionId);if(!["canceled","incomplete_expired"].includes(s.status))throw new ApiError(409,"You already have a subscription. Manage it from billing.");}
 let coupon:any=null;
 if(v.code){coupon=await t.selectFrom("membershipCoupons").selectAll().where("code","=",v.code).forUpdate().executeTakeFirst();
 if(!coupon||!coupon.active||coupon.redeemBy<=new Date()||coupon.kind!=="percent_discount"||coupon.tier!==v.tier)throw new ApiError(400,"This discount is not available for the selected plan.");
 const old=await t.selectFrom("couponRedemptions").selectAll().where("couponId","=",coupon.id).where("userId","=",u.id).executeTakeFirst();
 if(old?.status==="redeemed")throw new ApiError(409,"You have already used this discount.");
 if(old?.status==="reserved" && old.checkoutSessionId){const s=await stripe.checkout.sessions.retrieve(old.checkoutSessionId);if(s.status==="open"&&s.url)return {url:s.url,testMode:!config.live};if(s.status==="complete")throw new ApiError(409,"Your payment is being confirmed.");await t.updateTable("couponRedemptions").set({status:"released"}).where("id","=",old.id).execute();}
 const count=await t.selectFrom("couponRedemptions").select(eb=>eb.fn.countAll<string>().as("n")).where("couponId","=",coupon.id).where("status","in",["reserved","redeemed"]).executeTakeFirstOrThrow();
 if(Number(count.n)>=coupon.maxRedemptions)throw new ApiError(409,"This code has reached its usage limit.");
 }
 const pending=await t.selectFrom("billingCheckouts").selectAll().where("userId","=",u.id).where("createdAt",">",new Date(Date.now()-86400000)).orderBy("createdAt","desc").limit(5).execute();
 for(const old of pending){if(!old.stripeSessionId)continue;const s=await stripe.checkout.sessions.retrieve(old.stripeSessionId);if(s.status==="open"){if(old.tier===v.tier&&old.couponId===(coupon?.id||null)&&s.url)return {url:s.url,testMode:!config.live};throw new ApiError(409,"Finish or let your existing checkout expire before starting another plan.");}if(s.status==="complete"&&s.payment_status==="unpaid")throw new ApiError(409,"A payment is still processing.");}
 const id=randomUUID();let stripeCoupon:string|undefined;
 if(coupon){stripeCoupon="tc_"+coupon.id;try{await stripe.coupons.retrieve(stripeCoupon);}catch(e){if((e as any).code!=="resource_missing")throw e;await stripe.coupons.create({id:stripeCoupon,name:coupon.code,percent_off:coupon.percentOff,duration:"repeating",duration_in_months:coupon.durationValue},{idempotencyKey:stripeCoupon});}}
 const session=await stripe.checkout.sessions.create({
 mode:"subscription",customer_email:u.email,client_reference_id:String(u.id),
 line_items:[{quantity:1,price_data:{currency:"usd",unit_amount:prices[v.tier],recurring:{interval:"month"},product_data:{name:"TradeCue "+v.tier}}}],
 ...(stripeCoupon?{discounts:[{coupon:stripeCoupon}]}:{}),
 subscription_data:{metadata:{app:"TradeCue",userId:String(u.id),tier:v.tier,checkoutId:id}},
 metadata:{app:"TradeCue",userId:String(u.id),tier:v.tier,checkoutId:id,couponId:coupon?.id||""},
 success_url:"https://cuetrade.floot.app/membership?checkout=complete",
 cancel_url:"https://cuetrade.floot.app/membership?checkout=canceled",expires_at:Math.floor(Date.now()/1000)+1800,
 integration_identifier:"tradecue_membership_qkzmtvra"
 },{idempotencyKey:"tc_checkout_"+id});
 if(!session.url)throw new Error("Checkout URL was not returned.");
 await t.insertInto("billingCheckouts").values({id,userId:u.id,tier:v.tier,couponId:coupon?.id||null,stripeSessionId:session.id,url:session.url}).execute();
 if(coupon)await t.insertInto("couponRedemptions").values({couponId:coupon.id,userId:u.id,status:"reserved",checkoutSessionId:session.id,checkoutUrl:session.url}).onConflict(o=>o.columns(["couponId","userId"]).doUpdateSet({status:"reserved",checkoutSessionId:session.id,checkoutUrl:session.url,reservedAt:new Date()})).execute();
 return {url:session.url,testMode:!config.live};
 });return apiJson(output);
}catch(e){return apiFailure(e);}}
