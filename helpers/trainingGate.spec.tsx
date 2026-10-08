import { cueTrainingGate } from "./trainingGate";

describe("CUE training gate",()=>{
  it("uses the paper calibration threshold before 30 resolved trades",()=>{
    const result=cueTrainingGate({tradeCount:10,expectancy:.8,profitFactor:3,maxLosingStreak:0});
    expect(result.phase).toBe("CALIBRATING");
    expect(result.minCueScore).toBe(70);
    expect(result.maxAutoPositions).toBe(2);
  });
  it("flags weak evidence without silently changing the approved rules",()=>{
    const result=cueTrainingGate({tradeCount:50,expectancy:-.1,profitFactor:.9,maxLosingStreak:3});
    expect(result.phase).toBe("TIGHTENED");
    expect(result.minCueScore).toBe(82);
    expect(result.maxAutoPositions).toBe(2);
  });
  it("keeps the same conservative gate even with positive evidence",()=>{
    const result=cueTrainingGate({tradeCount:60,expectancy:.3,profitFactor:1.5,maxLosingStreak:2});
    expect(result.phase).toBe("VERIFIED");
    expect(result.minCueScore).toBe(82);
    expect(result.maxAutoPositions).toBe(2);
  });
});
