import {z} from "zod";
import {readApiResponse} from "../../helpers/apiClient";
export const schema=z.object({accountId:z.string().min(1).max(200),symbol:z.string().regex(/^[A-Z0-9.-]{1,15}$/),from:z.string().datetime(),to:z.string().datetime()}).refine(value=>Date.parse(value.to)>Date.parse(value.from),"Chart end must follow start.");
export type ChartTrade={id:string;symbol:string;accountId:string;status:"open"|"closed";entryTime:string;entryPrice:number;quantity:number|null;exits:Array<{id:string;time:string;price:number;quantity:number}>};
export type OutputType={trades:ChartTrade[];truncated:boolean;generatedAt:string};
export async function getChartTrades(input:z.infer<typeof schema>):Promise<OutputType>{
 const response=await fetch("/_api/journal/chart-trades?"+new URLSearchParams(input).toString(),{credentials:"include"});
 return readApiResponse<OutputType>(response,"Filled chart trades unavailable");
}