import { z } from "zod";
import superjson from "superjson";
import { readApiResponse } from "../../helpers/apiClient";
export const schema=z.object({
  brainEnabled:z.boolean().optional(),
  autoPaperEnabled:z.boolean().optional(),
  killSwitch:z.boolean().optional(),
  maxAutoPositions:z.number().int().min(1).max(20).optional(),
  perTradeBudget:z.number().min(1).max(1_000_000).optional(),
});
export async function updateAutomationControl(input:z.infer<typeof schema>){
  const r=await fetch("/_api/automation/control",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:superjson.stringify(schema.parse(input))});
  return readApiResponse<{ok:true}>(r,"Unable to update CUE automation controls");
}