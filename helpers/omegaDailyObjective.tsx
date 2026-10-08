export const OMEGA_DAILY_TRAINING_OBJECTIVE=500;

export function omegaDailyObjective(dayPnl:number|null|undefined,target=OMEGA_DAILY_TRAINING_OBJECTIVE){
  const pnl=Number(dayPnl??0);
  const safePnl=Number.isFinite(pnl)?pnl:0;
  const safeTarget=Number.isFinite(target)&&target>0?target:OMEGA_DAILY_TRAINING_OBJECTIVE;
  const remaining=Math.max(0,safeTarget-safePnl);
  const progress=Math.max(0,Math.min(100,safePnl/safeTarget*100));
  const reached=safePnl>=safeTarget;
  return {
    target:safeTarget,pnl:safePnl,remaining,progress,reached,
    mode:reached?"PROTECT_AND_EXTEND" as const:"BUILD_TO_GOAL" as const,
  };
}