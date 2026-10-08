export function workerStatus(input:{enabled:boolean;paperExecutionEnabled:boolean;completedAt:Date|string|null;status:string|null;mode:string|null},now=Date.now()){
 const time=input.completedAt==null?NaN:new Date(input.completedAt).getTime();
 const age=now-time;
 const fresh=input.enabled&&Number.isFinite(age)&&age>=0&&age<=180000&&input.status!=="ERROR";
 const serverExecutionAssigned=input.enabled&&input.paperExecutionEnabled;
 const executionMode=fresh?(serverExecutionAssigned&&input.mode==="PAPER"?"SERVER_PAPER":"SERVER_OBSERVE"):"WORKER_OFFLINE";
 return {fresh,serverExecutionAssigned,executionMode};
}
    9