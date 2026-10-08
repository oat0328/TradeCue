import { calculateCueSignal,classifyCandlePressure } from "./cueSignal";
import type { WebullBar } from "./webullBars";

function series(direction:1|-1,volume=1000):WebullBar[]{
  return Array.from({length:80},(_,index)=>{
    const base=100+direction*index*.35;
    const close=base+direction*.12;
    return {
      time:new Date(Date.UTC(2026,0,1,14,30)+index*300000).toISOString(),
      open:base,
      high:Math.max(base,close)+.5,
      low:Math.min(base,close)-.5,
      close,
      volume:volume+index*5,
    };
  });
}

function emaPullbackSeries(greenConfirmation=true):WebullBar[]{
  const bars:Array<WebullBar>=Array.from({length:80},(_,index)=>{
    const base=100+index*.18+Math.sin(index/3)*.8;
    return {
      time:new Date(Date.UTC(2026,0,1,14,30)+index*300000).toISOString(),
      open:base-.05,
      high:base+.55,
      low:base-.55,
      close:base+.08,
      volume:1200+index*8,
    };
  });
  const n=bars.length;
  bars[n-6]={...bars[n-6],open:113.65,high:114.05,low:113.15,close:113.45};
  bars[n-5]={...bars[n-5],open:113.45,high:113.82,low:113.05,close:113.28};
  bars[n-4]={...bars[n-4],open:113.28,high:113.74,low:112.98,close:113.42};
  bars[n-3]={...bars[n-3],open:113.42,high:113.62,low:113.12,close:113.25};
  bars[n-2]=greenConfirmation
    ?{...bars[n-2],open:113.22,high:113.38,low:113.18,close:113.30}
    :{...bars[n-2],open:113.50,high:113.58,low:113.10,close:113.20};
  bars[n-1]={...bars[n-1],open:113.40,high:113.58,low:113.30,close:113.46};
  return bars;
}

describe("calculateCueSignal",()=>{
  it("recognizes the strong buyer-control candle lesson",()=>{
    const read=classifyCandlePressure({open:100,high:105.05,low:99.95,close:105});
    expect(read.strongBuyerControl).toBe(true);
    expect(read.strongSellerControl).toBe(false);
  });
  it("recognizes the strong seller-control candle lesson",()=>{
    const read=classifyCandlePressure({open:105,high:105.05,low:99,close:100});
    expect(read.strongSellerControl).toBe(true);
    expect(read.indecisionWarning).toBe(false);
  });
  it("recognizes a small-body two-sided-wick warning candle",()=>{
    const read=classifyCandlePressure({open:100,high:103,low:97,close:100.4});
    expect(read.indecisionWarning).toBe(true);
    expect(read.strongSellerControl).toBe(false);
  });
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
    expect(result.explanation.length).toBeGreaterThanOrEqual(6);
    expect(["BULLISH","BEARISH","RANGE"]).toContain(result.metrics.priceActionTrend);
  });

  it("requires the EMA20 pullback and completed green candle for BUY",()=>{
    const result=calculateCueSignal(emaPullbackSeries(true));
    expect(result.available).toBeTrue();
    if(!result.available)return;
    expect(result.metrics.aboveEma20).toBeTrue();
    expect(result.metrics.ema20Rising).toBeTrue();
    expect(result.metrics.pullback).toBeTrue();
    expect(result.metrics.greenConfirmation).toBeTrue();
    expect(result.setupStage).toBe("ENTRY_READY");
    expect(result.state).toBe("BUY");
  });

  it("waits when the pullback happened but the completed candle is not green confirmation",()=>{
    const result=calculateCueSignal(emaPullbackSeries(false));
    expect(result.available).toBeTrue();
    if(!result.available)return;
    expect(result.metrics.pullback).toBeTrue();
    expect(result.metrics.greenConfirmation).toBeFalse();
    expect(result.state).not.toBe("BUY");
  });

  it("builds TP1/TP2/TP3 at exactly 1R/2R/3R from the confirmed EMA20 setup",()=>{
    const result=calculateCueSignal(emaPullbackSeries(true));
    expect(result.available).toBeTrue();
    if(!result.available||!result.plan)throw new Error("Expected a confirmed EMA20 trade plan");
    const risk=result.plan.entryHigh-result.plan.stop;
    expect(Math.abs((result.plan.target1-result.plan.entryHigh)-risk)).toBeLessThanOrEqual(.02);
    expect(Math.abs((result.plan.target2-result.plan.entryHigh)-risk*2)).toBeLessThanOrEqual(.02);
    expect(Math.abs((result.plan.target3-result.plan.entryHigh)-risk*3)).toBeLessThanOrEqual(.02);
  });

  it("supports a 1.5R protected target for paper prop training",()=>{
    const result=calculateCueSignal(emaPullbackSeries(true),{protectedTargetR:1.5});
    expect(result.available).toBeTrue();
    if(!result.available||!result.plan)throw new Error("Expected a prop-training trade plan");
    const risk=result.plan.entryHigh-result.plan.stop;
    expect(result.metrics.protectedTargetR).toBe(1.5);
    expect(Math.abs((result.plan.target2-result.plan.entryHigh)-risk*1.5)).toBeLessThanOrEqual(.02);
  });

  it("does not label a persistent downtrend as BUY",()=>{
    const result=calculateCueSignal(series(-1));
    expect(result.available).toBeTrue();
    if(!result.available)return;
    expect(result.state).not.toBe("BUY");
  });

  it("blocks long entries when completed price action is bearish",()=>{
    const bars=Array.from({length:90},(_,index)=>{
      const trend=100+index*.16;
      const swing=index<72?Math.sin(index/2)*.55:-Math.sin((index-72)/2)*.9-(index-72)*.05;
      const base=trend+swing;
      return {
        time:new Date(Date.UTC(2026,0,2,14,30)+index*300000).toISOString(),
        open:base-.08,
        high:base+.42,
        low:base-.42,
        close:base+.08,
        volume:1400+index*7,
      };
    });
    const result=calculateCueSignal(bars);
    expect(result.available).toBeTrue();
    if(!result.available)return;
    if(result.metrics.priceActionTrend==="BEARISH"){
      expect(result.state).not.toBe("BUY");
      expect(result.setupStage).toBe("PRICE_ACTION_BEARISH");
      expect(result.plan).toBeNull();
    }
  });

  it("uses a completed volume bar instead of the live zero-volume candle",()=>{
    const bars=emaPullbackSeries(true);
    bars[bars.length-1]={...bars[bars.length-1],volume:0};
    const result=calculateCueSignal(bars);
    expect(result.available).toBeTrue();
    if(!result.available)return;
    expect(result.metrics.relativeVolume).toBeGreaterThan(0);
  });
});
