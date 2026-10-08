// Pure decision logic for durable, idempotent paper-order intents (audit finding H-01).
// The endpoint persists an intent (with pre-generated broker ids) under a per-account lock
// BEFORE contacting the broker. A retry of the same intent never places a second order:
// it returns the recorded result, or reconciles against the broker by the stored id.

export type IntentStatus = "submitting" | "submitted" | "failed" | "uncertain";

export type OrderRequestShape = {
  accountId: string;
  symbol: string;
  side: "BUY" | "SELL";
  orderType: "MARKET" | "LIMIT";
  quantity: number;
  limitPrice?: number | null;
};

/** Stable text form of the order parameters; the server hashes this to detect id reuse with different params. */
export function canonicalOrderRequest(input: OrderRequestShape): string {
  return JSON.stringify([
    input.accountId,
    input.symbol.trim().toUpperCase(),
    input.side,
    input.orderType,
    Number(input.quantity),
    input.orderType === "LIMIT" && input.limitPrice != null ? Number(input.limitPrice) : null,
  ]);
}

/** Message fragment the client looks for to decide it may safely retry with the SAME intent id. */
export const PENDING_MARKER = "still pending";

export type ExistingIntentStep =
  | { kind: "mismatch"; message: string }
  | { kind: "submitted" }
  | { kind: "failed"; message: string }
  | { kind: "reconcile" };

export function existingIntentStep(
  intent: { status: IntentStatus; requestHash: string; error: string | null },
  requestHash: string,
): ExistingIntentStep {
  if (intent.requestHash !== requestHash) {
    return { kind: "mismatch", message: "This order attempt id was already used for a different order. Start a new order instead." };
  }
  if (intent.status === "submitted") return { kind: "submitted" };
  if (intent.status === "failed") {
    return { kind: "failed", message: "This order attempt was not accepted" + (intent.error ? ": " + intent.error : ".") + " Submit again to create a new order." };
  }
  return { kind: "reconcile" };
}

/** After reconciling a submitting/uncertain intent that the broker does not show. */
export function unresolvedIntentStep(ageMs: number, graceMs = 60_000): { status: IntentStatus; message: string } {
  if (ageMs < graceMs) {
    return { status: "submitting", message: "Order is " + PENDING_MARKER + " with Webull. Wait a moment and check Recent orders before trying again." };
  }
  return { status: "uncertain", message: "Order status is " + PENDING_MARKER + " / uncertain: Webull has no record of it yet. Check Recent orders before placing a new one." };
}

export type ReservationInput = {
  side: "BUY" | "SELL";
  symbol: string;
  quantity: number;
  autoPaperEnabled: boolean;
  longOnly: boolean;
  heldQuantityBySymbol: Record<string, number>; // broker snapshot
  pendingBuySymbols: string[]; // BUY intents reserved but not yet reflected as positions
  pendingSellQtyBySymbol: Record<string, number>; // SELL quantity reserved but not yet filled
  buysTodayCount: number; // distinct BUY orders today, including reserved intents
  maxTradesPerDay: number; // 0 = unlimited
  maxAutoPositions: number; // 0 = unlimited
};

/**
 * Limit checks that must see RESERVED (in-flight) orders, not just the broker snapshot.
 * Run inside the per-account lock so two concurrent requests cannot both pass.
 * Returns a block message, or null when the order may be reserved.
 */
export function reservationBlock(r: ReservationInput): string | null {
  const sym = r.symbol.trim().toUpperCase();
  if (r.side === "SELL") {
    if (!r.longOnly) return null;
    const held = r.heldQuantityBySymbol[sym] ?? 0;
    const reserved = r.pendingSellQtyBySymbol[sym] ?? 0;
    if (r.quantity > held - reserved + 1e-9) {
      return "Long-only protection: SELL is exit-only and cannot exceed the shares currently held (including exits already in flight).";
    }
    return null;
  }
  if (r.maxTradesPerDay > 0 && r.buysTodayCount >= r.maxTradesPerDay) {
    return "Risk Firewall blocked this BUY: the maximum trades for today has been reached (in-flight orders included).";
  }
  if (r.autoPaperEnabled) {
    const held = Object.entries(r.heldQuantityBySymbol).filter(([, q]) => q > 0).map(([s]) => s);
    const exposure = new Set([...held, ...r.pendingBuySymbols.map(s => s.toUpperCase())]);
    if (exposure.has(sym)) {
      return "Portfolio Brain blocked this automated BUY: CUE already holds or is already buying " + sym + ".";
    }
    if (r.maxAutoPositions > 0 && exposure.size >= r.maxAutoPositions) {
      return "Portfolio Brain blocked this automated BUY: the maximum automated positions are already open or in flight.";
    }
  }
  return null;
}

/** Deterministic id so several tabs/loops proposing the same automated order share one intent. */
export function autoIntentId(parts: Array<string | number>): string {
  const raw = ["auto", ...parts].join("|");
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < raw.length; i++) {
    const c = raw.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 ^ c, 2246822519) >>> 0;
  }
  return "auto-" + h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

export function newIntentId(): string {
  const c = (globalThis as any).crypto;
  if (c?.randomUUID) return "ui-" + c.randomUUID().replace(/-/g, "");
  return "ui-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
}
  123