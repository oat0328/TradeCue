import { z } from "zod";
import { readApiResponse } from "../../helpers/apiClient";

export const schema=z.object({});
export type WatchItem={
  id:string;
  symbol:string;
  assetType:string;
  sortOrder:number;
  alertEnabled:boolean;
  price:number|null;
  change:number|null;
  changePercent:number|null;
};
export type OutputType={
  items:WatchItem[];
  quoteStatus:"connected"|"unavailable";
  quoteMessage:string|null;
};
export async function getWatchlist():Promise<OutputType>{
  const r=await fetch("/_api/watchlist/index",{credentials:"include"});
  return readApiResponse<OutputType>(r,"Unable to load watchlist");
}
