import {describe,it,expect} from "vitest";
import {reviewOmegaStockSetup,analyzeOmegaExperience,type GeniusInput} from "./omegaGenius";
import type {CueSignal} from "./cueSignal";

const now=new Date("2026-10-12T15:00:00.000Z");
const signal={
  available:true,state:"BUY",score:86,
  plan:{entryLow:99.5,entryHigh:100,stop:99,target1:101,target2:102.5,target3:104},
} as CueSignal;
const frames=["5m","15m","1H"].map(label=>({label,state:"BUY" as const,fresh:true,lastBarTime:now.toISOString()}));
function input(overrides:Partial<GeniusInput>={}):GeniusInput{
  return {signal,currentPrice:99.8,latestBarTime:now.toISOString(),
    marketOpen:true,hasPosition:false,macroState:"CLEAR",
    intelligence:{action:"ENTRY_READY",generatedAt:now,frames},
    accountEquity:10000,buyingPower:5000,maxRiskDollars:80,now,...overrides};
}
describe("Omega Genius paper research vetoes",()=>{
  it("confirms a qualified setup without authorizing an order",()=>{
    const result=reviewOmegaStockSetup(input());
    expect(result.verdict).toBe("SETUP_CANDIDATE");
    expect(result.plan?.grossR).toBe(2.5);
    expect(result.plan?.maxPaperShares).toBe(50);
    expect(result.headline).not.toMatch(/win rate/i);
  });
  it("vetoes stale bars, future timestamps and stale intelligence",()=>{
    expect(reviewOmegaStockSetup(input({latestBarTime:"2026-10-12T14:00:00Z"})).verdict).toBe("DATA_CHECK");
    expect(reviewOmegaStockSetup(input({latestBarTime:"2026-10-13T15:00:00Z"})).verdict).toBe("DATA_CHECK");
    expect(reviewOmegaStockSetup(input({intelligence:{action:"ENTRY_READY",generatedAt:"2026-10-12T14:00:00Z",frames}})).verdict).toBe("DATA_CHECK");
  });
  it("blocks missing or conflicting 1H context",()=>{
    expect(reviewOmegaStockSetup(input({intelligence:{action:"ENTRY_READY",generatedAt:now,frames:frames.slice(0,2)}})).verdict).toBe("DATA_CHECK");
    expect(reviewOmegaStockSetup(input({intelligence:{action:"ENTRY_READY",generatedAt:now,frames:[...frames.slice(0,2),{...frames[2],state:"AVOID"}]}})).verdict).toBe("RISK_VETO");
  });
  it("blocks macro risk, market closure and absent buying power",()=>{
    expect(reviewOmegaStockSetup(input({macroState:"BLOCKED"})).verdict).toBe("RISK_VETO");
    expect(reviewOmegaStockSetup(input({macroState:"OFFLINE"})).verdict).toBe("RISK_VETO");
    expect(reviewOmegaStockSetup(input({marketOpen:false})).verdict).toBe("WAIT");
    expect(reviewOmegaStockSetup(input({buyingPower:null})).verdict).toBe("DATA_CHECK");
  });
  it("rejects invalid or poor-reward stops and chasing",()=>{
    expect(reviewOmegaStockSetup(input({currentPrice:101})).verdict).toBe("WAIT");
    expect(reviewOmegaStockSetup(input({signal:{...signal,plan:{...signal.plan!,target2:101.5}}})).verdict).toBe("RISK_VETO");
    expect(reviewOmegaStockSetup(input({signal:{...signal,plan:{...signal.plan!,stop:100.2}}})).verdict).toBe("RISK_VETO");
  });
  it("does not size trades that violate per-trade limits",()=>{
    expect(reviewOmegaStockSetup(input({accountEquity:10,buyingPower:10000,maxRiskDollars:1000})).verdict).toBe("RISK_VETO");
  });
  it("does not overwrite broker-position protection",()=>{
    const r=reviewOmegaStockSetup(input({hasPosition:true,macroState:"OFFLINE"}));
    expect(r.verdict).toBe("MANAGE_POSITION");
    expect(r.plan).toBeNull();
  });
});
describe("Omega paper performance research",()=>{
  it("uses net R and does not claim skill on a tiny sample",()=>{
    const r=analyzeOmegaExperience([{strategy:"20EMA",assetClass:"stocks",netR:2,mode:"paper"},{strategy:"20EMA",assetClass:"stocks",netR:-1,mode:"paper"},{strategy:"20EMA",assetClass:"stocks",netR:10,mode:"live"}],"20EMA","stocks");
    expect(r.sampleSize).toBe(2);
    expect(r.meanNetR).toBe(.5);
    expect(r.status).toBe("INSUFFICIENT_SAMPLE");
  });
  it("does not hallucinate profitability when there are no trades",()=>{
    const r=analyzeOmegaExperience([],"unknown","crypto");
    expect(r.meanNetR).toBeNull();
    expect(r.profitFactor).toBeNull();
    expect(r.status).toBe("INSUFFICIENT_SAMPLE");
  });
});
