import {discoveryPriority,axiomReadiness} from "./axiomSelection";
describe("Axiom selection evidence",()=>{
 const good={regularSession:true,fresh:true,dollarVolume:2_000_000,technicalReady:true,watchable:true};
 it("blocks stale, unknown or thin activity even with a high technical score",()=>{
  expect(axiomReadiness({...good,fresh:false})).toBe("WAIT");
  expect(axiomReadiness({...good,dollarVolume:null})).toBe("WAIT");
  expect(axiomReadiness({...good,dollarVolume:900_000})).toBe("WAIT");
 });
 it("keeps off-session candidates as research rather than entry ready",()=>{expect(axiomReadiness({...good,regularSession:false})).toBe("WATCH");expect(axiomReadiness(good)).toBe("ENTRY_READY");});
 it("ranks measured participation above a small move without volume",()=>{expect(discoveryPriority({changePercent:2,relativeVolume:3})).toBeGreaterThan(discoveryPriority({changePercent:.4,relativeVolume:null}));});
});
