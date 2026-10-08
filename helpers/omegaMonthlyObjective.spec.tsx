import {omegaMonthlyObjective} from "./omegaMonthlyObjective";
describe("Omega monthly paper objective",()=>{
 it("counts signed closed P/L in Pacific month and current week",()=>{
  const result=omegaMonthlyObjective([
   {exitTime:"2026-10-01T06:59:00Z",realizedPnl:1000},
   {exitTime:"2026-10-01T07:01:00Z",realizedPnl:200},
   {exitTime:"2026-10-06T20:00:00Z",realizedPnl:-50},
   {exitTime:null,realizedPnl:500},
   {exitTime:"2026-10-08T20:00:00Z",realizedPnl:300},
  ],new Date("2026-10-07T20:00:00Z"));
  expect(result.monthPnl).toBe(150);expect(result.weekPnl).toBe(-50);
  expect(result.remaining).toBe(9850);expect(result.closedTrades).toBe(2);
  expect(result.requiredAveragePerWeekday).toBeCloseTo(9850/result.weekdaysLeft);
 });
 it("resets at month rollover and caps goal progress",()=>{
  const result=omegaMonthlyObjective([
   {exitTime:"2026-10-30T20:00:00Z",realizedPnl:1000},
   {exitTime:"2026-11-02T20:00:00Z",realizedPnl:12000},
  ],new Date("2026-11-02T21:00:00Z"));
  expect(result.month).toBe("2026-11");expect(result.monthPnl).toBe(12000);
  expect(result.progress).toBe(100);expect(result.remaining).toBe(0);expect(result.reached).toBe(true);
 });
 it("keeps losses and handles a weekend month end without division by zero",()=>{
  const result=omegaMonthlyObjective([{exitTime:"2026-10-30T20:00:00Z",realizedPnl:-100}],new Date("2026-10-31T20:00:00Z"));
  expect(result.remaining).toBe(10100);expect(result.progress).toBe(0);
  expect(result.weekdaysLeft).toBe(0);expect(result.requiredAveragePerWeekday).toBe(null);
 });
});
