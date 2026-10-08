import {liquidStockCandidate} from "./stockUniverse";
describe("major stock universe",()=>{
 const base={symbol:"NVDA",name:"NVIDIA",price:200,marketValue:null,changePercent:1};
 it("keeps moving established stocks and rejects penny stocks and extreme spikes",()=>{
  expect(liquidStockCandidate(base)).toBeTrue();
  expect(liquidStockCandidate({...base,price:4})).toBeFalse();
  expect(liquidStockCandidate({...base,changePercent:250})).toBeFalse();
  expect(liquidStockCandidate({...base,changePercent:null})).toBeTrue();
  expect(liquidStockCandidate({...base,symbol:"OTHER",marketValue:20e9,changePercent:null})).toBeFalse();
 });
 it("requires verified large capitalization for names outside the core list",()=>{
  expect(liquidStockCandidate({...base,symbol:"OTHER"})).toBeFalse();
  expect(liquidStockCandidate({...base,symbol:"OTHER",marketValue:20e9})).toBeTrue();
  expect(liquidStockCandidate({...base,name:"Acquisition units"})).toBeFalse();
 });
});
   17