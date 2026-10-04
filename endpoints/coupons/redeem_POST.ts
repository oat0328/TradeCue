import superjson from "superjson";import {apiUser,apiJson,apiFailure,ApiError} from "../../helpers/apiAccess";import {db} from "../../helpers/db";import {schema} from "./redeem_POST.schema";import {addDuration} from "../../helpers/couponRules";
export async function handle(request:Request){try{const u=await apiUser(request);const {code}=schema.parse(superjson.parse(await request.text()));
 const result=await db.transaction().execute(async t=>{
 const c=await t.selectFrom("membershipCoupons").selectAll().where("code","=",code).forUpdate().executeTakeFirst();
 if(!c||!c.active||c.redeemBy<=new Date())throw new ApiError(400,"This code is invalid, disabled, or expired.");
 const used=await t.selectFrom("couponRedemptions").select(eb=>eb.fn.countAll<string>().as("n")).where("couponId","=",c.id).where("status","in",["redeemed","reserved"]).executeTakeFirstOrThrow();
 const existing=await t.selectFrom("couponRedemptions").selectAll().where("couponId","=",c.id).where("userId","=",u.id).executeTakeFirst();
 if(existing?.status==="redeemed")throw new ApiError(409,"You have already redeemed this code.");
 if(Number(used.n)>=c.maxRedemptions && existing?.status!=="reserved")throw new ApiError(409,"This code has reached its usage limit.");
 if(c.kind==="percent_discount")return {kind:c.kind,tier:c.tier,percentOff:c.percentOff!,months:c.durationValue,code:c.code};
 const expiresAt=addDuration(new Date(),c.durationValue,c.durationUnit);
 await t.insertInto("couponRedemptions").values({couponId:c.id,userId:u.id,status:"redeemed",accessExpiresAt:expiresAt,redeemedAt:new Date()}).execute();
 await t.insertInto("cueAuditLog").values({userId:u.id,action:"coupon_redeemed",entityType:"coupon",entityId:c.id,details:{tier:c.tier,expiresAt:expiresAt.toISOString()}}).execute();
 return {kind:c.kind,tier:c.tier,expiresAt};
 });return apiJson(result);
}catch(e){return apiFailure(e);}}

