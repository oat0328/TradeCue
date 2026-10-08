import {couponInput} from "../../helpers/couponRules";import superjson from "superjson";import type {z} from "zod";
export const schema=couponInput;export type OutputType={id:string;code:string};
export async function postAdminCoupon(body:z.infer<typeof schema>):Promise<OutputType>{const r=await fetch("/_api/admin/coupons",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:superjson.stringify(schema.parse(body))});const d=superjson.parse<any>(await r.text());if(!r.ok)throw new Error(d.error);return d;}
