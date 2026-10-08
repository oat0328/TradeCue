import { readApiResponse } from "../../helpers/apiClient";
export type OutputType={
  available:boolean;
  outlook:null|{
    sessionDate:string;
    outlookType:string;
    marketMode:string|null;
    bias:string|null;
    headline:string|null;
    summary:string|null;
    watchSymbols:string[];
    plan:Record<string,unknown>;
    updatedAt:string;
  };
};
export async function getLatestOutlook():Promise<OutputType>{
  const r=await fetch("/_api/outlook/latest",{credentials:"include"});
  return readApiResponse<OutputType>(r,"Unable to load CUE server outlook");
}