import {calculatePrecisionStructureSignal} from "./precisionStructure";
import type {WebullBar} from "./webullBars";

function wave(direction:1|-1):WebullBar[]{
  return Array.from({length:100},(_,i)=>{
    const trend=100+direction*i*.18;
    const swing=Math.sin(i/3)*1.25;
    const close=trend+swing;
    return {
      time:new Date(Date.UTC(2026,0,5,14,30)+i*300000).toISOString(),
      open:close-direction*.08,
      high:close+.42,
      low:close-.42,
      close,
      volume:1200+i*8,
    };
  });
}

describe("calculatePrecisionStructureSignal",()=>{
  it("refuses to fabricate a setup with too little data",()=>{
    const result=calculatePrecisionStructureSignal(wave(1).slice(0,20));
    expect(result.available).toBeFalse();
  });

  it("recognizes persistent bearish structure as non-long context",()=>{
    const result=calculatePrecisionStructureSignal(wave(-1));
    expect(result.available).toBeTrue();
    if(!result.available)return;
    if(result.metrics.trend==="BEARISH"){
      expect(result.state).not.toBe("BUY");
      expect(result.direction).toBe("BEARISH_STUDY");
      expect(result.plan).toBeNull();
    }
  });

  it("keeps exact R-based targets when a structure plan exists",()=>{
    const bars=wave(1);
    const result=calculatePrecisionStructureSignal(bars);
    expect(result.available).toBeTrue();
    if(!result.available||!result.watchPlan)return;
    const risk=result.watchPlan.entryHigh-result.watchPlan.stop;
    expect(risk).toBeGreaterThan(0);
    expect(Math.abs((result.watchPlan.target1-result.watchPlan.entryHigh)-risk)).toBeLessThanOrEqual(.03);
    expect(Math.abs((result.watchPlan.target2-result.watchPlan.entryHigh)-risk*2)).toBeLessThanOrEqual(.03);
    expect(Math.abs((result.watchPlan.target3-result.watchPlan.entryHigh)-risk*3)).toBeLessThanOrEqual(.03);
  });

  it("never labels an entry ready without a complete protected plan",()=>{
    const result=calculatePrecisionStructureSignal(wave(1));
    expect(result.available).toBeTrue();
    if(!result.available)return;
    if(result.state==="BUY"){
      expect(result.stage).toBe("ENTRY_READY");
      expect(result.plan).not.toBeNull();
      expect(result.watchPlan).not.toBeNull();
    }
  });
});
   60