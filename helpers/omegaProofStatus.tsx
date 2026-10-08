export type OmegaProof={
 reconciliation?:{state:"MATCHED"|"BLOCKED";checkedAt:string;cash:number|null;equity:number|null;buyingPower:number|null;positionCount:number;workingOrders:number;blockers:string[]}|null;
 opportunityComparison?:{openRisk:number|null;riskCap:number;remainingRisk:number;usableBuyingPower:number;qualified:number;feasible:number;selected:string|null;policy:string;alternatives:Array<{symbol:string;score:number;rewardRisk:number;plannedLoss:number;capital:number;quantity:number}>}|null;
 scanIntervalSeconds?:number;scanCapacity?:number;
 monthlyGoal?:ReturnType<typeof import("./omegaMonthlyObjective").omegaMonthlyObjective>|null;
 strategyVersion?:string;learningMode?:string;marketState?:string;healthScore?:number|null;criticalErrors?:number|null;
 brokerConnection?:string;scannerState?:string;scanError?:string|null;lastScanTimestamp?:string|null;
 candidateCount?:number|null;aSetupCount?:number|null;aPlusSetupCount?:number|null;openPositions?:number|null;
 dayPnl?:number|null;consecutiveLosses?:number|null;lossStop?:number;drawdownPercent?:number|null;drawdownCapPercent?:number;
 maxDailyLoss?:number|null;decision?:string;positions?:unknown[];healthBlockers?:string[];protectionAlerts?:Array<{symbol:string;reason:string}>;qualifiedSetupCount?:number|null;
 dailyTrainingTarget?:number;dailyTargetRemaining?:number|null;dailyTargetProgress?:number|null;dailyTargetReached?:boolean;
 dailyTargetMode?:"BUILD_TO_GOAL"|"PROTECT_AND_EXTEND";curriculumVersion?:string;
 skipLearning?:{
  captured:number;evaluated:number;pending:number;evaluatedTotal:number;validated:number;missedCleanMoves:number;mixed:number;inconclusive:number;
  skipPrecision:number|null;policy:"SHADOW_ONLY";
 }|null;
 discoveredCandidates?:Array<{
  symbol:string;
  dataAgreement?:{state:"AGREED"|"BLOCKED";differencePercent:number|null;blockers:string[]};
  entryPlan?:{entryLow:number;entryHigh:number;stop:number;target:number}|null;
  action:"ENTRY_READY"|"WATCH"|"WAIT";
  setupGrade:"A+"|"A"|"B"|"NO_TRADE";
  setupScore12:number;
  confidence:number;
  fresh:boolean;
  executionAllowed:boolean;
  reason:string;
 }>;
};
export function omegaProofStatus(input:{enabled:boolean;paperExecutionEnabled:boolean;completedAt:string|null;status:string;mode:string|null;proof:OmegaProof|null},now=Date.now()){
 const time=input.completedAt?Date.parse(input.completedAt):NaN;
 const age=now-time;
 const fresh=input.enabled&&Number.isFinite(age)&&age>=0&&age<=180000&&input.status!=="ERROR";
 const assigned=input.enabled&&input.paperExecutionEnabled;
 return {online:fresh,assigned,decision:!fresh?"WAIT — WORKER OFFLINE":input.proof?.decision??"WAIT — awaiting worker decision",
   brokerConnection:fresh?input.proof?.brokerConnection??"UNCONFIRMED":"UNCONFIRMED",
   scannerState:!fresh?"OFFLINE":input.proof?.scannerState??"NOT_STARTED"};
}