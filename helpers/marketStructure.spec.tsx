import { calculateMarketStructure } from "./marketStructure";

describe("calculateMarketStructure",()=>{
  it("returns support, resistance and a structure read",()=>{
    const bars=Array.from({length:60},(_,i)=>{
      const base=100+i*.2+Math.sin(i/2)*1.5;
      return {open:base-.2,high:base+.8,low:base-.8,close:base+.2,volume:1000+i};
    });
    const read=calculateMarketStructure(bars);
    expect(["BULLISH","BEARISH","RANGE"]).toContain(read.trend);
    expect(read.pattern.length).toBeGreaterThan(0);
    expect(read.summary.length).toBeGreaterThan(0);
  });
});