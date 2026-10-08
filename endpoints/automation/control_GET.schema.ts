import { readApiResponse } from "../../helpers/apiClient";
export type OutputType={
  brainEnabled:boolean;
  autoPaperEnabled:boolean;
  killSwitch:boolean;
  maxAutoPositions:number;
  perTradeBudget:number;
  updatedAt:string;
};
export async function getAutomationControl():Promise<OutputType>{
  const r=await fetch("/_api/automation/control",{credentials:"include"});
  return readApiResponse<OutputType>(r,"Unable to load CUE automation controls");
}