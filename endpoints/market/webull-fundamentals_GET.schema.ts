import { z } from "zod";
import { readApiResponse } from "../../helpers/apiClient";

export const schema=z.object({
  symbol:z.string().trim().toUpperCase().regex(/^[A-Z0-9.-]{1,15}$/),
});

export type OutputType={
  symbol:string;
  generatedAt:Date;
  source:"webull";
  profile:{
    companyName:string|null;
    sector:string|null;
    industries:string[];
    ceo:string|null;
    employees:string|null;
    description:string|null;
  }|null;
  analyst:{
    total:number;
    strongBuy:number;
    buy:number;
    hold:number;
    underPerform:number;
    sell:number;
    effectiveDate:string|null;
  }|null;
  target:{
    mean:number|null;
    median:number|null;
    high:number|null;
    low:number|null;
    currency:string|null;
    effectiveDate:string|null;
  }|null;
  eps:Array<{fiscalYear:number|null;fiscalPeriod:number|null;actual:number|null;estimate:number|null;reported:boolean}>;
  earnings:Array<{fiscalYear:number|null;fiscalPeriod:number|null;date:string|null;epsActual:number|null;epsEstimate:number|null;revenueActual:number|null;revenueEstimate:number|null}>;
  filings:Array<{title:string;url:string|null;publishDate:string|null}>;
  capitalFlow:{date:string|null;largeNet:number|null;mediumNet:number|null;smallNet:number|null}|null;
  nextEarnings:{startDate:string|null;endDate:string|null;fiscalYear:number|null;fiscalPeriod:number|null;epsEstimate:number|null;revenueEstimate:number|null}|null;
  indicators:{netMargin:number|null;roe:number|null;roa:number|null;debtToAssets:number|null;operatingCashFlowPerShare:number|null}|null;
  score:number|null;
  bias:"POSITIVE"|"MIXED"|"WEAK"|"UNAVAILABLE";
  reasons:string[];
};

export async function getWebullFundamentals(symbol:string):Promise<OutputType>{
  const r=await fetch("/_api/market/webull-fundamentals?"+new URLSearchParams({symbol}),{credentials:"include"});
  return readApiResponse<OutputType>(r,"Unable to load Webull fundamentals");
}
