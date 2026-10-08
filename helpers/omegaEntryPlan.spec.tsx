import {omegaEntryPlan} from "./omegaEntryPlan";
const base={price:100,entryHigh:100,stop:98,target:104,budget:1000,buyingPower:1000,maxRiskPerTrade:10};
describe("Omega executable entry plan",()=>{
  it("sizes against risk and exposes the target scenario",()=>{
    const plan=omegaEntryPlan(base)!;
    expect(plan.quantity).toBe(5);
    expect(plan.rewardRisk).toBe(2);
    expect(plan.plannedLoss).toBe(10);
    expect(plan.grossTargetProfit).toBe(20);
  });
  it("rejects chasing and invalidated or completed setups",()=>{
    expect(omegaEntryPlan({...base,price:100.2})).toBeNull();
    expect(omegaEntryPlan({...base,price:98})).toBeNull();
    expect(omegaEntryPlan({...base,price:104})).toBeNull();
  });
  it("rejects poor payoff and unaffordable size",()=>{
    expect(omegaEntryPlan({...base,target:101})).toBeNull();
    expect(omegaEntryPlan({...base,buyingPower:50})).toBeNull();
    expect(omegaEntryPlan({...base,maxRiskPerTrade:1})).toBeNull();
  });
});