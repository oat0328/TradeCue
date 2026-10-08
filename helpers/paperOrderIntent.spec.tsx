import { autoIntentId, canonicalOrderRequest, existingIntentStep, PENDING_MARKER, reservationBlock, unresolvedIntentStep, type ReservationInput } from "./paperOrderIntent";

const base: ReservationInput = {
  side: "BUY", symbol: "AAPL", quantity: 5, autoPaperEnabled: true, longOnly: true,
  heldQuantityBySymbol: {}, pendingBuySymbols: [], pendingSellQtyBySymbol: {},
  buysTodayCount: 0, maxTradesPerDay: 3, maxAutoPositions: 3,
};

describe("paperOrderIntent", () => {
  it("canonical request ignores symbol case and limit price on market orders", () => {
    const a = canonicalOrderRequest({ accountId: "A", symbol: "aapl", side: "BUY", orderType: "MARKET", quantity: 2, limitPrice: 9 });
    const b = canonicalOrderRequest({ accountId: "A", symbol: "AAPL", side: "BUY", orderType: "MARKET", quantity: 2 });
    expect(a).toBe(b);
    const c = canonicalOrderRequest({ accountId: "A", symbol: "AAPL", side: "BUY", orderType: "MARKET", quantity: 3 });
    expect(c).not.toBe(a);
  });

  it("an already-submitted intent is returned, never re-placed", () => {
    expect(existingIntentStep({ status: "submitted", requestHash: "h", error: null }, "h").kind).toBe("submitted");
  });

  it("reusing an id with different parameters is rejected", () => {
    expect(existingIntentStep({ status: "submitted", requestHash: "h1", error: null }, "h2").kind).toBe("mismatch");
  });

  it("failed intents are not retried automatically", () => {
    const step = existingIntentStep({ status: "failed", requestHash: "h", error: "rejected" }, "h");
    expect(step.kind).toBe("failed");
  });

  it("submitting and uncertain intents reconcile against the broker instead of placing again", () => {
    expect(existingIntentStep({ status: "submitting", requestHash: "h", error: null }, "h").kind).toBe("reconcile");
    expect(existingIntentStep({ status: "uncertain", requestHash: "h", error: null }, "h").kind).toBe("reconcile");
  });

  it("an unresolved intent stays pending during the grace window, then becomes uncertain", () => {
    expect(unresolvedIntentStep(10_000).status).toBe("submitting");
    const late = unresolvedIntentStep(120_000);
    expect(late.status).toBe("uncertain");
    expect(late.message).toContain(PENDING_MARKER);
  });

  it("two concurrent BUYs for the same symbol: the second sees the first reservation", () => {
    expect(reservationBlock(base)).toBeNull();
    expect(reservationBlock({ ...base, pendingBuySymbols: ["AAPL"], buysTodayCount: 1 })).toContain("already buying");
  });

  it("in-flight orders count toward the daily trade limit", () => {
    expect(reservationBlock({ ...base, autoPaperEnabled: false, buysTodayCount: 3 })).toContain("maximum trades");
  });

  it("in-flight BUYs count toward the automated position cap", () => {
    expect(reservationBlock({ ...base, symbol: "TSLA", heldQuantityBySymbol: { AAPL: 1 }, pendingBuySymbols: ["NVDA", "MSFT"] })).toContain("maximum automated positions");
  });

  it("concurrent exits cannot sell more than is held", () => {
    const sell = { ...base, side: "SELL" as const, quantity: 6, heldQuantityBySymbol: { AAPL: 10 } };
    expect(reservationBlock(sell)).toBeNull();
    expect(reservationBlock({ ...sell, pendingSellQtyBySymbol: { AAPL: 6 } })).toContain("Long-only");
  });

  it("automated intent ids are deterministic per proposal", () => {
    const a = autoIntentId(["acct", "BUY", "AAPL", "2026-10-05", 101.5, 99]);
    expect(a).toBe(autoIntentId(["acct", "BUY", "AAPL", "2026-10-05", 101.5, 99]));
    expect(a).not.toBe(autoIntentId(["acct", "BUY", "AAPL", "2026-10-05", 102, 99]));
    expect(/^auto-[0-9a-f]{16}$/.test(a)).toBeTrue();
  });
});
