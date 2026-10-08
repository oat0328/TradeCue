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

  it("uses the fresh 5m setup as the entry trigger; 15m is context only",()=>{
    expect(classifyIntelligence({
      fastState:"BUY",confirmState:"WAIT",fastFresh:true,confirmFresh:true,compositeScore:90,marketChangePercent:.4,
    })).toBe("ENTRY_READY");
  });

  it("does not treat absent or invalid market context as permission to enter",()=>{
    for(const marketChangePercent of [null,NaN,-2]){
      expect(classifyIntelligence({fastState:"BUY",confirmState:"BUY",fastFresh:true,confirmFresh:true,compositeScore:90,marketChangePercent})).toBe("WAIT");
    }
  });
  it("allows entry when the fresh 5m trigger and market context pass",()=>{
    expect(classifyIntelligence({
      fastState:"BUY",confirmState:"WAIT",fastFresh:true,confirmFresh:false,compositeScore:50,marketChangePercent:.3,
    })).toBe("ENTRY_READY");
  });
});
