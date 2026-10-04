import {z}from "zod";import superjson from "superjson";export const schema=z.object({});export type OutputType={members:{id:number;displayName:string;email:string;role:string;tier:string|null;status:string|null}[]};
export async function getAdminMembers():Promise<OutputType>{const r=await fetch("/_api/admin/members",{credentials:"include"});const d=superjson.parse<any>(await r.text());if(!r.ok)throw new Error(d.error);return d;}

