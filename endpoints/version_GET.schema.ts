import { readApiResponse } from "../helpers/apiClient";
export type OutputType={buildId:string;generatedAt:string};
export async function getBuildVersion():Promise<OutputType>{
  const r=await fetch("/_api/version",{cache:"no-store"});
  return readApiResponse<OutputType>(r,"Unable to check TradeCUE build");
}