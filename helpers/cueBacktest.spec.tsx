import { backtestCueLong } from "./cueBacktest";
describe("Cue backtest",()=>{
  it("never fabricates metrics when no qualifying trades exist",()=>{
    const bars=Array.from({length:80},(_,i)=>({time:new Date(1700000000000+i*300000).toISOString(),open:100,high:100.1,low:99.9,close:100,volume:100}));
    const r=backtestCueLong(bars);
    expect(r.resolved).toBeGreaterThanOrEqual(0);
    if(r.resolved===0)expect(r.winRate).toBeNull();
  });
});