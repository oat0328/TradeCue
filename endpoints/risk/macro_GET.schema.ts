import { readApiResponse } from "../../helpers/apiClient";
export type MacroEvent={date:string;event:string;impact:string;currency:string;minutesFromNow:number};
export type OutputType={
  state:"CLEAR"|"CAUTION"|"BLOCKED"|"OFFLINE";
  connected:boolean;
  nearest:MacroEvent|null;
  events:MacroEvent[];
  message:string;
  blockedWindowMinutes:number;
};
export async function getMacroRisk():Promise<OutputType>{
  const r=await fetch("/_api/risk/macro",{credentials:"include"});
  return readApiResponse<OutputType>(r,"Unable to load macro risk guard");
}