import { calculateCueSignal } from "./cueSignal";
import type { WebullBar } from "./webullBars";

function series(direction:1|-1,volume=1000):WebullBar[]{
  return Array.from({length:80},(_,index)=>{
    const base=100+direction*index*.35;
    const close=base+direction*.12;
    return {
      time:new Date(Date.UTC(2026,0,1,14,30)+index*300000).toISOString(),
      open:base,
      high:Math.max(base,close)+.25,
      low:Math.min(base,close)-.25,
      close,
      volume:volume+index*5,
    };
  });
}

describe("calculateCueSignal",()=>{
  it("refuses to invent a signal from too little data",()=>{
    const result=calculateCueSignal(series(1).slice(0,20));
    expect(result.available).toBeFalse();
  });

  it("returns documented component scores for sufficient bars",()=>{
    const result=calculateCueSignal(series(1));
    expect(result.available).toBeTrue();
    if(!result.available)return;
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.componentScores.trend).toBeGreaterThanOrEqual(0);
    expect(result.explanation.length).toBe(5);
  });

  it("does not label a persistent downtrend as BUY",()=>{
    const result=calculateCueSignal(series(-1));
    expect(result.available).toBeTrue();
    if(!result.available)return;
    expect(result.state).not.toBe("BUY");
  });

  it("uses the prior completed volume bar when the newest candle has zero volume",()=>{
    const bars=series(1);
    bars[bars.length-1]={...bars[bars.length-1],volume:0};
    const result=calculateCueSignal(bars);
    expect(result.available).toBeTrue();
    if(!result.available)return;
    expect(result.metrics.relativeVolume).toBeGreaterThan(0);
    expect(result.flags.some(flag=>flag.includes("completed non-zero bar"))).toBeTrue();
  });
});

