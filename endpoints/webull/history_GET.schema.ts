import { z } from "zod";
import { readApiResponse } from "../../helpers/apiClient";
import type { WebullBar } from "../../helpers/webullBars";

export const schema=z.object({
  symbol:z.string().regex(/^[A-Z0-9.-]{1,15}$/),
  timeframe:z.enum(["1m","3m","5m","15m","30m","1H","4H","1D","1W"]),
  limit:z.coerce.number().int().min(160).max(1650).default(1200),
});
export type OutputType={
  symbol:string;timeframe:string;bars:WebullBar[];requested:number;loaded:number;
  source:"webull-paper";updatedAt:Date;providerLimit:number;note:string;
};
export async function getWebullHistory(symbol:string,timeframe:string,limit=1200):Promise<OutputType>{
  const r=await fetch("/_api/webull/history?"+new URLSearchParams({symbol,timeframe,limit:String(limit)}),{credentials:"include"});
  return readApiResponse<OutputType>(r,"Unable to load Webull chart history");
}
