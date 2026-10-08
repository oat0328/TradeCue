import { candleStory,studyPricePath,historicalCandleLesson } from "./candleLesson";
import type { Candle } from "./chartMath";
describe("honest candle education",()=>{
  const bar=(open:number,high:number,low:number,close:number):Candle=>({open,high,low,close,volume:100,time:"2026-10-05T14:00:00Z"});
  const plan={entryLow:10,entryHigh:11,stop:9,target1:12};
  it("describes a lower-wick recovery without assigning motive",()=>{
    const story=candleStory([bar(10,11,8,10.8)],0);
    expect(story?.observations.some(s=>s.includes("lower wick"))).toBeTrue();
    expect(story?.observations.some(s=>s.includes("does not identify"))).toBeTrue();
  });
  it("rejects impossible OHLC",()=>expect(candleStory([bar(10,9,8,10)],0)).toBeNull());
  it("does not assume an outcome without future bars",()=>expect(studyPricePath([bar(10,11,9.5,10)],0,plan).state).toBe("WAITING"));
  it("does not cherry-pick a fill when the next open is outside the zone",()=>expect(studyPricePath([bar(10,11,9.5,10),bar(11.5,13,10,12)],0,plan).state).toBe("NO_FILL"));
  it("does not call a same-bar stop/target touch a win",()=>expect(studyPricePath([bar(10,11,9.5,10),bar(10.5,12.5,8.5,11)],0,plan).state).toBe("AMBIGUOUS"));
  it("records a target touch under explicit assumptions",()=>{
    const r=studyPricePath([bar(10,11,9.5,10),bar(10.5,12.1,10,12)],0,plan);
    expect(r.state).toBe("TARGET");expect(r.pnlPerShare).toBe(1.5);
  });
  it("uses a gap open below the stop instead of a perfect stop fill",()=>{
    const r=studyPricePath([bar(10,11,9.5,10),bar(10.5,11,10,10.7),bar(8,8.5,7.5,8)],0,plan);
    expect(r.state).toBe("STOP");expect(r.pnlPerShare).toBe(-2.5);
  });
  it("does not let a later rally change the historical signal",()=>{
    const first=Array.from({length:70},(_,i)=>bar(10+i*.01,10.1+i*.01,9.9+i*.01,10.02+i*.01));
    const before=historicalCandleLesson(first,60).signal;
    const after=historicalCandleLesson([...first,bar(20,30,20,29)],60).signal;
    expect(after).toEqual(before);
  });
});
