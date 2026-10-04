import { buildTradeDecision } from "./tradeDecision";
import type { CueSignal } from "./cueSignal";

const signal:CueSignal={
  available:true,
  version:"technical-v0.1",
  state:"BUY",
  score:82,
  componentScores:{trend:80,momentum:75,volume:70,setup:85,risk:70},
  metrics:{close:100,ema9:99.5,ema20:98,rsi14:62,atr14:2,atrPercent:2,relativeVolume:1.7,support20:95,resistance20:108,extensionAtr:.25},
  plan:{entryLow:99,entryHigh:101,stop:96,target1:106,target2:111,target3:116},
  flags:[],
  explanation:[],
};

describe("trade decision engine",()=>{
  it("marks an aligned price inside the entry zone as entry ready",()=>{
    const result=buildTradeDecision({signal,intelligenceAction:"ENTRY_READY",currentPrice:100,fresh:true,hasPosition:false,marketActive:true,marketLabel:"MARKET OPEN"});
    expect(result.state).toBe("ENTER_NOW");
  });

  it("refuses to chase above the planned entry zone",()=>{
    const result=buildTradeDecision({signal,intelligenceAction:"ENTRY_READY",currentPrice:104,fresh:true,hasPosition:false,marketActive:true,marketLabel:"MARKET OPEN"});
    expect(result.state).toBe("DO_NOT_CHASE");
  });

  it("calls an exit when a held position breaches the technical stop",()=>{
    const result=buildTradeDecision({signal,intelligenceAction:"WAIT",currentPrice:95.5,fresh:true,hasPosition:true,marketActive:true,marketLabel:"MARKET OPEN"});
    expect(result.state).toBe("EXIT_NOW");
  });

  it("does not issue a live entry during weekend prep",()=>{
    const result=buildTradeDecision({signal,intelligenceAction:"ENTRY_READY",currentPrice:100,fresh:true,hasPosition:false,marketActive:false,marketLabel:"WEEKEND PREP"});
    expect(result.state).toBe("MARKET_CLOSED");
  });
});
