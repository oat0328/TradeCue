import { z } from "zod";
import superjson from "superjson";
import { readApiResponse } from "../../helpers/apiClient";
export const schema=z.object({accountId:z.string().max(100).optional()});
export async function killAutomation(input:z.infer<typeof schema>={}){
  const r=await fetch("/_api/automation/kill",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:superjson.stringify(schema.parse(input))});
  return readApiResponse<{ok:true;cancelRequested:number;cancelFailed:number}>(r,"Unable to stop CUE automation");
}