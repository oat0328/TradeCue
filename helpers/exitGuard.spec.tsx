import { exitGuardDecision, type ExitAttempt } from "./exitGuard";

const T = 1_000_000;
const att = (id: string, over: Partial<ExitAttempt>): ExitAttempt => ({
  intentId: id, status: "submitted", error: null, createdAt: T, updatedAt: T, broker: { kind: "found", status: "WORKING", filledQty: 0 }, ...over,
});

describe("exitGuard", () => {
  it("flat position needs nothing", () => {
    expect(exitGuardDecision({ heldQty: 0, attempts: [att("a", {})], now: T }).state).toBe("flat");
  });
  it("live exit at the broker is left alone (no retry, no alert)", () => {
    const d = exitGuardDecision({ heldQty: 10, attempts: [att("a", {})], now: T + 5_000 });
    expect(d.state).toBe("working");
    expect(d.alert).toBeFalse();
  });
  it("broker-confirmed REJECTED exit raises an alert and waits for the backoff", () => {
    const d = exitGuardDecision({ heldQty: 10, attempts: [att("a", { broker: { kind: "found", status: "REJECTED", filledQty: 0 } })], now: T + 10_000 });
    expect(d.state).toBe("backoff");
    expect(d.alert).toBeTrue();
    expect(d.nextAttemptNo).toBe(2);
    expect(d.retryOfIntentId).toBe("a");
    expect(d.intentStatusFix?.status).toBe("failed");
  });
  it("after the backoff a controlled retry is allowed", () => {
    const d = exitGuardDecision({ heldQty: 10, attempts: [att("a", { status: "failed", broker: { kind: "found", status: "REJECTED", filledQty: 0 } })], now: T + 61_000 });
    expect(d.state).toBe("retry_ready");
  });
  it("a placement failure confirmed absent at the broker counts as rejected", () => {
    const d = exitGuardDecision({ heldQty: 10, attempts: [att("a", { status: "failed", error: "insufficient", broker: { kind: "absent" } })], now: T + 61_000 });
    expect(d.state).toBe("retry_ready");
  });
  it("never retries when the first exit is not proven rejected", () => {
    const sent = exitGuardDecision({ heldQty: 10, attempts: [att("a", { status: "submitted", broker: { kind: "absent" } })], now: T + 10_000 });
    expect(sent.state).toBe("unconfirmed");
    expect(sent.nextAttemptNo).toBeNull();
    const unreachable = exitGuardDecision({ heldQty: 10, attempts: [att("a", { status: "failed", broker: { kind: "unknown" } })], now: T + 300_000 });
    expect(unreachable.state).toBe("unconfirmed");
    expect(unreachable.alert).toBeTrue();
  });
  it("an unconfirmed exit alerts after two minutes", () => {
    expect(exitGuardDecision({ heldQty: 10, attempts: [att("a", { status: "uncertain", broker: { kind: "absent" } })], now: T + 30_000 }).alert).toBeFalse();
    expect(exitGuardDecision({ heldQty: 10, attempts: [att("a", { status: "uncertain", broker: { kind: "absent" } })], now: T + 130_000 }).alert).toBeTrue();
  });
  it("a 'failed' intent whose order is actually live at the broker is corrected, not retried", () => {
    const d = exitGuardDecision({ heldQty: 10, attempts: [att("a", { status: "failed", broker: { kind: "found", status: "PENDING", filledQty: 0 } })], now: T + 90_000 });
    expect(d.state).toBe("working");
    expect(d.intentStatusFix?.status).toBe("submitted");
  });
  it("stops after the maximum attempts and demands manual action", () => {
    const rej = { status: "failed" as const, broker: { kind: "found" as const, status: "REJECTED", filledQty: 0 } };
    const d = exitGuardDecision({ heldQty: 10, attempts: [att("a", rej), att("b", rej), att("c", rej)], now: T + 999_000 });
    expect(d.state).toBe("exhausted");
    expect(d.alert).toBeTrue();
    expect(d.nextAttemptNo).toBeNull();
    expect(d.reason).toContain("UNPROTECTED");
  });
  it("a filled exit that leaves shares behind alerts for manual cleanup", () => {
    const d = exitGuardDecision({ heldQty: 0.2695, attempts: [att("a", { broker: { kind: "found", status: "FILLED", filledQty: 3 } })], now: T + 5_000 });
    expect(d.state).toBe("residual");
    expect(d.alert).toBeTrue();
  });
});
