import {afterPacificFlatTime,autoEntryTiming,stockMarketMode} from "./marketClock";

describe("market clock",()=>{
  it("recognizes regular Monday market hours",()=>{
    expect(stockMarketMode(new Date("2026-10-05T16:00:00Z"))).toBe("RTH");
  });
  it("keeps Sunday in prep before overnight opens",()=>{
    expect(stockMarketMode(new Date("2026-10-04T22:00:00Z"))).toBe("WEEKEND_PREP");
  });
  it("only forces the PT flat rule during RTH",()=>{
    expect(afterPacificFlatTime("12:30",new Date("2026-10-05T19:40:00Z"))).toBe(true);
    expect(afterPacificFlatTime("12:30",new Date("2026-10-04T22:00:00Z"))).toBe(false);
  });
  it("uses the first 15 minutes as observation and blocks the final 15 minutes",()=>{
    expect(autoEntryTiming(new Date("2026-10-05T13:35:00Z")).openingObservation).toBe(true);
    expect(autoEntryTiming(new Date("2026-10-05T13:50:00Z")).normalWindow).toBe(true);
    expect(autoEntryTiming(new Date("2026-10-05T18:45:00Z")).slowMarket).toBe(true);
    expect(autoEntryTiming(new Date("2026-10-05T19:15:00Z")).powerHour).toBe(true);
    expect(autoEntryTiming(new Date("2026-10-05T19:50:00Z")).final15).toBe(true);
  });
});