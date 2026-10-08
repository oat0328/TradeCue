import {z}from "zod";
import superjson from "superjson";
import {readApiResponse}from "../../helpers/apiClient";
export const schema=z.object({userId:z.number().int().positive(),code:z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{4,32}$/)});
export type OutputType={applied:true;code:string;tier:string;expiresAt:Date};
export async function postAdminMemberCoupon(body:z.infer<typeof schema>):Promise<OutputType>{
 const r=await fetch("/_api/admin/member-coupon",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:superjson.stringify(schema.parse(body))});
 return readApiResponse<OutputType>(r,"Unable to apply coupon to member");
}
