import superjson from "superjson";
export type AdminMember={
  id:number;displayName:string;email:string;role:string;
  registeredAt:Date|null;updatedAt:Date|null;
  tier:string|null;status:string|null;trialEndsAt:Date|null;currentPeriodEndsAt:Date|null;
  paperWebull:boolean;liveWebull:boolean;paperMask:string|null;liveMask:string|null;
  lastSeen:Date|null;lastAction:string|null;
};
export type OutputType={members:AdminMember[]};
export async function getAdminMembers():Promise<OutputType>{
  const r=await fetch("/_api/admin/members",{credentials:"include"});
  const d=superjson.parse<any>(await r.text());
  if(!r.ok)throw new Error(d.error||"Unable to load members");
  return d;
}
   16