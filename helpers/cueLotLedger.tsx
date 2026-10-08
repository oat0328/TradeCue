// Pure lot-accounting logic for the CUE trade journal (audit finding H-02).
// Lot policy: FIFO — a SELL fill is allocated to the OLDEST open lot first and may span lots.
// Each broker exit fill is consumed exactly once (keyed by fill id), partial exits leave the
// remaining quantity open, and unknown values stay unknown (null) instead of becoming 0.

export const QTY_EPSILON = 1e-6;

export type ExitFill = { fillId: string; qty: number; price: number; time: string };

export type LotState = {
  id: string | number;
  entryPrice: number | null;
  quantity: number | null; // original filled entry quantity
  plannedRisk: number | null;
  exitFills: ExitFill[];
};

export type LotResult = {
  id: string | number;
  newFills: ExitFill[];
  exitFills: ExitFill[];
  filledExitQty: number;
  remainingQty: number;
  realizedPnl: number;
  avgExitPrice: number | null;
  realizedR: number | null;
  closed: boolean;
  outcome: "WIN" | "LOSS" | "BREAKEVEN" | null;
  lastExitTime: string | null;
};

/** Number parser that keeps null/blank/garbage as null (the old helper turned null into 0). */
export function parseNum(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function summarizeLot(lot: LotState, newFills: ExitFill[] = []): LotResult {
  const exitFills = [...lot.exitFills, ...newFills];
  const filledExitQty = exitFills.reduce((s, f) => s + f.qty, 0);
  const qty = lot.quantity ?? 0;
  const remainingQty = Math.max(0, qty - filledExitQty);
  const entry = lot.entryPrice;
  const realizedPnl = entry == null ? 0 : exitFills.reduce((s, f) => s + (f.price - entry) * f.qty, 0);
  const avgExitPrice = filledExitQty > QTY_EPSILON ? exitFills.reduce((s, f) => s + f.price * f.qty, 0) / filledExitQty : null;
  const closed = qty > QTY_EPSILON && remainingQty <= QTY_EPSILON;
  const realizedR = lot.plannedRisk && lot.plannedRisk > 0 && entry != null ? realizedPnl / lot.plannedRisk : null;
  const outcome = closed ? (realizedPnl > 0.005 ? "WIN" : realizedPnl < -0.005 ? "LOSS" : "BREAKEVEN") : null;
  const lastExitTime = exitFills.length ? [...exitFills].sort((a, b) => Date.parse(a.time) - Date.parse(b.time)).at(-1)!.time : null;
  return { id: lot.id, newFills, exitFills, filledExitQty, remainingQty: closed ? 0 : remainingQty, realizedPnl, avgExitPrice, realizedR, closed, outcome, lastExitTime };
}

/**
 * Allocate one SELL fill across open lots (FIFO). Lots must be passed oldest-first.
 * Returns per-lot results for lots that received quantity, plus any unallocated remainder
 * (e.g. shares that were never opened by TradeCUE). Returns null allocations if this fill
 * id was already consumed by any lot.
 */
export function allocateExitFill(lots: LotState[], fill: ExitFill, consumedFillIds: Set<string>) {
  if (consumedFillIds.has(fill.fillId) || !(fill.qty > QTY_EPSILON) || !Number.isFinite(fill.price)) {
    return { results: [] as LotResult[], unallocatedQty: 0, skipped: true };
  }
  let remaining = fill.qty;
  const results: LotResult[] = [];
  for (const lot of lots) {
    if (remaining <= QTY_EPSILON) break;
    if (lot.entryPrice == null || lot.quantity == null || lot.quantity <= QTY_EPSILON) continue;
    const current = summarizeLot(lot);
    if (current.closed || current.remainingQty <= QTY_EPSILON) continue;
    const alloc = Math.min(current.remainingQty, remaining);
    const piece: ExitFill = { ...fill, qty: alloc };
    results.push(summarizeLot(lot, [piece]));
    remaining -= alloc;
  }
  return { results, unallocatedQty: remaining > QTY_EPSILON ? remaining : 0, skipped: false };
}
