import { readApiResponse } from "../../helpers/apiClient";
export type OutputType={
  automation:{brainEnabled:boolean;autoPaperEnabled:boolean;killSwitch:boolean;updatedAt:string}|null;
  latestOutlook:{type:string;bias:string|null;updatedAt:string}|null;
  services:Array<{service:string;status:string;latencyMs:number|null;message:string|null;checkedAt:string}>;
};
export async function getReliabilityStatus():Promise<OutputType>{
  const r=await fetch("/_api/reliability/status",{credentials:"include"});
  return readApiResponse<OutputType>(r,"Unable to load reliability center");
}