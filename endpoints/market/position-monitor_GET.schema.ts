import { z } from "zod";
import { readApiResponse } from "../../helpers/apiClient";

export const schema=z.object({accountId:z.string().optional()});
export type PositionMonitorRow={
  symbol:string;
  quantity:string|null;
  costPrice:string|null;
  marketValue:string|null;
  unrealizedPnl:string|null;
  lastPrice:number|null;
  cue:"HOLD"|"WATCH"|"EXIT REVIEW"|"DATA CHECK";
  commanderAction:"HOLD"|"RAISE STOP"|"TAKE 25%"|"TAKE 50%"|"EXIT"|"DATA CHECK";
  currentR:number|null;
  peakR?:number|null;
  suggestedStop:number|null;
  structure:string|null;
  cueScore:number|null;
  fresh:boolean;
  stop:number|null;
  target:number|null;
  reason:string;
};
export type OutputType={generatedAt:Date;positions:PositionMonitorRow[]};
export async function getPositionMonitor(accountId?:string):Promise<OutputType>{
  const search=new URLSearchParams();
  if(accountId)search.set("accountId",accountId);
  const r=await fetch("/_api/market/position-monitor"+(search.size?"?"+search.toString():""),{credentials:"include"});
  return readApiResponse<OutputType>(r,"Unable to load position monitor");
}
