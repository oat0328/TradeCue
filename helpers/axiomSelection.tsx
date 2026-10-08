export function discoveryPriority(row:{changePercent:number|null;relativeVolume:number|null}){
 const move=Math.abs(row.changePercent??0);
 const volume=row.relativeVolume==null?0:Math.min(5,Math.max(0,row.relativeVolume));
 return Math.min(move,6)*2+volume*3;
}
export function axiomReadiness(input:{regularSession:boolean;fresh:boolean;dollarVolume:number|null;technicalReady:boolean;watchable:boolean}):"ENTRY_READY"|"WATCH"|"WAIT"{
 if(!input.fresh||input.dollarVolume==null||!Number.isFinite(input.dollarVolume)||input.dollarVolume<1_000_000)return "WAIT";
 if(input.regularSession&&input.technicalReady)return "ENTRY_READY";
 return input.watchable?"WATCH":"WAIT";
}
