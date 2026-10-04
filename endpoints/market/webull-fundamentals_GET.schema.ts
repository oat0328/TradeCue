import { z } from "zod";
import { readApiResponse } from "../../helpers/apiClient";

export const schema=z.object({
  symbol:z.string().trim().toUpperCase().regex(/^[A-Z0-9.-]{1,15}$/),
});

export type OutputType={
  symbol:string;
  generatedAt:Date;
  score:number|null;
  bias:"POSITIVE"|"NEUTRAL"|"WEAK";
  reasons:string[];
  profile:{companyName:string|null;sector:string|null;industry:string|null}|null;
  analyst:{strongBuy:number;buy:number;hold:number;sell:number;total:number}|null;
  target:{mean:number|null;high:number|null;low:number|null}|null;
  filings:Array<{title:string;publishDate:string|null}>;
  earnings:Array<{date:string|null;epsActual:number|null;epsEstimate:number|null;revenueActual:number|null;revenueEstimate:number|null}>;
  nextEarnings:{startDate:string|null;epsEstimate:number|null}|null;
  capitalFlow:{largeNet:number|null;date:string|null}|null;
  indicators:{netMargin:number|null;roe:number|null;debtToAssets:number|null;operatingCashFlowPerShare:number|null}|null;
};

export async function getWebullFundamentals(symbol:string):Promise<OutputType>{
  const r=await fetch("/_api/market/webull-fundamentals?"+new URLSearchParams({symbol}),{credentials:"include"});
  return readApiResponse<OutputType>(r,"Unable to load Webull fundamentals");
}
