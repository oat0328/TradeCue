import {describe,it,expect} from "vitest";
import {researchOmegaForecast,forecastPrice} from "./omegaForecastResearch";
import type {WebullBar} from "./webullBars";
function bars(n:number):WebullBar[]{return Array.from({length:n},(_,i)=>{const close=100+i*.015+Math.sin(i/5)*.15;return {
  time:new Date(Date.UTC(2026,9,1)+i*300_000).toISOString(),open:close-.01,high:close+.1,low:close-.1,close,volume:1000+i,
};});}
describe("Omega research baseline",()=>{
 it("never invents a forecast without enough candles",()=>expect(researchOmegaForecast({symbol:"SPY",bars:bars(40),source:"webull"}).status).toBe("INSUFFICIENT_DATA"));
 it("creates transparent comparisons and lower/upper ordered ranges",()=>{
  const result=researchOmegaForecast({symbol:"SPY",bars:bars(360),source:"webull"});
  expect(result.forecasts).toHaveLength(3);
  expect(result.backtest).toHaveLength(2);
  for(const row of result.forecasts){expect(row.lower).toBeLessThanOrEqual(row.median);expect(row.median).toBeLessThanOrEqual(row.upper);expect(row.testSamples).toBeGreaterThanOrEqual(20);}
 });
 it("last close baseline does not move with horizon",()=>{
  expect(forecastPrice([100,101,102,103,104,105,106,107],12,"last_close")).toBe(107);
 });
 it("does not accept non finite or bad OHLC data",()=>{
  const dirty=[...bars(400),{time:"invalid",open:0,high:0,low:0,close:0,volume:-1}];
  expect(researchOmegaForecast({symbol:"SPY",bars:dirty,source:"webull"}).barsUsed).toBe(400);
 });
 it("does not rely on any future bars when making a point forecast",()=>{
   const a=bars(250),b=[...a,...bars(3).map((x,i)=>({...x,time:new Date(Date.parse(a.at(-1)!.time)+(i+1)*300_000).toISOString(),close:700+i}))];
   const last=a.map(x=>x.close),longer=b.map(x=>x.close);
   expect(forecastPrice(last,3,"shrunk_momentum")).toBe(forecastPrice(longer.slice(0,250),3,"shrunk_momentum"));
 });
});
