import { z } from "zod";
import superjson from "superjson";
import { readApiResponse } from "../../helpers/apiClient";
export const schema=z.discriminatedUnion("action",[
  z.object({action:z.literal("save"),subscription:z.record(z.any())}),
  z.object({action:z.literal("delete"),identity:z.string().min(1)}),
  z.object({action:z.literal("clear")}),
]);
export async function updatePushSubscription(input:z.infer<typeof schema>){
  const r=await fetch("/_api/push/subscription",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:superjson.stringify(schema.parse(input))});
  return readApiResponse<{ok:true}>(r,"Unable to update push subscription");
}