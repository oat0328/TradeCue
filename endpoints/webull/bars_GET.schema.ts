import {z}from "zod";
import {readApiResponse}from "../../helpers/apiClient";
import type {WebullBar}from "../../helpers/webullBars";

export const schema=z.object({
  symbol:z.string().regex(/^[A-Z0-9.-]{1,15}$/),
  timeframe:z.enum(["1m","3m","5m","15m","30m","1H","4H","1D","1W"]),
});

export type OutputType={
  bars:WebullBar[];
  symbol:string;
  timeframe:string;
  source:"webull-paper";
  delayMinutes:number|null;
  updatedAt:Date;
};

export async function getWebullBars(symbol:string,timeframe:string):Promise<OutputType>{
  const r=await fetch("/_api/webull/bars?"+new URLSearchParams({symbol,timeframe}),{credentials:"include"});
  return readApiResponse<OutputType>(r,"Unable to load Webull chart data");
}
