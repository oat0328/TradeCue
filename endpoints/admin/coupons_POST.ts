import {randomBytes} from "crypto";import superjson from "superjson";
import {apiUser,apiJson,apiFailure,ApiError} from "../../helpers/apiAccess";import {db} from "../../helpers/db";import {schema} from "./coupons_POST.schema";
export async function handle(request:Request){try{const u=await apiUser(request,true);const v=schema.parse(superjson.parse(await request.text()));
 if(new Date(v.redeemBy)<=new Date())throw new ApiError(400,"Choose a future redemption deadline.");
 const result=await db.transaction().execute(async t=>{const c=await t.insertInto("membershipCoupons").values({...v,code:v.code||"TC-"+randomBytes(6).toString("hex").toUpperCase(),percentOff:v.kind==="percent_discount"?v.percentOff!:null,redeemBy:new Date(v.redeemBy),createdBy:u.id}).returning(["id","code"]).executeTakeFirstOrThrow();await t.insertInto("cueAuditLog").values({userId:u.id,action:"coupon_created",entityType:"coupon",entityId:c.id,details:{kind:v.kind,tier:v.tier,durationValue:v.durationValue,durationUnit:v.durationUnit}}).execute();return c;});
 return apiJson(result);
}catch(e){if((e as any)?.code==="23505")return apiJson({error:"That coupon code already exists."},409);return apiFailure(e);}}

