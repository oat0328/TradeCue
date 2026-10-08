import {chartAnnotations,chartMarkFib,restoreChartMarks} from "./chartAnnotations";
import type {Candle} from "./chartMath";
describe("Chart-only annotations",()=>{
 const bar=(time:string,high:number,low:number):Candle=>({time,open:low,close:high,high,low,volume:100});
 it("separates prior regular session, premarket and current regular session",()=>{
  const result=chartAnnotations([bar("2026-10-05T13:30:00Z",105,95),bar("2026-10-05T22:00:00Z",999,1),bar("2026-10-06T12:00:00Z",110,98),bar("2026-10-06T13:30:00Z",108,100)]);
  expect(result.levels.find(l=>l.label==="PRIOR RTH HIGH")?.price).toBe(105);
  expect(result.levels.find(l=>l.label==="PRIOR RTH LOW")?.price).toBe(95);
  expect(result.levels.find(l=>l.label==="PREMARKET HIGH")?.price).toBe(110);
  expect(result.levels.find(l=>l.label==="DAY LOW")?.price).toBe(100);
 });
 it("does not label an unconfirmed high at the right edge",()=>{
  const bars=[10,11,12,11,10,13].map((h,i)=>bar(new Date(Date.UTC(2026,9,6,14,i*5)).toISOString(),h,h-2));
  const result=chartAnnotations(bars);
  expect(result.pivots.some(p=>p.index===5)).toBeFalse();
  expect(result.pivots.find(p=>p.kind==="high")?.price).toBe(12);
 });
 it("calculates retracements in the correct direction for both legs",()=>{
  const base={id:"f",kind:"fib" as const,label:"Fib",color:"#b9a7ff",start:{time:1,price:100},end:{time:2,price:120}};
  expect(chartMarkFib(base).find(l=>l.label==="Fib 50.0%")?.price).toBe(110);
  expect(chartMarkFib({...base,start:{time:1,price:120},end:{time:2,price:100}}).find(l=>l.label==="Fib 61.8%")?.price).toBeCloseTo(112.36,2);
  expect(chartMarkFib({...base,end:{time:2,price:100}})).toEqual([]);
 });
 it("rejects damaged saved drawings and preserves valid annotations",()=>{
  expect(restoreChartMarks("broken")).toEqual([]);
  expect(restoreChartMarks(JSON.stringify([{id:"x",kind:"level",label:"STOP",color:"#ff435f",start:{time:1,price:100}},{id:"bad",kind:"trend",label:"bad",color:"red",start:{time:1,price:-1}}])).length).toBe(1);
 });
});