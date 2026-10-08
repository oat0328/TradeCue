import { stopProtection } from "./stopProtection";
describe("stopProtection", () => {
  const check = (stops: Array<{status:string;quantity:number|null;filledQty:number|null}>, heldQty=10, brokerReachable=true) => stopProtection({heldQty,brokerReachable,stops});
  it("alerts for rejected and absent stops", () => {
    expect(check([{status:"REJECTED",quantity:10,filledQty:0}]).alert).toBeTrue();
    expect(check([]).alert).toBeTrue();
  });
  it("accepts sufficient working coverage", () => {
    expect(check([{status:"WORKING",quantity:10,filledQty:0}]).alert).toBeFalse();
  });
  it("alerts for partial coverage and unknown status", () => {
    expect(check([{status:"WORKING",quantity:10,filledQty:2}]).alert).toBeTrue();
    expect(check([{status:"MYSTERY",quantity:10,filledQty:0}]).alert).toBeTrue();
  });
  it("does not assume unreachable broker means protection", () => { expect(check([],10,false).alert).toBeTrue(); });
  it("clears when flat", () => { expect(check([],0,false).alert).toBeFalse(); });
  it("combines separate stop coverage", () => {
    expect(check([{status:"WORKING",quantity:4,filledQty:0},{status:"WORKING",quantity:6,filledQty:0}]).alert).toBeFalse();
  });
  it("does not count cancelled or filled stops", () => {
    expect(check([{status:"CANCELLED",quantity:10,filledQty:0},{status:"FILLED",quantity:10,filledQty:10}]).alert).toBeTrue();
  });
});
