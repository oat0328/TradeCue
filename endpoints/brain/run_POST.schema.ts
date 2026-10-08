import { readApiResponse } from "../../helpers/apiClient";
export type OutputType={ok:true;bias:string;headline:string;watch:string[];marketMode:string};
export async function runCueBrain():Promise<OutputType>{
  const r=await fetch("/_api/brain/run",{method:"POST",credentials:"include"});
  return readApiResponse<OutputType>(r,"Unable to refresh CUE server outlook");
}