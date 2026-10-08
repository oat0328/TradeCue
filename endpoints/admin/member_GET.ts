import {apiUser,apiJson,apiFailure,ApiError}from "../../helpers/apiAccess";
import {db}from "../../helpers/db";
import {effectiveMembership}from "../../helpers/effectiveMembership";
import {getAdminAccessState}from "../../helpers/adminUserAccess";
import {schema}from "./member_GET.schema";

export async function handle(request:Request){
 try{
  await apiUser(request,true);
  const {userId}=schema.parse(Object.fromEntries(new URL(request.url).searchParams));
  const user=await db.selectFrom("users").select(["id","displayName","email","role","createdAt"]).where("id","=",userId).executeTakeFirst();
  if(!user)throw new ApiError(404,"Member not found.");
  const [base,effective,adminAccess,grants,brokerRows,paperCredential,automation,risk,activity]=await Promise.all([
    db.selectFrom("userMemberships").selectAll().where("userId","=",userId).executeTakeFirst(),
    effectiveMembership(userId,user.role==="admin"),
    getAdminAccessState(userId),
    db.selectFrom("couponRedemptions as r")
      .innerJoin("membershipCoupons as c","c.id","r.couponId")
      .select(["c.code","c.tier","c.kind","r.accessExpiresAt","r.redeemedAt","r.status"])
      .where("r.userId","=",userId)
      .orderBy("r.reservedAt","desc")
      .limit(25).execute(),
    db.selectFrom("brokerConnections").select(["status","isPaper","accountMask"]).where("userId","=",userId).where("provider","=","webull").execute(),
    db.selectFrom("webullCredentials").select(["verifiedAt"]).where("userId","=",userId).executeTakeFirst(),
    db.selectFrom("cueAutomationControls").select(["brainEnabled","autoPaperEnabled","killSwitch","maxAutoPositions","perTradeBudget"]).where("userId","=",userId).executeTakeFirst(),
    db.selectFrom("riskProfiles").select(["maxRiskPerTrade","maxDailyLoss","maxTradesPerDay","longOnly","safeModeEnabled","noChaseEnabled"]).where("userId","=",userId).executeTakeFirst(),
    db.selectFrom("cueAuditLog").select(["action","entityType","createdAt"]).where("userId","=",userId).orderBy("createdAt","desc").limit(20).execute(),
  ]);
  const paperRow=brokerRows.find(row=>row.isPaper&&row.status==="connected");
  const liveRow=brokerRows.find(row=>!row.isPaper&&row.status==="connected");
  return apiJson({
    member:{id:user.id,displayName:user.displayName,email:user.email,role:user.role,registeredAt:user.createdAt??null},
    adminAccess,
    membership:{
      tier:effective.tier,status:effective.status,accessActive:effective.accessActive,
      trialEndsAt:base?.trialEndsAt??null,currentPeriodEndsAt:effective.currentPeriodEndsAt??null,
    },
    coupons:grants,
    brokers:{
      paperConnected:Boolean(paperRow||paperCredential||(user.role==="admin"&&process.env.WEBULL_APP_KEY&&process.env.WEBULL_APP_SECRET)),
      liveConnected:Boolean(liveRow),paperMask:paperRow?.accountMask??null,liveMask:liveRow?.accountMask??null,
    },
    automation:automation?{
      brainEnabled:automation.brainEnabled,autoPaperEnabled:automation.autoPaperEnabled,killSwitch:automation.killSwitch,
      maxAutoPositions:automation.maxAutoPositions,perTradeBudget:Number(automation.perTradeBudget),
    }:null,
    risk:risk?{
      maxRiskPerTrade:Number(risk.maxRiskPerTrade),maxDailyLoss:Number(risk.maxDailyLoss),maxTradesPerDay:risk.maxTradesPerDay,
      longOnly:risk.longOnly,safeModeEnabled:risk.safeModeEnabled,noChaseEnabled:risk.noChaseEnabled,
    }:null,
    recentActivity:activity,
  });
 }catch(e){return apiFailure(e);}
}
