import {z}from "zod";
import superjson from "superjson";
import {readApiResponse}from "../../helpers/apiClient";
export const schema=z.object({
 accountId:z.string().min(1).max(100),
 symbol:z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9.\-]{0,9}$/),
 side:z.enum(["BUY","SELL"]),
 orderType:z.enum(["MARKET","LIMIT"]),
 quantity:z.number().positive().max(100000),
 limitPrice:z.number().positive().optional(),
 action:z.enum(["preview","place"]),
 confirmationText:z.string().optional(),
}).superRefine((value,ctx)=>{
 if(value.orderType==="LIMIT"&&!value.limitPrice)ctx.addIssue({code:"custom",message:"Limit price is required.",path:["limitPrice"]});
 if(value.action==="place"&&value.confirmationText!=="LIVE")ctx.addIssue({code:"custom",message:'Type LIVE to place a real-money order.',path:["confirmationText"]});
});
export type InputType=z.infer<typeof schema>;
export type OutputType={mode:"LIVE";action:"preview"|"placed";clientOrderId:string;response:unknown};
export async function postWebullLiveOrder(body:InputType):Promise<OutputType>{
 const r=await fetch("/_api/webull/live-order",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:superjson.stringify(schema.parse(body))});
 return readApiResponse<OutputType>(r,"Unable to process Webull Live order");
}
