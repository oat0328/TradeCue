import {omegaDailyObjective} from "./omegaDailyObjective";

describe("Omega daily paper objective",()=>{
  it("tracks progress without forcing a trade",()=>{
    const state=omegaDailyObjective(125);
    expect(state.target).toBe(500);
    expect(state.remaining).toBe(375);
    expect(state.progress).toBe(25);
    expect(state.reached).toBe(false);
    expect(state.mode).toBe("BUILD_TO_GOAL");
  });
  it("caps progress and marks the objective reached",()=>{
    const state=omegaDailyObjective(540);
    expect(state.progress).toBe(100);
    expect(state.remaining).toBe(0);
    expect(state.reached).toBe(true);
    expect(state.mode).toBe("PROTECT_AND_EXTEND");
  });
});