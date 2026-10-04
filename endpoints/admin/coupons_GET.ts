import {apiUser,apiJson,apiFailure} from "../../helpers/apiAccess";import {db} from "../../helpers/db";
export async function handle(request:Request){try{await apiUser(request,true);
 const coupons=await db.selectFrom("membershipCoupons").selectAll().orderBy("createdAt","desc").limit(200).execute();
 const counts=await db.selectFrom("couponRedemptions").select(["couponId","status"]).select(eb=>eb.fn.countAll<string>().as("count")).groupBy(["couponId","status"]).execute();
 const billing=await db.selectFrom("appSettings").select("value").where("key","=","stripe_webhook").executeTakeFirst();
 const b=billing?.value as any;return apiJson({coupons:coupons.map(c=>({...c,used:Number(counts.find(x=>x.couponId===c.id&&x.status==="redeemed")?.count||0),reserved:Number(counts.find(x=>x.couponId===c.id&&x.status==="reserved")?.count||0)})),billingReady:!!b?.secret,billingLive:b?.live===true});
}catch(e){return apiFailure(e);}}

