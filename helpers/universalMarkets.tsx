/**
 * TradeCUE Universal: market catalog and fail-closed capability checks.
 * This is NOT a broker integration and must not be used as an execution endpoint.
 * Existing stock PaperTrade execution is unaffected.
 */
export type AssetClass = "equity" | "etf" | "option" | "future" | "forex" | "crypto" | "bond";
export type MarketCategory = "stocks" | "crypto" | "forex" | "metals" | "options" | "futures" | "bonds";
export type TradingMode = "research" | "paper" | "live";

export type MarketDefinition = {
  id: MarketCategory;
  label: string;
  assetClasses: readonly AssetClass[];
  examples: readonly string[];
  hours: "exchange_hours" | "24x5" | "24x7" | "contract_calendar";
  riskSizing: "shares" | "premium_multiplier" | "pips_lots" | "contract_ticks" | "units" | "face_value";
  note?: string;
};

export const UNIVERSAL_MARKETS: readonly MarketDefinition[] = [
  { id:"stocks", label:"Stocks & ETFs", assetClasses:["equity","etf"], examples:["SPY","QQQ","TSLA","NVDA"], hours:"exchange_hours", riskSizing:"shares" },
  { id:"crypto", label:"Cryptocurrency", assetClasses:["crypto"], examples:["BTC/USD","ETH/USD","SOL/USD"], hours:"24x7", riskSizing:"units" },
  { id:"forex", label:"Forex", assetClasses:["forex"], examples:["EUR/USD","GBP/USD","USD/JPY"], hours:"24x5", riskSizing:"pips_lots" },
  { id:"metals", label:"Gold & Metals", assetClasses:["future","etf"], examples:["MGC","GC","GLD"], hours:"contract_calendar", riskSizing:"contract_ticks", note:"Gold is an instrument family, not a universal spot product. Availability, hours, and risk units depend on the actual contract or ETF." },
  { id:"options", label:"Options", assetClasses:["option"], examples:["SPY calls","SPY puts","defined-risk spreads"], hours:"exchange_hours", riskSizing:"premium_multiplier" },
  { id:"futures", label:"Futures", assetClasses:["future"], examples:["MES","MNQ","ES","NQ","CL"], hours:"contract_calendar", riskSizing:"contract_ticks" },
  { id:"bonds", label:"Bonds", assetClasses:["bond"], examples:["Treasury bonds","bond funds"], hours:"exchange_hours", riskSizing:"face_value" }
] as const;

/**
 * Broker capabilities must come from verified account permissions AND fresh provider instrument metadata.
 * Never infer order support from symbols shown in the universal search UI.
 */
export type VerifiedMarketCapability = {
  connected: boolean;
  quotesAvailable: boolean;
  instrumentTradable: boolean;
  accountPermitted: boolean;
  paperOrdersSupported: boolean;
  instrumentClass: AssetClass;
  verifiedAt: string;
};

export type MarketGate = { allowed: boolean; reason: string };
export function checkUniversalMarketAccess(input: {
  mode: TradingMode;
  instrumentClass: AssetClass;
  capability?: VerifiedMarketCapability | null;
  now?: Date;
  maxCapabilityAgeMs?: number;
}): MarketGate {
  const { mode, instrumentClass, capability } = input;
  if (!capability?.connected) return {allowed:false,reason:"Connect a supported provider first."};
  const checkedAt = Date.parse(capability.verifiedAt);
  const now = input.now?.getTime() ?? Date.now();
  const maxAge = input.maxCapabilityAgeMs ?? 60_000;
  if (!Number.isFinite(checkedAt) || checkedAt > now + 5000 || now - checkedAt > maxAge) {
    return {allowed:false,reason:"Broker capabilities are missing, stale, or invalid."};
  }
  if (capability.instrumentClass !== instrumentClass) return {allowed:false,reason:"Broker instrument class mismatch."};
  if (!capability.quotesAvailable) return {allowed:false,reason:"Required market data is unavailable."};
  if (mode === "research") return {allowed:true,reason:"Market data is available for analysis only."};
  if (!capability.instrumentTradable || !capability.accountPermitted) {
    return {allowed:false,reason:"This instrument or account lacks trading permission."};
  }
  if (mode === "paper") {
    return capability.paperOrdersSupported
      ? {allowed:true,reason:"Eligible for paper-trading checks; final order controls must still run."}
      : {allowed:false,reason:"Paper order routing is not supported by this connector."};
  }
  // Live routing is intentionally fail-closed; future live integrations require
  // account consent, licensed routing, jurisdiction checks, and a separate risk firewall.
  return {allowed:false,reason:"Live universal-market execution has not been implemented or approved."};
}
