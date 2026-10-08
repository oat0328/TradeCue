import {positionCommander} from "./positionCommander";

const base={
  fresh:true,forceFlat:false,stopHit:false,targetHit:false,currentR:0,
  technicalState:"BUY" as const,structureTrend:"BULLISH" as const,latestStructureEvent:"BOS_UP",
  aboveEma20:true,aboveVwap:true,entryPrice:100,
};

describe("Omega Position Commander",()=>{
  it("protects an observed winner after the give-back threshold",()=>{
    expect(positionCommander({...base,currentR:.75,peakR:1.5}).action).toBe("EXIT");
    expect(positionCommander({...base,currentR:.8,peakR:1.5}).action).not.toBe("EXIT");
    expect(positionCommander({...base,currentR:.5,peakR:1.4}).action).not.toBe("EXIT");
    expect(positionCommander({...base,currentR:.5,peakR:null}).action).not.toBe("EXIT");
  });
  it("uses fresh data for give-back decisions but honors scheduled flattening",()=>{
    expect(positionCommander({...base,fresh:false,currentR:.75,peakR:1.5}).action).toBe("DATA CHECK");
    expect(positionCommander({...base,fresh:false,forceFlat:true}).action).toBe("EXIT");
  });
  it("holds a constructive protected position",()=>{
    expect(positionCommander(base).action).toBe("HOLD");
  });
  it("raises protection after +1R",()=>{
    const result=positionCommander({...base,currentR:1.1});
    expect(result.action).toBe("RAISE STOP");
    expect(result.suggestedStop).toBe(100);
  });
  it("calls for a partial after +1.5R if momentum cools",()=>{
    expect(positionCommander({...base,currentR:1.6,technicalState:"WAIT"}).action).toBe("TAKE 50%");
  });
  it("exits when structure breaks bearish",()=>{
    expect(positionCommander({...base,structureTrend:"BEARISH"}).action).toBe("EXIT");
    expect(positionCommander({...base,latestStructureEvent:"BOS_DOWN"}).action).toBe("EXIT");
  });
  it("does not manage from stale data",()=>{
    expect(positionCommander({...base,fresh:false}).action).toBe("DATA CHECK");
  });
});