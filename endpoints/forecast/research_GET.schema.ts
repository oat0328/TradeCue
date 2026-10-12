import { z } from "zod";
import { readApiResponse } from "../../helpers/apiClient";
import type { OmegaForecastResearch } from "../../helpers/omegaForecastResearch";

export const forecastQuery=z.object({
  symbol:z.string().trim().toUpperCase().regex(/^[A-Z0-9.-]{1,15}$/),
  model:z.enum(["baseline","chronos2","kronos","nhits"]).default("baseline"),
});
export type ForecastResponse={
  symbol:string;generatedAt:string;source:string;
  baseline:OmegaForecastResearch;
  remote:{
    model:"chronos2"|"kronos"|"nhits";
    status:"READY"|"NOT_CONFIGURED"|"UNAVAILABLE"|"ERROR";
    source:string|null;
    points:Array<{horizonBars:number;median:number;lower:number|null;upper:number|null}>;
    message:string;
  }|null;
  executionAllowed:false;
};
export async function getOmegaForecastResearch(symbol:string,model:"baseline"|"chronos2"|"kronos"|"nhits"="baseline"):Promise<ForecastResponse>{
  const query=new URLSearchParams({symbol,model});
  const response=await fetch("/_api/forecast/research?"+query,{credentials:"include"});
  return readApiResponse<ForecastResponse>(response,"Unable to load Omega forecast research");
}
