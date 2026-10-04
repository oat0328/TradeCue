import {z}from "zod";import superjson from "superjson";
export const schema=z.object({tier:z.enum(["scout","copilot","autopilot"]),code:z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{4,32}$/).optional()});export type OutputType={url:string;testMode:boolean};
export async function postCheckout(body:z.infer<typeof schema>):Promise<OutputType>{const r=await fetch("/_api/billing/checkout",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:superjson.stringify(schema.parse(body))});const d=superjson.parse<any>(await r.text());if(!r.ok)throw new Error(d.error);return d;}

