import {classifyHunterCandidate,classifyIntelligence} from "./hunterRules";

describe("TradeCUE hunter and intelligence rules",()=>{
  it("requires volume confirmation before Entry Ready",()=>{
    expect(classifyHunterCandidate({
      signalAvailable:true,fresh:true,state:"BUY",score:90,trend:95,setup:90,volume:0,hasPlan:true,minScore:65,
    })).toBe("WATCH");
  });

  it("blocks stale candidates from Entry Ready",()=>{
    expect(classifyHunterCandidate({
      signalAvailable:true,fresh:false,state:"BUY",score:92,trend:95,setup:92,volume:85,hasPlan:true,minScore:65,
    })).toBe("WAIT");
  });

  it("qualifies a complete fresh setup",()=>{
    expect(classifyHunterCandidate({
      signalAvailable:true,fresh:true,state:"BUY",score:86,trend:88,setup:82,volume:71,hasPlan:true,minScore:65,
    })).toBe("ENTRY_READY");
  });

  it("requires 5m and 15m alignment for multi-timeframe entry",()=>{
    expect(classifyIntelligence({
      fastState:"BUY",confirmState:"WAIT",fastFresh:true,confirmFresh:true,compositeScore:90,marketChangePercent:.4,
    })).toBe("WAIT");
  });

  it("allows multi-timeframe entry only when alignment, freshness, score and market context pass",()=>{
    expect(classifyIntelligence({
      fastState:"BUY",confirmState:"BUY",fastFresh:true,confirmFresh:true,compositeScore:82,marketChangePercent:.3,
    })).toBe("ENTRY_READY");
  });
});

