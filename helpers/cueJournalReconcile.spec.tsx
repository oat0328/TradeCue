import { classifyLegacyRows, type LegacyRow } from "./cueJournalReconcile";

const row = (id: string, quantity: number | null, exitOrderId: string | null, exitPrice: number | null = 102): LegacyRow =>
  ({ id, quantity, exitOrderId, exitPrice, exitTime: "2026-10-05T15:00:00Z" });

describe("cueJournalReconcile", () => {
  it("verifies a legacy close whose exit covered the full lot", () => {
    const out = classifyLegacyRows([row("1", 10, "S1")], new Map([["S1", { quantity: 10 }]]));
    expect(out[0].action).toBe("verify");
  });
  it("flags the audit's partial-exit case (2 of 10 shares closed the whole lot)", () => {
    const out = classifyLegacyRows([row("1", 10, "S1")], new Map([["S1", { quantity: 2 }]]));
    expect(out[0].action).toBe("needs_review");
  });
  it("flags one SELL reused for several lots", () => {
    const out = classifyLegacyRows([row("1", 5, "S1"), row("2", 5, "S1")], new Map([["S1", { quantity: 10 }]]));
    expect(out.every(d => d.action === "needs_review")).toBeTrue();
  });
  it("flags rows whose exit quantity or price is unknown instead of trusting them", () => {
    const out = classifyLegacyRows([row("1", 10, "S1"), row("2", 10, "S2", null), row("3", null, "S3")], new Map([["S2", { quantity: 10 }], ["S3", { quantity: 10 }]]));
    expect(out.map(d => d.action)).toEqual(["needs_review", "needs_review", "needs_review"]);
  });
});
