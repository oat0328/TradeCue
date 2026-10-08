import { readApiResponse } from "../../helpers/apiClient";

export type JournalDecision={
  id:string;symbol:string;action:string;createdAt:string;
  details:Record<string,unknown>;
};
export type JournalOrder={
  id:string;symbol:string;side:string;orderType:string;quantity:number|null;limitPrice:number|null;status:string;createdAt:string;
};
export type JournalTrade={
  id:string;symbol:string;status:string;setup:string;quantity:number|null;
  entryPrice:number|null;entryTime:string;exitPrice:number|null;exitTime:string|null;realizedPnl:number|null;
  stopPrice:number|null;target1:number|null;target2:number|null;target3:number|null;
};
export type OutputType={trades:JournalTrade[];decisions:JournalDecision[];orders:JournalOrder[];summary:{decisionCount:number;paperOrderCount:number}};
export async function getJournalActivity():Promise<OutputType>{
  const r=await fetch("/_api/journal/activity",{credentials:"include"});
  return readApiResponse<OutputType>(r,"Unable to load Cue Journal");
}