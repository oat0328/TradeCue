import type { CueSignal, CueSignalUnavailable } from "./cueSignal";

/**
 * Omega Genius is a read-only evidence and risk review for the existing US-stock chart.
 * It NEVER places trades and is not an authorization for paper or live execution.
 */
export type GeniusVerdict = "DATA_CHECK" | "RISK_VETO" | "WAIT" | "SETUP_CANDIDATE" | "MANAGE_POSITION";
export type GeniusFrame = {label:string;state:"BUY"|"WAIT"|"AVOID"|null;fresh:boolean;lastBarTime:string|null};
export type GeniusIntelligence = {
  action:"ENTRY_READY"|"WAIT"|"AVOID";
  generatedAt:Date|string;
  frames:GeniusFrame[];
};
export type GeniusInput = {
  signal:CueSignal|CueSignalUnavailable;
  currentPrice:number|null;
  latestBarTime:string|null;
  marketOpen:boolean;
  hasPosition:boolean;
  intelligence:GeniusIntelligence|null;
  macroState:"CLEAR"|"CAUTION"|"BLOCKED"|"OFFLINE"|null;
  accountEquity:number|null;
  buyingPower:number|null;
  maxRiskDollars:number|null;
  now?:Date;
};
export type GeniusReport = {
  verdict:GeniusVerdict;
  headline:string;
  explanation:string;
  qualityScore:number|null; // existing rule score, not a forecast or probability
  reasons:string[];
  nextTrigger:string;
  plan:{entryLow:number;entryHigh:number;stop:number;target:number;grossR:number;maxPaperShares:number|null;plannedRisk:number|null}|null;
};

function validPrice(value:number|null|undefined):value is number{return value!=null&&Number.isFinite(value)&&value>0;}
function timestamp(value:string|Date|null|undefined):number{
  return value==null?NaN:new Date(value).getTime();
}
function finitePositive(value:number|null|undefined):value is number{return validPrice(value);}
const report=(verdict:GeniusVerdict,headline:string,explanation:string,qualityScore:number|null,reasons:string[],nextTrigger:string,plan:GeniusReport["plan"]=null):GeniusReport=>({
  verdict,headline,explanation,qualityScore,reasons,nextTrigger,plan
});

