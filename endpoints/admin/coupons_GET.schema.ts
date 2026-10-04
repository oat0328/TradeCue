import {z} from "zod";import superjson from "superjson";import type {Selectable} from "kysely";import type {MembershipCoupons} from "../../helpers/schema";
export const schema=z.object({});export type OutputType={coupons:(Selectable<MembershipCoupons>&{used:number;reserved:number})[];billingReady:boolean;billingLive:boolean};
export async function getAdminCoupons():Promise<OutputType>{const r=await fetch("/_api/admin/coupons",{credentials:"include"});const d=superjson.parse<any>(await r.text());if(!r.ok)throw new Error(d.error);return d;}

