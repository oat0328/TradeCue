import {db}from "./db";
export type AdminAccessState={suspended:boolean;reason:string|null;updatedBy:number|null;updatedAt:string|null};

export async function getAdminAccessState(userId:number):Promise<AdminAccessState>{
 const row=await db.selectFrom("appSettings").select(["value","updatedAt"]).where("key","=","admin_access_user_"+userId).executeTakeFirst();
 const value=(row?.value&&typeof row.value==="object"&&!Array.isArray(row.value)?row.value:{}) as Record<string,unknown>;
 return {
  suspended:value.suspended===true,
  reason:typeof value.reason==="string"?value.reason:null,
  updatedBy:typeof value.updatedBy==="number"?value.updatedBy:null,
  updatedAt:row?.updatedAt?new Date(row.updatedAt).toISOString():null,
 };
}
export async function setAdminAccessState(userId:number,state:{suspended:boolean;reason?:string|null;updatedBy:number}){
 const value={suspended:state.suspended,reason:state.reason??null,updatedBy:state.updatedBy,changedAt:new Date().toISOString()};
 await db.insertInto("appSettings").values({key:"admin_access_user_"+userId,value,updatedAt:new Date()})
   .onConflict(oc=>oc.column("key").doUpdateSet({value,updatedAt:new Date()})).execute();
 return value;
}
