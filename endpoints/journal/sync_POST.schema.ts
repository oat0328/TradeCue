import {readApiResponse} from "../../helpers/apiClient";
export type OutputType={ok:true;syncedAt:string;cached:boolean;summary:Record<string,unknown>};
export async function syncPaperJournal():Promise<OutputType>{
 const response=await fetch("/_api/journal/sync",{method:"POST",credentials:"include"});
 return readApiResponse<OutputType>(response,"Account journal sync failed");
}
