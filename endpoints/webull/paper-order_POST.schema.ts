import { z } from "zod";
import superjson from "superjson";
import { readApiResponse } from "../../helpers/apiClient";

export const schema = z.object({
  accountId: z.string().min(1).max(100),
  symbol: z.string().trim().toUpperCase().regex(/^[A-Z0-9.-]{1,15}$/),
  side: z.enum(["BUY","SELL"]),
  orderType: z.enum(["MARKET","LIMIT"]),
  quantity: z.number().positive().max(100000),
  limitPrice: z.number().positive().max(1000000).optional(),
  confirmPaper: z.literal(true),
  // Audit H-01: one id per order attempt. Retrying with the same id never places a second order.
  intentId: z.string().regex(/^[A-Za-z0-9_-]{8,80}$/,"A valid order attempt id is required."),
  // Automated protective exits are tracked by the exit guard; retries must name the rejected attempt.
  purpose: z.enum(["manual","auto-entry","auto-exit","auto-cleanup"]).default("manual"),
  retryOfIntentId: z.string().regex(/^[A-Za-z0-9_-]{8,80}$/).optional(),
}).superRefine((value,ctx)=>{
  if(value.orderType==="LIMIT" && !value.limitPrice) ctx.addIssue({code:"custom",message:"Limit price is required for a limit order.",path:["limitPrice"]});
  if(value.retryOfIntentId && !(value.side==="SELL"&&value.purpose==="auto-exit")) ctx.addIssue({code:"custom",message:"Only automated exits can be retried.",path:["retryOfIntentId"]});
  if(value.side==="BUY"&&!Number.isInteger(value.quantity)) ctx.addIssue({code:"custom",message:"BUY quantity must be a whole number of shares.",path:["quantity"]});
  if(value.side==="SELL"&&Math.round(value.quantity*1e6)/1e6!==value.quantity) ctx.addIssue({code:"custom",message:"SELL quantity supports up to 6 decimal places.",path:["quantity"]});
});

export type OutputType = {
  submitted: true;
  duplicate: boolean;
  intentId: string;
  clientOrderId: string;
  symbol: string;
  side: "BUY"|"SELL";
  orderType: "MARKET"|"LIMIT";
  quantity: number;
  status: string;
};

export async function postPaperOrder(body:z.input<typeof schema>):Promise<OutputType>{
  const r=await fetch("/_api/webull/paper-order",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:superjson.stringify(schema.parse(body))});
  return readApiResponse<OutputType>(r,"Paper order failed");
}
