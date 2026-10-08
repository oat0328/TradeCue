import { buildCueDailyOutlook } from "./dailyOutlook";
import type { HunterRow } from "../endpoints/hunter/scan_GET.schema";

const row=(symbol:string,score:number,action:HunterRow["action"]="WAIT"):HunterRow=>({
  symbol,
  name:symbol,
  price:100,
  changePercent:1,
  relativeVolume:2,
  marketValue:10_000_000_000,
  peTtm:25,
  cueState:action==="ENTRY_READY"?"BUY":"WAIT",
  action,
  cueScore:score,
  fresh:true,
  latestBarTime:new Date().toISOString(),
  affordableShares:1,
  budgetFit:true,
  plan:action==="ENTRY_READY"?{
    entryLow:99,
    entryHigh:100,
    stop:98,
    target1:102,
    target2:104,
    target3:106,
  }:null,
  flags:[],
  sourceTags:["test"],
  whyNow:["test"],
  timeframeScores:{fiveMin:score,fifteenMin:score,oneHour:score,bullishFrames:3},
  marketChangePercent:.5,
  opportunityType:"SETUP_WATCH",
});

describe("daily outlook",()=>{
  it("becomes bullish when multiple fresh entries are ready",()=>{
    const result=buildCueDailyOutlook({
      marketMode:"RTH",
      rows:[row("AAA",85,"ENTRY_READY"),row("BBB",82,"ENTRY_READY")],
      macroState:"CLEAR",
      maxPositions:3,
      openPositions:0,
    });
    expect(result.bias).toBe("BULLISH");
    expect(result.label).toBe("TODAY'S OUTLOOK");
  });

  it("becomes cautious when macro risk is blocked",()=>{
    const result=buildCueDailyOutlook({
      marketMode:"PREMARKET",
      rows:[row("AAA",90,"ENTRY_READY")],
      macroState:"BLOCKED",
      maxPositions:3,
      openPositions:0,
    });
    expect(result.bias).toBe("CAUTIOUS");
    expect(result.stayOut).toContain("BLOCKED");
  });
});
