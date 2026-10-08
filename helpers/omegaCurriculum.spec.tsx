import {OMEGA_TRADING_CURRICULUM,omegaCurriculumPolicy} from "./omegaCurriculum";

describe("Omega trading curriculum",()=>{
  it("contains the complete ten-step desk curriculum",()=>{
    expect(OMEGA_TRADING_CURRICULUM.length).toBe(10);
    expect(OMEGA_TRADING_CURRICULUM[0].step).toBe(1);
    expect(OMEGA_TRADING_CURRICULUM[9].step).toBe(10);
  });
  it("keeps the profit goal subordinate to risk",()=>{
    const policy=omegaCurriculumPolicy();
    expect(policy.dailyBaseGoal).toBe(500);
    expect(policy.execution).toBe("PAPER_FIRST");
  });
});