/** Always chooses WAIT over fabricated certainty when evidence is unavailable or contradictory. */
export function reviewOmegaStockSetup(input:GeniusInput):GeniusReport {
  const signal=input.signal;
  const qualityScore=signal.available?signal.score:null;
  const now=input.now?.getTime()??Date.now();
  const last=timestamp(input.latestBarTime);
  const lastAge=now-last;
  if(!signal.available||!validPrice(input.currentPrice)){
    return report("DATA_CHECK","Missing chart evidence","Omega cannot evaluate this stock without valid Webull candles and a current price.",qualityScore,
      [signal.available?"Current price is invalid.":signal.reason],"Restore a usable quote and valid 5-minute chart.");
  }
  const p=signal.plan;
  // Do not replace actual broker stops/targets with newly recalculated indicator levels.
  if(input.hasPosition){
    return report("MANAGE_POSITION","Protect existing position","A position exists. Review its ACTUAL broker stop, fill quantity and risk before making any change.",qualityScore,
      ["Chart-derived stops are not broker-attached protective orders.","Use Position Sentinel to reconcile positions, active orders and exits."],
      "Manage using recorded order levels and confirmed broker fills; never widen a stop based on a new signal.");
  }
  if(!input.marketOpen){
    return report("WAIT","Regular session closed","The 5-minute US-stock entry strategy is paused outside regular US equity trading hours.",qualityScore,
      ["Premarket, overnight and after-hours prints require a separately tested strategy."],"Re-evaluate when the regular stock session opens.");
  }
  if(!Number.isFinite(last)||lastAge< -60_000||lastAge>20*60_000){
    return report("DATA_CHECK","Chart feed is stale","Omega refuses new entries without a valid recent 5-minute candle.",qualityScore,
      ["Last bar is absent, too old, or dated in the future."],"Refresh quotes and candles; confirm timestamp agreement.");
  }
  if(input.macroState==null||input.macroState==="OFFLINE"||input.macroState==="BLOCKED"){
    return report("RISK_VETO","Economic risk cannot be cleared","Omega cannot approve a fresh setup while event-risk protection is blocked or offline.",qualityScore,
      ["Macro guard: "+(input.macroState??"UNAVAILABLE")],"Wait until the macro guard reports CLEAR and reassess.");
  }
  if(input.macroState==="CAUTION"){
    return report("WAIT","High-impact event caution","Omega is withholding new entries during elevated scheduled-event risk.",qualityScore,
      ["Macro guard reports CAUTION."],"Wait for the event window to clear.");
  }
  const info=input.intelligence;
  const infoAge=info?now-timestamp(info.generatedAt):NaN;
  if(!info||!Number.isFinite(infoAge)||infoAge< -60_000||infoAge>3*60_000){
    return report("DATA_CHECK","Multi-timeframe evidence missing","Omega needs a fresh independent market-intelligence check.",qualityScore,
      ["5-minute data alone cannot establish 15-minute and 1-hour alignment."],"Refresh multi-timeframe intelligence.");
  }
  const byFrame=new Map(info.frames.map(frame=>[frame.label,frame]));
  const required=["5m","15m","1H"];
  const missing=required.filter(tf=>!byFrame.get(tf)||!byFrame.get(tf)!.fresh||byFrame.get(tf)!.state==null);
  if(missing.length){
    return report("DATA_CHECK","Timeframe agreement incomplete","Omega must see valid, fresh evidence on every required timeframe.",qualityScore,
      ["Missing/stale context: "+missing.join(", ")],"Refresh 5m, 15m and 1H frames.");
  }
  if(info.action==="AVOID"||signal.state==="AVOID"||required.some(tf=>byFrame.get(tf)!.state==="AVOID")){
    return report("RISK_VETO","Conflicting bearish evidence","One or more timeframes invalidates this long-only stock strategy.",qualityScore,
      ["At least one trade filter reports AVOID."],"Wait for a new bullish structure; no short position is opened.");
  }
  if(signal.state!=="BUY"||info.action!=="ENTRY_READY"||required.some(tf=>byFrame.get(tf)!.state!=="BUY")){
    return report("WAIT","Trend confirmation incomplete","A high score does not override a missing 5m, 15m or 1H bullish confirmation.",qualityScore,
      ["Signal and all three timeframes must agree on BUY."],"Wait for a completed pullback and renewed confirmation.");
  }
  if(!p||![p.entryLow,p.entryHigh,p.stop,p.target2].every(validPrice)||p.entryLow>p.entryHigh||
    p.stop>=p.entryLow||p.target2<=p.entryHigh){
    return report("RISK_VETO","No valid protective trade plan","Entry, stop or profit target is missing or structurally invalid.",qualityScore,
      ["Omega requires a logical stop below entry and target above entry."],"Wait for a valid fresh trade plan.");
  }
  if(input.currentPrice<p.entryLow){
    return report("WAIT","Below entry zone","Price has not reclaimed the planned entry zone.",qualityScore,
      ["Do not guess a reversal beneath the plan."],"Wait for a fresh candle confirming a reclaim.");
  }
  if(input.currentPrice>p.entryHigh){
    return report("WAIT","Do not chase price","Price has run beyond the planned entry zone.",qualityScore,
      ["Extended entry would change the original reward-to-risk calculation."],"Wait for a new pullback and recalculated stop/target.");
  }
  const shareRisk=p.entryHigh-p.stop;
  const grossR=(p.target2-p.entryHigh)/shareRisk;
  if(!Number.isFinite(grossR)||grossR<2){
    return report("RISK_VETO","Reward is not worth the stop","TP2 offers less than 2R before fees and slippage.",qualityScore,
      ["Gross reward-to-risk below the 2:1 minimum."],"Wait for more favorable structure; never move the stop simply to increase R.");
  }
  const equity=input.accountEquity,bp=input.buyingPower,limit=input.maxRiskDollars;
  if(!finitePositive(equity)||!finitePositive(bp)||!finitePositive(limit)){
    return report("DATA_CHECK","Portfolio risk budget missing","Omega will not suggest position sizing without verified equity, buying power and risk limits.",qualityScore,
      ["Cannot confirm that an additional position fits the account."],"Connect and reconcile broker balance and risk profile.");
  }
  const budget=Math.min(equity*.01,limit);
  const maxPaperShares=Math.max(0,Math.floor(Math.min(budget/shareRisk,bp/p.entryHigh)));
  if(maxPaperShares<1){
    return report("RISK_VETO","Position does not fit account","Even one share would violate the account risk cap or buying power.",qualityScore,
      ["Never override risk limits to meet a daily profit goal."],"Reduce risk by waiting for another setup or use an appropriate instrument.");
  }
  const plan={
    entryLow:p.entryLow,entryHigh:p.entryHigh,stop:p.stop,target:p.target2,grossR,
    maxPaperShares,plannedRisk:maxPaperShares*shareRisk,
  };
  return report("SETUP_CANDIDATE","Qualified paper setup","The independent evidence checks agree. This is a research candidate, NOT an executable order, a win probability or a guarantee.",qualityScore,
    ["5m, 15m and 1H confirm bullish signals.","Macro guard CLEAR; gross TP2 reward-to-risk meets 2R.","Fees, spread, slippage, order rules and final paper firewall still require validation."],
    "Check bid/ask spread, account permissions, order limits and fresh fills before paper execution.",plan);
}

/** Observational paper-journal feedback only; never live self-training or auto risk escalation. */
export function analyzeOmegaExperience(trades:ReadonlyArray<{strategy:string;assetClass:string;netR:number;mode:"paper"|"live"}>,strategy:string,assetClass:string){
  const rows=trades.filter(t=>t.mode==="paper"&&t.strategy===strategy&&t.assetClass===assetClass&&Number.isFinite(t.netR));
  const n=rows.length;
  const wins=rows.filter(t=>t.netR>0).length;
  const grossGain=rows.reduce((s,t)=>s+Math.max(0,t.netR),0);
  const grossLoss=rows.reduce((s,t)=>s+Math.max(0,-t.netR),0);
  const meanNetR=n?rows.reduce((s,t)=>s+t.netR,0)/n:null;
  const profitFactor=grossLoss>0?grossGain/grossLoss:null;
  let equityCurve=0,highWater=0,maxDrawdownR=0;
  for(const t of rows){equityCurve+=t.netR;highWater=Math.max(highWater,equityCurve);maxDrawdownR=Math.max(maxDrawdownR,highWater-equityCurve);}
  return {
    sampleSize:n,wins,losses:rows.filter(t=>t.netR<0).length,breakeven:rows.filter(t=>t.netR===0).length,
    meanNetR,profitFactor,maxDrawdownR,
    // Threshold is a data sufficiency reminder, NOT statistical proof of profitability.
    status:n<30?"INSUFFICIENT_SAMPLE" as const:"RESEARCH_READY" as const,
    note:n<30?"Collect at least 30 comparable completed paper trades.": "Review drawdowns, market regime, holdout/out-of-sample performance and costs before trusting this result.",
  };
}
