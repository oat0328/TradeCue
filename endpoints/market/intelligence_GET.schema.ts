import { z } from "zod";
import { readApiResponse } from "../../helpers/apiClient";

export const schema=z.object({symbol:z.string().trim().toUpperCase().regex(/^[A-Z0-9.-]{1,15}$/)});
export type FrameRead={label:string;state:"BUY"|"WAIT"|"AVOID"|null;score:number|null;fresh:boolean;lastBarTime:string|null};
export type OutputType={
  symbol:string;
  generatedAt:Date;
  compositeScore:number|null;
  alignment:string;
  bullishFrames:number;
  availableFrames:number;
  marketChangePercent:number|null;
  action:"ENTRY_READY"|"WAIT"|"AVOID";
  frames:FrameRead[];
  reasons:string[];
};
export async function getMarketIntelligence(symbol:string):Promise<OutputType>{
  const r=await fetch("/_api/market/intelligence?"+new URLSearchParams({symbol}),{credentials:"include"});
  return readApiResponse<OutputType>(r,"Unable to load TradeCUE intelligence");
}
