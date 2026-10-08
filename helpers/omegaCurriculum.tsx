export const OMEGA_CURRICULUM_VERSION="DIY-10";

export const OMEGA_TRADING_CURRICULUM=[
  {step:1,title:"Learn the fundamentals",rule:"Know order types, regular market hours, buying power, margin/leverage risk and spread/slippage before entering."},
  {step:2,title:"Pick your market",rule:"Omega's active training market is liquid U.S. stocks. Do not mix stocks, options, futures, forex and crypto into one untested system."},
  {step:3,title:"Use one defined strategy",rule:"Trade the tested TradeCUE long setup: structure + EMA20/VWAP location + pullback + completed confirmation + volume + protected risk."},
  {step:4,title:"Read the chart",rule:"Read trend, structure, candles, wicks, volume, EMA20 and VWAP together. A candle is context, not a standalone guarantee."},
  {step:5,title:"Backtest it properly",rule:"Review historical and skipped setups bar-by-bar. Record wins, losses, MAE, MFE, R and reasons instead of changing rules from anecdotes."},
  {step:6,title:"Paper trade it",rule:"Prove execution, order protection, entries, exits and journaling in PaperTrade before any live-capital promotion."},
  {step:7,title:"Control psychology",rule:"Automation must not chase, revenge trade, move stops wider or take profit early just because P/L creates pressure."},
  {step:8,title:"Protect the account",rule:"Never normalize blowing accounts. Kill switch, stop coverage, consecutive-loss stops and drawdown limits override the profit goal."},
  {step:9,title:"Risk management first",rule:"Position size comes from cash and stop distance. Track R multiples, daily loss, correlation and exposure before share-count goals."},
  {step:10,title:"Capital, feedback and consistency",rule:"Journal every trade, review decisions, measure expectancy and consistency, then scale capital only when the evidence supports it."},
] as const;

export function omegaCurriculumPolicy(){
  return {
    market:"LIQUID_US_STOCKS",
    execution:"PAPER_FIRST",
    objective:"CONSISTENT_RISK_ADJUSTED_EXECUTION",
    dailyBaseGoal:500,
    rule:"The $500 goal never overrides setup quality, stops, drawdown controls or broker protection.",
  } as const;
}