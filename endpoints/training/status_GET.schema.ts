import { readApiResponse } from "../../helpers/apiClient";
export type OutputType={
  mode:"PAPER_TRAINING";
  capitalProfile:number;
  phase:"CALIBRATING"|"TIGHTENED"|"PROVING"|"VERIFIED";
  minCueScore:number;
  maxAutoPositions:number;
  tradeCount:number;
  expectancy:number|null;
  profitFactor:number|null;
  winRate:number|null;
  explanation:string;
};
export async function getTrainingStatus():Promise<OutputType>{
  const r=await fetch("/_api/training/status",{credentials:"include"});
  return readApiResponse<OutputType>(r,"Unable to load CUE training status");
}