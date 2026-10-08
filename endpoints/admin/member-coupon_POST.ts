import superjson from "superjson";
import {apiUser,apiJson,apiFailure,ApiError}from "../../helpers/apiAccess";
import {db}from "../../helpers/db";
import {addDuration}from "../../helpers/couponRules";
import {setAdminAccessState}from "../../helpers/adminUserAccess";
import {schema}from "./member-coupon_POST.schema";

export async function handle(request:Request){
 try{
  const admin=await apiUser(request,true);
  const input=schema.parse(superjson.parse(await request.text()));
  const target=await db.selectFrom("users").select(["id","role"]).where("id","=",input.userId).executeTakeFirst();
  if(!target)throw new ApiError(404,"Member not found.");
  const result=await db.transaction().execute(async t=>{
    const coupon=await t.selectFrom("membershipCoupons").selectAll().where("code","=",input.code).forUpdate().executeTakeFirst();
    if(!coupon||!coupon.active||coupon.redeemBy<=new Date())throw new ApiError(400,"This coupon is invalid, disabled, or expired.");
    if(coupon.kind!=="free_access")throw new ApiError(400,"Admin direct-apply currently supports free-access coupons. Percentage discounts must be used through checkout.");
    const existing=await t.selectFrom("couponRedemptions").selectAll().where("couponId","=",coupon.id).where("userId","=",input.userId).executeTakeFirst();
    if(existing?.status==="redeemed"&&existing.accessExpiresAt&&existing.accessExpiresAt>new Date())throw new ApiError(409,"This member already has an active grant from that coupon.");
    const used=await t.selectFrom("couponRedemptions").select(eb=>eb.fn.countAll<string>().as("n")).where("couponId","=",coupon.id).where("status","in",["redeemed","reserved"]).executeTakeFirstOrThrow();
    if(Number(used.n)>=coupon.maxRedemptions&&existing?.status!=="reserved")throw new ApiError(409,"This coupon has reached its usage limit.");
    const expiresAt=addDuration(new Date(),coupon.durationValue,coupon.durationUnit);
    if(existing){
      await t.updateTable("couponRedemptions").set({status:"redeemed",accessExpiresAt:expiresAt,redeemedAt:new Date()}).where("id","=",existing.id).execute();
    }else{
      await t.insertInto("couponRedemptions").values({couponId:coupon.id,userId:input.userId,status:"redeemed",accessExpiresAt:expiresAt,redeemedAt:new Date()}).execute();
    }
    await t.insertInto("cueAuditLog").values({
      userId:input.userId,action:"admin_coupon_applied",entityType:"coupon",entityId:coupon.id,
      details:{code:coupon.code,tier:coupon.tier,expiresAt:expiresAt.toISOString(),appliedBy:admin.id},
    }).execute();
    await t.insertInto("cueAuditLog").values({
      userId:admin.id,action:"member_coupon_applied",entityType:"user",entityId:String(input.userId),
      details:{code:coupon.code,tier:coupon.tier,expiresAt:expiresAt.toISOString()},
    }).execute();
    return {code:coupon.code,tier:coupon.tier,expiresAt};
  });
  await setAdminAccessState(input.userId,{suspended:false,reason:null,updatedBy:admin.id});
  return apiJson({applied:true as const,...result});
 }catch(e){return apiFailure(e);}
}
