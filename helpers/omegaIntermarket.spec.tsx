import {describe,it,expect} from "vitest";
import {omegaIntermarketContext} from "./omegaIntermarket";
function bars(n:number,mult=1,start=100){
 return Array.from({length:n},(_,i)=>{
  const close=start+mult*(i*.05+Math.sin(i/3)*.5);
  return {time:new Date(Date.UTC(2026,9,1)+i*300000).toISOString(),
    open:close,high:close+.1,low:close-.1,close,volume:1000};
 });
}
describe("intermarket evidence",()=>{
 it("detects contemporaneous co-movement without claiming predictive causality",()=>{
  const res=omegaIntermarketContext(bars(70),[{symbol:"SPY",bars:bars(70,2)}]);
  expect(res[0].matchedReturns).toBe(69);
  expect(res[0].correlation).toBeGreaterThan(.98);
 });
 it("keeps correlation unavailable for tiny samples",()=>{
  expect(omegaIntermarketContext(bars(12),[{symbol:"QQQ",bars:bars(12)}])[0].correlation).toBeNull();
 });
 it("never bridges overnight gaps as if continuous bars",()=>{
  const series=bars(50);const shifted=series.map((b,i)=>i>25?{...b,time:new Date(Date.parse(b.time)+86400000).toISOString()}:b);
  expect(omegaIntermarketContext(shifted,[{symbol:"SPY",bars:shifted}])[0].matchedReturns).toBe(48);
 });
});
