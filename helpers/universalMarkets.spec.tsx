import { describe, expect, it } from "vitest";
import { checkUniversalMarketAccess, UNIVERSAL_MARKETS, type VerifiedMarketCapability } from "./universalMarkets";
const now = new Date("2026-10-11T20:00:00Z");
function verified(overrides:Partial<VerifiedMarketCapability>={}):VerifiedMarketCapability {
  return {connected:true,quotesAvailable:true,instrumentTradable:true,accountPermitted:true,paperOrdersSupported:true,instrumentClass:"crypto",verifiedAt:now.toISOString(),...overrides};
}
describe("TradeCUE universal markets",()=>{
  it("offers the requested asset families as discoverable markets",()=>{
    expect(UNIVERSAL_MARKETS.map(m=>m.id)).toEqual(expect.arrayContaining(["stocks","forex","metals","crypto","options","futures"]));
  });
  it("permits verified provider data for research",()=>{
    expect(checkUniversalMarketAccess({mode:"research",instrumentClass:"forex",capability:verified({instrumentClass:"forex",paperOrdersSupported:false}),now}).allowed).toBe(true);
  });
  it("does not allow orders merely because a symbol is displayed",()=>{
    expect(checkUniversalMarketAccess({mode:"paper",instrumentClass:"crypto",capability:verified({accountPermitted:false}),now}).allowed).toBe(false);
  });
  it("blocks provider mismatch and stale data",()=>{
    expect(checkUniversalMarketAccess({mode:"paper",instrumentClass:"forex",capability:verified(),now}).allowed).toBe(false);
    expect(checkUniversalMarketAccess({mode:"paper",instrumentClass:"crypto",capability:verified({verifiedAt:"2026-10-10T00:00:00Z"}),now}).allowed).toBe(false);
  });
  it("blocks paper execution without provider order support",()=>{
    expect(checkUniversalMarketAccess({mode:"paper",instrumentClass:"crypto",capability:verified({paperOrdersSupported:false}),now}).allowed).toBe(false);
  });
  it("never enables live-money execution in this foundation",()=>{
    expect(checkUniversalMarketAccess({mode:"live",instrumentClass:"crypto",capability:verified(),now}).allowed).toBe(false);
  });
});
