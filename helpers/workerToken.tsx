import { createHash,randomBytes } from "node:crypto";
export const workerTokenHash=(token:string)=>createHash("sha256").update(token).digest("hex");
export const newWorkerToken=()=>randomBytes(32).toString("hex");
export const validWorkerToken=(token:string)=>/^[a-f0-9]{64}$/.test(token);
