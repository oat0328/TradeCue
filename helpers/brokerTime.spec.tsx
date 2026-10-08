import {brokerTime} from "./brokerTime";
describe("broker timestamps",()=>{
 it("accepts seconds, milliseconds, numeric strings and ISO consistently",()=>{
  const iso="2026-10-05T14:00:00.000Z",ms=Date.parse(iso);
  for(const value of [ms,ms/1000,String(ms),String(ms/1000),iso,new Date(ms)])expect(brokerTime(value)).toBe(iso);
 });
 it("preserves unknown and rejects invalid timestamps instead of inventing a fill time",()=>{
  for(const value of [null,undefined,"","not a date",NaN,Infinity,0,{},999999999999999])expect(brokerTime(value)).toBeNull();
 });
});
