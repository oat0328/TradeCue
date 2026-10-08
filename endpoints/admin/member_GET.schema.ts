import {z}from "zod";
import {readApiResponse}from "../../helpers/apiClient";
export const schema=z.object({userId:z.coerce.number().int().positive()});
export type OutputType={
  member:{id:number;displayName:string;email:string;role:string;registeredAt:Date|null};
  adminAccess:{suspended:boolean;reason:string|null;updatedBy:number|null;updatedAt:string|null};
  membership:{tier:string;status:string;accessActive:boolean;trialEndsAt:Date|null;currentPeriodEndsAt:Date|null};
  coupons:{code:string;tier:string;kind:string;accessExpiresAt:Date|null;redeemedAt:Date|null;status:string}[];
  brokers:{paperConnected:boolean;liveConnected:boolean;paperMask:string|null;liveMask:string|null};
  automation:{brainEnabled:boolean;autoPaperEnabled:boolean;killSwitch:boolean;maxAutoPositions:number;perTradeBudget:number}|null;
  risk:{maxRiskPerTrade:number;maxDailyLoss:number;maxTradesPerDay:number;longOnly:boolean;safeModeEnabled:boolean;noChaseEnabled:boolean}|null;
  recentActivity:{action:string;entityType:string|null;createdAt:Date}[];
};
export async function getAdminMember(userId:number):Promise<OutputType>{
 const r=await fetch("/_api/admin/member?userId="+encodeURIComponent(String(userId)),{credentials:"include"});
 return readApiResponse<OutputType>(r,"Unable to load member");
}
