import { z } from "zod";
import superjson from "superjson";
import { readApiResponse } from "../../helpers/apiClient";

export const schema=z.object({
  symbol:z.string().regex(/^[A-Z0-9.-]{1,15}$/),
  timeframe:z.string().max(8),
  action:z.enum(["BUY","WAIT","HOLD","SELL","AVOID"]),
  score:z.number().min(0).max(100),
  price:z.number().positive().nullable(),
  structure:z.string().max(80),
  plan:z.object({entryLow:z.number(),entryHigh:z.number(),stop:z.number(),target1:z.number(),target2:z.number(),target3:z.number()}).nullable(),
});
export type InputType=z.infer<typeof schema>;
export async function logCueDecision(input:InputType){
  const r=await fetch("/_api/journal/decision",{
    method:"POST",credentials:"include",
    headers:{"Content-Type":"application/json"},
    body:superjson.stringify(schema.parse(input)),
  });
  return readApiResponse<{ok:true;logged:boolean}>(r,"Unable to log Cue decision");
}
