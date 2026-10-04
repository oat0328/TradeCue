import {z} from "zod";import superjson from "superjson";export const schema=z.object({code:z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{4,32}$/)});
export type OutputType={kind:"free_access";tier:string;expiresAt:Date}|{kind:"percent_discount";tier:string;percentOff:number;months:number;code:string};
export async function postRedeemCoupon(body:z.infer<typeof schema>):Promise<OutputType>{const r=await fetch("/_api/coupons/redeem",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:superjson.stringify(schema.parse(body))});const d=superjson.parse<any>(await r.text());if(!r.ok)throw new Error(d.error);return d;}

