import { z } from "zod";
import superjson from "superjson";
import { readApiResponse } from "../../helpers/apiClient";

export const schema = z.object({
  accountId: z.string().min(1).max(100),
  symbol: z.string().trim().toUpperCase().regex(/^[A-Z0-9.-]{1,15}$/),
  side: z.enum(["BUY","SELL"]),
  orderType: z.enum(["MARKET","LIMIT"]),
  quantity: z.number().int().min(1).max(100000),
  limitPrice: z.number().positive().max(1000000).optional(),
  confirmPaper: z.literal(true),
}).superRefine((value,ctx)=>{
  if(value.orderType==="LIMIT" && !value.limitPrice) ctx.addIssue({code:"custom",message:"Limit price is required for a limit order.",path:["limitPrice"]});
});

export type OutputType = {
  submitted: true;
  clientOrderId: string;
  symbol: string;
  side: "BUY"|"SELL";
  orderType: "MARKET"|"LIMIT";
  quantity: number;
  status: string;
};

export async function postPaperOrder(body:z.infer<typeof schema>):Promise<OutputType>{
  const r=await fetch("/_api/webull/paper-order",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:superjson.stringify(schema.parse(body))});
  return readApiResponse<OutputType>(r,"Paper order failed");
}

