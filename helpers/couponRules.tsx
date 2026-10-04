import { z } from "zod";
export const couponInput = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{4,32}$/).optional(),
  kind: z.enum(["free_access","percent_discount"]),
  tier: z.enum(["scout","copilot","autopilot"]),
  percentOff: z.number().int().min(1).max(99).optional(),
  durationValue: z.number().int().min(1).max(365),
  durationUnit: z.enum(["days","months"]),
  maxRedemptions: z.number().int().min(1).max(100000),
  redeemBy: z.string().datetime(),
}).superRefine((v,ctx) => {
  if (v.kind === "percent_discount" && (!v.percentOff || v.durationUnit !== "months" || v.durationValue > 24)) ctx.addIssue({code:"custom",message:"Discounts require 1–99 percent and 1–24 months."});
  if (v.durationUnit === "months" && v.durationValue > 24) ctx.addIssue({code:"custom",message:"Choose at most 24 months."});
});
export function addDuration(start: Date, value: number, unit: "days" | "months") {
  const end = new Date(start);
  if(unit === "days") end.setUTCDate(end.getUTCDate()+value);
  else { const day=end.getUTCDate(); end.setUTCDate(1); end.setUTCMonth(end.getUTCMonth()+value); const last=new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth()+1,0)).getUTCDate(); end.setUTCDate(Math.min(day,last)); }
  return end;
}
export const tierRank = {scout:0,copilot:1,autopilot:2};
export function isMembershipCurrent(m: {status:string;trialEndsAt:Date;currentPeriodEndsAt:Date|null}, now=new Date()) {
  return m.status === "trial" ? m.trialEndsAt > now : m.status === "active" && m.currentPeriodEndsAt !== null && m.currentPeriodEndsAt > now;
}

