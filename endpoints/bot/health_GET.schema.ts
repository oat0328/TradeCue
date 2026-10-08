import { z } from "zod";
import { readApiResponse } from "../../helpers/apiClient";

export const schema=z.object({accountId:z.string().max(100).optional()});
export type OutputType={
  status:"READY"|"WAITING"|"BLOCKED";
  marketMode:string;
  accountId:string;
  buyingPower:number|null;
  dayPnl:number|null;
  positions:number;
  barCount:number;
  latestBarTime:string|null;
  barFresh:boolean;
  tradesToday:number;
  maxTradesPerDay:number;
  maxRiskPerTrade:number;
  maxDailyLoss:number;
  flatTimePt:string;
  consecutiveLosses:number;
  healthScore:number;
  healthLabel:"ELITE"|"HEALTHY"|"WARNING"|"CRITICAL";
  subsystems:{
    execution:boolean;
    data:boolean;
    scanner:boolean;
    strategy:boolean;
    risk:boolean;
    reporting:boolean;
  };
  tradingReady:boolean;
  blockers:string[];
  checkedAt:string;
};
export async function getBotHealth(accountId?:string):Promise<OutputType>{
  const params=new URLSearchParams();
  if(accountId)params.set("accountId",accountId);
  const r=await fetch("/_api/bot/health"+(params.size?"?"+params.toString():""),{credentials:"include"});
  return readApiResponse<OutputType>(r,"Bot self-test failed");
}