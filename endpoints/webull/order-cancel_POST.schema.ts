import { z } from "zod";
import superjson from "superjson";
import { readApiResponse } from "../../helpers/apiClient";

export const schema=z.object({
  accountId:z.string().min(1).max(100),
  clientOrderId:z.string().min(1).max(80),
  confirmCancel:z.literal(true),
});
export type OutputType={cancelled:true;clientOrderId:string};
export async function postCancelPaperOrder(body:z.infer<typeof schema>):Promise<OutputType>{
  const r=await fetch("/_api/webull/order-cancel",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:superjson.stringify(schema.parse(body))});
  return readApiResponse<OutputType>(r,"Unable to cancel order");
}
