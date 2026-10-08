import { z } from "zod";
import { readApiResponse } from "../../helpers/apiClient";
import type { WebullBar } from "../../helpers/webullBars";
export const schema=z.object({
  symbol:z.string().trim().regex(/^[A-Za-z0-9.-]{1,20}$/).transform(v=>{
    const match=/^([A-Za-z0-9.-]+)main$/i.exec(v);
    return match?match[1].toUpperCase()+"main":v.toUpperCase();
  }),
  timespan:z.enum(["M1","M5","M15","M30","M60","M240"]).default("M5"),
});
export type OutputType={
  symbol:string;timespan:string;bars:WebullBar[];latest:number|null;
  cue:{state:"BUY"|"WAIT"|"AVOID"|null;score:number|null;plan:any|null};
  structure:{trend:"BULLISH"|"BEARISH"|"RANGE";pattern:string;summary:string};
  note:string;
};
export async function getFuturesBrief(input:z.infer<typeof schema>):Promise<OutputType>{
  const params=new URLSearchParams({symbol:input.symbol,timespan:input.timespan});
  const r=await fetch("/_api/futures/brief?"+params.toString(),{credentials:"include"});
  return readApiResponse<OutputType>(r,"Unable to load Cue Futures");
}