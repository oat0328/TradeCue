import type {OmegaProof} from "../../helpers/omegaProofStatus";
import {readApiResponse} from "../../helpers/apiClient";
export type OutputType={fresh:boolean;serverExecutionAssigned:boolean;executionMode:string;status:string;message:string;completedAt:string|null;enabled:boolean;paperExecutionEnabled:boolean;mode:string|null;proof:OmegaProof|null};
export async function getWorkerStatus():Promise<OutputType>{
 const r=await fetch("/_api/bot/worker-status",{credentials:"include"});
 return readApiResponse<OutputType>(r,"Background runner status unavailable");
}
