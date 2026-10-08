import { readApiResponse } from "../../helpers/apiClient";
export type LearningProfile={
  setup:string;
  tradeCount:number;
  wins:number;
  losses:number;
  winRate:number|null;
  avgR:number|null;
  expectancy:number|null;
  profitFactor:number|null;
  avgWinnerR:number|null;
  avgLoserR:number|null;
  maxLosingStreak:number;
  confidence:string;
  updatedAt:string;
};
export type RecentTrade={
  id:string;
  symbol:string;
  setup:string|null;
  entryPrice:number|null;
  exitPrice:number|null;
  quantity:number|null;
  realizedPnl:number|null;
  realizedR:number|null;
  outcome:string|null;
  entryTime:string|null;
  exitTime:string|null;
};
export type PerformanceRead={
  sharpeRatio:number|null;
  maxDrawdownR:number;
  longestWinStreak:number;
  longestLossStreak:number;
  bestSymbol:{key:string;count:number;avgR:number}|null;
  worstSymbol:{key:string;count:number;avgR:number}|null;
  bestSetup:{key:string;count:number;avgR:number}|null;
  worstSetup:{key:string;count:number;avgR:number}|null;
  bestTime:{key:string;count:number;avgR:number}|null;
  worstTime:{key:string;count:number;avgR:number}|null;
  ruleCompliance:number|null;
  successCriteria:{
    profitFactorMet:boolean;
    winRateMet:boolean;
    ruleComplianceMet:boolean;
    maxDrawdownUnder10R:boolean;
    sampleSizeMet:boolean;
  };
};
export type OutputType={
  overall:LearningProfile|null;
  setups:LearningProfile[];
  performance:PerformanceRead;
  learningReview:{
    completedMilestone:number|null;
    nextMilestone:number;
    recommendations:string[];
    autoChangesApplied:false;
  };
  recentTrades:RecentTrade[];
  sampleWarning:string|null;
};
export async function getLearningSummary():Promise<OutputType>{
  const r=await fetch("/_api/learning/summary",{credentials:"include"});
  return readApiResponse<OutputType>(r,"Unable to load CUE learning summary");
}