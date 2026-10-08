import {omegaBreadth,omegaConfidence,omegaGrade,omegaHealthScore,omegaLongSetupScore,omegaMarketBias,omegaMarketMode,omegaPropTrainingReady,omegaShortSetupScore,omegaTradingReady} from "./omegaStrategy";

describe("TradeCUE Omega strategy policy",()=>{
  it("allows an A+ neutral-context setup in the paper prop-training lane",()=>{
    expect(omegaPropTrainingReady({fiveMinBuy:true,setupGrade:"A+",confidence:85,marketBias:"NEUTRAL",fifteenBullish:false,fifteenBearish:false,oneHourBullish:false,oneHourBearish:false})).toBe(true);
  });
  it("blocks prop training when a higher timeframe is bearish",()=>{
    expect(omegaPropTrainingReady({fiveMinBuy:true,setupGrade:"A+",confidence:100,marketBias:"BULLISH",fifteenBullish:true,fifteenBearish:false,oneHourBullish:false,oneHourBearish:true})).toBe(false);
  });
  it("requires one bullish higher timeframe for an A-grade training setup",()=>{
    expect(omegaPropTrainingReady({fiveMinBuy:true,setupGrade:"A",confidence:78,marketBias:"NEUTRAL",fifteenBullish:true,fifteenBearish:false,oneHourBullish:false,oneHourBearish:false})).toBe(true);
  });
  it("scores the full A+ long recipe at 12/12",()=>{
    expect(omegaLongSetupScore({aboveEma20:true,ema20Rising:true,aboveVwap:true,volumeConfirmed:true,pullback:true,confirmation:true,marketAligned:true})).toBe(12);
    expect(omegaGrade(12)).toBe("A+");
    expect(omegaConfidence(12)).toBe(100);
  });
  it("rejects incomplete setups below B",()=>{
    const score=omegaLongSetupScore({aboveEma20:true,ema20Rising:false,aboveVwap:false,volumeConfirmed:false,pullback:false,confirmation:false,marketAligned:false});
    expect(score).toBe(2);
    expect(omegaGrade(score)).toBe("NO_TRADE");
  });
  it("scores the mirrored bearish shadow recipe at 12/12",()=>{
    const score=omegaShortSetupScore({belowEma20:true,ema20Falling:true,belowVwap:true,volumeConfirmed:true,bounce:true,confirmation:true,marketAligned:true});
    expect(score).toBe(12);
    expect(omegaGrade(score)).toBe("A+");
  });
  it("derives bullish breadth and trend-day context",()=>{
    const breadth=omegaBreadth([1,2,3,4,-1]);
    expect(breadth.breadthScore).toBe(80);
    const bias=omegaMarketBias({spyChange:1.1,qqqChange:1.4,breadthScore:breadth.breadthScore});
    expect(bias).toBe("BULLISH");
    expect(omegaMarketMode({bias,breadthScore:breadth.breadthScore,spyChange:1.1,qqqChange:1.4})).toBe("TREND_DAY");
  });
  it("requires a health score above 90 and no critical errors",()=>{
    const score=omegaHealthScore({execution:true,data:true,scanner:true,strategy:true,risk:true,reporting:true});
    expect(score).toBe(100);
    expect(omegaTradingReady(score,0)).toBe(true);
    expect(omegaTradingReady(90,0)).toBe(false);
    expect(omegaTradingReady(100,1)).toBe(false);
  });
});
