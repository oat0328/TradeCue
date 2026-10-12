export type TargetMode="standard"|"crawl";
export type PlanLike={entryHigh:number;stop:number;target1:number;target2:number;target3:number};
export type TargetStep={key:"TP1"|"TP2"|"TP3"|"TP4";label:string;price:number;r:number;kind:"quick"|"core"|"extended"};

function round(value:number,decimals=2){
  const p=10**decimals;
  return Math.round(value*p)/p;
}

export function tradeTargetLadder(plan:PlanLike|null|undefined,mode:TargetMode):TargetStep[]{
  if(!plan)return [];
  const risk=plan.entryHigh-plan.stop;
  if(!Number.isFinite(risk)||risk<=0)return [];
  if(mode==="crawl"){
    return [
      {key:"TP1",label:"Quick · 0.5R",price:round(plan.entryHigh+risk*.5),r:.5,kind:"quick"},
      {key:"TP2",label:"Core · 1R",price:round(plan.target1),r:1,kind:"core"},
      {key:"TP3",label:"Runner · 2R",price:round(plan.target2),r:2,kind:"core"},
      {key:"TP4",label:"Extended · 3R",price:round(plan.target3),r:3,kind:"extended"},
    ];
  }
  return [
    {key:"TP1",label:"TP1 · 1R",price:round(plan.target1),r:1,kind:"core"},
    {key:"TP2",label:"TP2 · 2R",price:round(plan.target2),r:2,kind:"core"},
    {key:"TP3",label:"TP3 · 3R",price:round(plan.target3),r:3,kind:"extended"},
  ];
}

export function crossedTarget(previous:number|null|undefined,current:number|null|undefined,target:number){
  return previous!=null&&current!=null&&Number.isFinite(previous)&&Number.isFinite(current)&&previous<target&&current>=target;
}

export function crossedStop(previous:number|null|undefined,current:number|null|undefined,stop:number){
  return previous!=null&&current!=null&&Number.isFinite(previous)&&Number.isFinite(current)&&previous>stop&&current<=stop;
}

