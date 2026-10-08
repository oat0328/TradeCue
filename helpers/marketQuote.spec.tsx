import {snapshotChangePercent} from "./marketQuote";
describe("Snapshot evidence",()=>{
 it("uses official ratio and previous close fallback",()=>{expect(snapshotChangePercent({change_ratio:".05"})).toBe(5);expect(snapshotChangePercent({price:"110",pre_close:"100"})).toBeCloseTo(10);});
 it("does not fabricate change from missing or zero previous close",()=>{expect(snapshotChangePercent({price:110})).toBeNull();expect(snapshotChangePercent({price:110,pre_close:0})).toBeNull();expect(snapshotChangePercent({change_percent:.5})).toBe(.5);});
});
