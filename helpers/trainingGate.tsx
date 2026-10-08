export type TrainingGate={
  phase:"CALIBRATING"|"TIGHTENED"|"PROVING"|"VERIFIED";
  minCueScore:number;
  maxAutoPositions:number;
  explanation:string;
};

export function cueTrainingGate(input:{
  tradeCount:number;
  expectancy:number|null;
  profitFactor:number|null;
  maxLosingStreak:number;
}):TrainingGate{
  const {tradeCount,expectancy,profitFactor,maxLosingStreak}=input;
  if(tradeCount<30){
    return {
      phase:"CALIBRATING",
      minCueScore:70,
      maxAutoPositions:2,
      explanation:"Paper-only Prop Training lane: collect 30 resolved trades with protected stops/targets before judging the strict gate. Rules do not self-change.",
    };
  }
  if((expectancy??-1)<=0||(profitFactor??0)<1||maxLosingStreak>=5){
    return {
      phase:"TIGHTENED",
      minCueScore:82,
      maxAutoPositions:2,
      explanation:"Evidence is weak. Omega flags the problem for review but does not automatically rewrite the trading rules or increase risk.",
    };
  }
  if((expectancy??0)<0.2||(profitFactor??0)<1.25){
    return {
      phase:"PROVING",
      minCueScore:82,
      maxAutoPositions:2,
      explanation:"Evidence is improving. Omega keeps the same conservative gate and records recommendations instead of changing the recipe.",
    };
  }
  return {
    phase:"VERIFIED",
    minCueScore:82,
    maxAutoPositions:2,
    explanation:"The sample is positive, but Omega still keeps the approved rules. Any future rule or risk change requires an explicit human decision.",
  };
}