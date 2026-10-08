import {z}from "zod";
import {readApiResponse}from "../../helpers/apiClient";
export const schema=z.object({accountId:z.string().max(100).optional()});
export type OutputType={connected:true;environment:"live";accounts:{accountId:string;accountMask:string;accountType:string}[];selectedAccountId:string;updatedAt:Date;balance:{cash:string|null;equity:string|null;dayPnl:string|null;buyingPower:string|null;currency:string};positions:{symbol:string;quantity:string|null;marketValue:string|null;unrealizedPnl:string|null;costPrice:string|null}[]};
export async function getWebullLiveAccount(accountId?:string):Promise<OutputType>{
 const r=await fetch("/_api/webull/live-account"+(accountId?"?accountId="+encodeURIComponent(accountId):""),{credentials:"include"});
 return readApiResponse<OutputType>(r,"Unable to load Webull Live account");
}
