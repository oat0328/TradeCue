import { isPastPacificCutoff } from "./riskFirewall";

describe("Risk Firewall time guard",()=>{
  it("keeps day-trade entries open before the PT cutoff",()=>{
    expect(isPastPacificCutoff("12:30",new Date("2026-10-03T19:29:00Z"))).toBe(false);
  });

  it("closes new day-trade entries after the PT cutoff",()=>{
    expect(isPastPacificCutoff("12:30",new Date("2026-10-03T19:31:00Z"))).toBe(true);
  });
});
