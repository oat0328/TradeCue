import {tradeTargetLadder,crossedTarget,crossedStop} from "./tradeTargetLadder";

describe("tradeTargetLadder",()=>{
  const plan={entryHigh:100,stop:98,target1:102,target2:104,target3:106};

  it("builds standard 1R/2R/3R targets",()=>{
    const ladder=tradeTargetLadder(plan,"standard");
    expect(ladder.map(x=>x.price)).toEqual([102,104,106]);
    expect(ladder.map(x=>x.r)).toEqual([1,2,3]);
  });

  it("builds crawl quick/1R/2R/3R targets",()=>{
    const ladder=tradeTargetLadder(plan,"crawl");
    expect(ladder.map(x=>x.price)).toEqual([101,102,104,106]);
    expect(ladder.map(x=>x.r)).toEqual([.5,1,2,3]);
  });

  it("detects one-way target and stop crossings",()=>{
    expect(crossedTarget(100.9,101.1,101)).toBeTrue();
    expect(crossedTarget(101.1,101.2,101)).toBeFalse();
    expect(crossedStop(98.2,97.9,98)).toBeTrue();
    expect(crossedStop(97.9,97.8,98)).toBeFalse();
  });
});
   25