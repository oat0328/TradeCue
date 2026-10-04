import { db } from "./db";
import { isMembershipCurrent, tierRank } from "./couponRules";
export async function effectiveMembership(userId:number, admin=false) {
  const base=await db.selectFrom("userMemberships").selectAll().where("userId","=",userId).executeTakeFirstOrThrow();
  if(admin) return {...base,tier:"autopilot" as const,status:"active" as const,accessActive:true};
  const grants=await db.selectFrom("couponRedemptions as r").innerJoin("membershipCoupons as c","c.id","r.couponId")
    .select(["c.tier","r.accessExpiresAt"]).where("r.userId","=",userId).where("r.status","=","redeemed").where("c.kind","=","free_access").where("r.accessExpiresAt",">",new Date()).execute();
  const active=isMembershipCurrent(base);
  const best=grants.sort((a,b)=>tierRank[b.tier]-tierRank[a.tier] || Number(b.accessExpiresAt)-Number(a.accessExpiresAt))[0];
  if(best && (!active || tierRank[best.tier]>=tierRank[base.tier])) return {...base,tier:best.tier,status:"active" as const,currentPeriodEndsAt:best.accessExpiresAt,accessActive:true};
  return {...base,accessActive:active};
}

