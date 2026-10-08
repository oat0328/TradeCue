export function omegaHuntRanking(a:{action:string;cueScore:number|null;setupScore12:number;confidence:number},b:{action:string;cueScore:number|null;setupScore12:number;confidence:number}){
 const ready=(row:typeof a)=>row.action==="ENTRY_READY"?2:row.action==="WATCH"?1:0;
 return ready(b)-ready(a)||b.setupScore12-a.setupScore12||b.confidence-a.confidence||(b.cueScore??0)-(a.cueScore??0);
}