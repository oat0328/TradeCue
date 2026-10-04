import { z } from "zod";
import { readApiResponse } from "../../helpers/apiClient";

export const schema = z.object({
  mode: z.enum(["auto","active","momentum","buy_low"]).default("auto"),
  maxPrice: z.coerce.number().positive().max(100000).optional(),
  budget: z.coerce.number().positive().max(10000000).optional(),
  minScore: z.coerce.number().int().min(0).max(100).default(65),
  limit: z.coerce.number().int().min(4).max(16).default(12),
});

export type HunterRow = {
  symbol:string;
  name:string;
  price:number;
  changePercent:number|null;
  relativeVolume:number|null;
  marketValue:number|null;
  peTtm:number|null;
  cueState:"BUY"|"WAIT"|"AVOID"|null;
  action:"ENTRY_READY"|"WATCH"|"WAIT";
  cueScore:number|null;
  fresh:boolean;
  latestBarTime:string|null;
  affordableShares:number|null;
  budgetFit:boolean|null;
  plan:{
    entryLow:number;
    entryHigh:number;
    stop:number;
    target1:number;
    target2:number;
    target3:number;
  }|null;
  flags:string[];
  sourceTags:string[];
  whyNow:string[];
  timeframeScores:{
    fiveMin:number|null;
    fifteenMin:number|null;
    oneHour:number|null;
    bullishFrames:number;
  };
  marketChangePercent:number|null;
};

export type OutputType = {
  mode:"auto"|"active"|"momentum"|"buy_low";
  source:"webull-paper";
  universeCount:number;
  evaluatedCount:number;
  generatedAt:Date;
  rows:HunterRow[];
  marketContext:{symbol:"QQQ";changePercent:number|null};
  note:string;
};

export async function getHunterScan(params:z.infer<typeof schema>):Promise<OutputType>{
  const search = new URLSearchParams();
  search.set("mode",params.mode);
  search.set("minScore",String(params.minScore));
  search.set("limit",String(params.limit));
  if(params.maxPrice)search.set("maxPrice",String(params.maxPrice));
  if(params.budget)search.set("budget",String(params.budget));
  const r=await fetch("/_api/hunter/scan?"+search.toString(),{credentials:"include"});
  return readApiResponse<OutputType>(r,"Cue Hunter scan failed");
}

