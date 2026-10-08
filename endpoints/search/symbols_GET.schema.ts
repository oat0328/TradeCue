import { z } from "zod";
import { readApiResponse } from "../../helpers/apiClient";

export const schema=z.object({q:z.string().trim().min(1).max(80)});
export type SymbolSearchItem={symbol:string;name:string;exchange:string|null;currency:string|null;source:"fmp"|"webull"};
export type OutputType={items:SymbolSearchItem[];source:"fmp"|"webull";note:string};
export async function searchSymbols(q:string):Promise<OutputType>{
  const r=await fetch("/_api/search/symbols?q="+encodeURIComponent(q),{credentials:"include"});
  return readApiResponse<OutputType>(r,"Symbol search failed");
}