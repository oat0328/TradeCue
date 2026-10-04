import {z}from "zod";import superjson from "superjson";export const schema=z.object({});export type OutputType={ready:boolean;live:boolean};
export async function postBillingSetup():Promise<OutputType>{const r=await fetch("/_api/admin/billing-setup",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:superjson.stringify({})});const d=superjson.parse<any>(await r.text());if(!r.ok)throw new Error(d.error);return d;}

