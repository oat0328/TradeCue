import { allocateExitFill, parseNum, summarizeLot, type LotState } from "./cueLotLedger";

function lot(id: number, qty: number, entry = 100, risk: number | null = 10): LotState {
  return { id, entryPrice: entry, quantity: qty, plannedRisk: risk, exitFills: [] };
}

describe("cueLotLedger", () => {
  it("keeps null as unknown instead of 0", () => {
    expect(parseNum(null)).toBeNull();
    expect(parseNum(undefined)).toBeNull();
    expect(parseNum("")).toBeNull();
    expect(parseNum("abc")).toBeNull();
    expect(parseNum("0")).toBe(0);
    expect(parseNum("101.5")).toBe(101.5);
  });

  it("partial exit leaves the remaining shares open (audit T15 scenario)", () => {
    const { results } = allocateExitFill([lot(1, 10)], { fillId: "s1", qty: 2, price: 102, time: "2026-10-05T14:00:00Z" }, new Set());
    expect(results.length).toBe(1);
    expect(results[0].closed).toBeFalse();
    expect(results[0].remainingQty).toBe(8);
    expect(results[0].realizedPnl).toBeCloseTo(4, 6);
    expect(results[0].outcome).toBeNull();
  });

  it("closes the lot only when all shares are sold and computes full P/L and R", () => {
    const l = lot(1, 10);
    const first = allocateExitFill([l], { fillId: "s1", qty: 2, price: 102, time: "2026-10-05T14:00:00Z" }, new Set()).results[0];
    l.exitFills = first.exitFills;
    const second = allocateExitFill([l], { fillId: "s2", qty: 8, price: 99, time: "2026-10-05T15:00:00Z" }, new Set(["s1"])).results[0];
    expect(second.closed).toBeTrue();
    expect(second.remainingQty).toBe(0);
    expect(second.realizedPnl).toBeCloseTo(4 - 8, 6);
    expect(second.realizedR).toBeCloseTo(-0.4, 6);
    expect(second.outcome).toBe("LOSS");
    expect(second.avgExitPrice).toBeCloseTo((2 * 102 + 8 * 99) / 10, 6);
  });

  it("never consumes the same SELL fill twice", () => {
    const out = allocateExitFill([lot(1, 10), lot(2, 5)], { fillId: "s1", qty: 3, price: 105, time: "2026-10-05T14:00:00Z" }, new Set(["s1"]));
    expect(out.skipped).toBeTrue();
    expect(out.results.length).toBe(0);
  });

  it("allocates FIFO across lots and reports unallocated shares", () => {
    const out = allocateExitFill([lot(1, 3), lot(2, 4)], { fillId: "s1", qty: 9, price: 101, time: "2026-10-05T14:00:00Z" }, new Set());
    expect(out.results.map(r => r.id)).toEqual([1, 2]);
    expect(out.results[0].closed).toBeTrue();
    expect(out.results[1].closed).toBeTrue();
    expect(out.unallocatedQty).toBeCloseTo(2, 6);
  });

  it("handles fractional quantities without leaving phantom residue", () => {
    const out = allocateExitFill([lot(1, 3.2695)], { fillId: "s1", qty: 3.2695, price: 110, time: "2026-10-05T14:00:00Z" }, new Set());
    expect(out.results[0].closed).toBeTrue();
    expect(out.results[0].realizedPnl).toBeCloseTo(32.695, 6);
  });

  it("skips lots with unknown entry price or quantity rather than guessing", () => {
    const unknown: LotState = { id: 9, entryPrice: null, quantity: 5, plannedRisk: null, exitFills: [] };
    const out = allocateExitFill([unknown, lot(2, 5)], { fillId: "s1", qty: 5, price: 101, time: "2026-10-05T14:00:00Z" }, new Set());
    expect(out.results.map(r => r.id)).toEqual([2]);
    expect(summarizeLot(unknown).closed).toBeFalse();
  });
});
   66