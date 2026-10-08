import {adaptivePaperEntryLimit,autoPaperMarketReady,autoPaperQuantity,isWorkingPaperOrder} from "./autoPaperRules";

describe("auto paper rules",()=>{
  it("does not treat terminal orders as working",()=>{
    expect(isWorkingPaperOrder("FILLED")).toBe(false);
    expect(isWorkingPaperOrder("Cancelled")).toBe(false);
    expect(isWorkingPaperOrder("REJECTED")).toBe(false);
    expect(isWorkingPaperOrder("WORKING")).toBe(true);
    expect(isWorkingPaperOrder("PARTIALLY_FILLED")).toBe(true);
  });

  it("sizes by the tighter of cash and stop risk",()=>{
    expect(autoPaperQuantity({budget:500,buyingPower:1000,entry:50,stop:48,maxRiskPerTrade:10})).toBe(5);
    expect(autoPaperQuantity({budget:100,buyingPower:1000,entry:50,stop:49,maxRiskPerTrade:50})).toBe(2);
  });

  it("never falls back to the budget when broker buying power is zero",()=>{
    expect(autoPaperQuantity({budget:500,buyingPower:0,entry:50,stop:48,maxRiskPerTrade:10})).toBe(0);
  });
  it("rejects a missing loss cap or a stop that cannot limit downside",()=>{
    for(const stop of [0,50,51,NaN]){
      expect(autoPaperQuantity({budget:500,buyingPower:1000,entry:50,stop,maxRiskPerTrade:10})).toBe(0);
    }
    expect(autoPaperQuantity({budget:500,buyingPower:1000,entry:50,stop:48,maxRiskPerTrade:0})).toBe(0);
  });
  it("uses actual buying power when lower than the budget",()=>{
    expect(autoPaperQuantity({budget:500,buyingPower:75,entry:50,stop:49,maxRiskPerTrade:10})).toBe(1);
  });
  it("caps prop-training size without forcing unsafe minimum shares",()=>{
    expect(autoPaperQuantity({budget:50000,buyingPower:50000,entry:20,stop:19.9,maxRiskPerTrade:100,maxShares:200})).toBe(200);
    expect(autoPaperQuantity({budget:50000,buyingPower:50000,entry:20,stop:18,maxRiskPerTrade:100,maxShares:200})).toBe(50);
  });
  it("only auto-submits CORE stock orders during RTH",()=>{
    expect(autoPaperMarketReady("RTH")).toBe(true);
    expect(autoPaperMarketReady("PREMARKET")).toBe(false);
    expect(autoPaperMarketReady("WEEKEND_PREP")).toBe(false);
  });
  it("improves fill probability inside the existing no-chase boundary",()=>{
    expect(adaptivePaperEntryLimit({plannedEntryHigh:336.72,currentPrice:337.045})).toBe(337.05);
    expect(adaptivePaperEntryLimit({plannedEntryHigh:724.99,currentPrice:724.91})).toBe(724.99);
  });
  it("refuses to chase a setup that already ran beyond the 0.10% entry tolerance",()=>{
    expect(adaptivePaperEntryLimit({plannedEntryHigh:231.64,currentPrice:232.99})).toBeNull();
  });
});