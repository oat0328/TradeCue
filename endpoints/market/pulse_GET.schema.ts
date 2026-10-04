import { z } from "zod";
import { readApiResponse } from "../../helpers/apiClient";

export const schema=z.object({});
export type PulseRow={
  symbol:string;
  name:string;
  price:number|null;
  changePercent:number|null;
  relativeVolume:number|null;
  volume:number|null;
};
export type BenchmarkRow={
  symbol:string;
  price:number|null;
  changePercent:number|null;
};
export type OutputType={
  generatedAt:Date;
  source:"webull-paper";
  benchmarks:BenchmarkRow[];
  gainers:PulseRow[];
  losers:PulseRow[];
  active:PulseRow[];
  breadth:{advancers:number;decliners:number;flat:number};
};

export async function getMarketPulse():Promise<OutputType>{
  const r=await fetch("/_api/market/pulse",{credentials:"include"});
  return readApiResponse<OutputType>(r,"Unable to load Webull market pulse");
}

