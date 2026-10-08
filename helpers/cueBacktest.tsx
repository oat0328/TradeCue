import type { Candle } from "./chartMath";
import { calculateCueSignal } from "./cueSignal";

export type BacktestTrade={
  entryIndex:number;exitIndex:number|null;entry:number;stop:number;target:number;
  outcome:"WIN"|"LOSS"|"OPEN";r:number;
};
export type BacktestResult={
  trades:BacktestTrade[];resolved:number;wins:number;losses:number;open:number;
  winRate:number|null;averageR:number|null;expectancy:number|null;profitFactor:number|null;maxLosingStreak:number;
  sampleWarning:string|null;
};

export function backtestCueLong(bars:Candle[],lookahead=20):BacktestResult{
  const rows=bars.filter(bar=>Boolean(bar.time)&&[bar.open,bar.high,bar.low,bar.close].every(Number.isFinite)).map(bar=>({
    time:bar.time as string,open:bar.open,high:bar.high,low:bar.low,close:bar.close,volume:Number(bar.volume||0),
  }));
  const trades:BacktestTrade[]=[];
  let i=45;
  while(i<rows.length-2){
    const signal=calculateCueSignal(rows.slice(0,i+1));
    if(!signal.available||signal.state!=="BUY"||!signal.plan){i++;continue;}
    const entry=signal.plan.entryHigh,stop=signal.plan.stop,target=signal.plan.target2;
    const risk=entry-stop;
    if(!(risk>0&&target>entry)){i++;continue;}
    let outcome:"WIN"|"LOSS"|"OPEN"="OPEN",exitIndex:number|null=null,r=0;
    const end=Math.min(rows.length-1,i+lookahead);
    for(let j=i+1;j<=end;j++){
      const bar=rows[j];
      const hitStop=bar.low<=stop;
      const hitTarget=bar.high>=target;
      if(hitStop&&hitTarget){outcome="LOSS";exitIndex=j;r=-1;break;} // conservative same-bar assumption
      if(hitStop){outcome="LOSS";exitIndex=j;r=-1;break;}
      if(hitTarget){outcome="WIN";exitIndex=j;r=(target-entry)/risk;break;}
    }
    trades.push({entryIndex:i,exitIndex,entry,stop,target,outcome,r});
    i=(exitIndex??end)+1;
  }
  const resolvedTrades=trades.filter(t=>t.outcome!=="OPEN");
  const wins=resolvedTrades.filter(t=>t.outcome==="WIN").length;
  const losses=resolvedTrades.filter(t=>t.outcome==="LOSS").length;
  const resolved=resolvedTrades.length;
  const sumR=resolvedTrades.reduce((s,t)=>s+t.r,0);
  const grossWin=resolvedTrades.filter(t=>t.r>0).reduce((s,t)=>s+t.r,0);
  const grossLoss=Math.abs(resolvedTrades.filter(t=>t.r<0).reduce((s,t)=>s+t.r,0));
  let streak=0,maxLosingStreak=0;
  for(const t of resolvedTrades){if(t.outcome==="LOSS"){streak++;maxLosingStreak=Math.max(maxLosingStreak,streak);}else streak=0;}
  return {
    trades,resolved,wins,losses,open:trades.length-resolved,
    winRate:resolved?wins/resolved*100:null,
    averageR:resolved?sumR/resolved:null,
    expectancy:resolved?sumR/resolved:null,
    profitFactor:grossLoss>0?grossWin/grossLoss:grossWin>0?Infinity:null,
    maxLosingStreak,
    sampleWarning:resolved<30?"Small sample: collect at least 30 resolved trades before treating these metrics as evidence of an edge.":null,
  };
}