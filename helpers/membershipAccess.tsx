import type { MembershipTier } from "./schema";

const featureMap: Record<MembershipTier, string[]> = {
  scout: [
    "command_center",
    "cue_radar_lite",
    "cue_news_basic",
    "professor_cue",
    "growth_path",
    "paper_trading",
    "basic_alerts",
    "journal",
    "green_gate",
  ],
  copilot: [
    "command_center",
    "cue_radar",
    "cue_vision",
    "fundamental_intelligence",
    "professor_cue",
    "growth_path",
    "risk_firewall",
    "capital_intelligence",
    "work_mode",
    "trading_dna",
    "advanced_alerts",
    "webull_connect",
    "assisted_live_trading",
  ],
  autopilot: [
    "command_center",
    "cue_radar",
    "cue_vision",
    "fundamental_intelligence",
    "professor_cue",
    "growth_path",
    "risk_firewall",
    "capital_intelligence",
    "work_mode",
    "trading_dna",
    "advanced_alerts",
    "webull_connect",
    "assisted_live_trading",
    "cue_crypto_24_7",
    "cue_futures",
    "strategy_lab",
    "paper_autopilot",
    "advanced_backtesting",
    "options_intelligence",
    "futures_intelligence",
    "automation_controls",
  ],
};

export function membershipAccess(tier: MembershipTier) {
  return featureMap[tier];
}
