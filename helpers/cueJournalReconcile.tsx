// Reconciliation of journal rows closed by the pre-ledger code (audit H-02 follow-up).
// The old code closed the WHOLE lot on any SELL and could reuse one SELL for several lots, so
// a legacy "closed" row is only trusted if its exit order is known to cover the full quantity
// and was used once. Everything else becomes status "needs_review", which the learning stats
// exclude (they read status = "closed" only). Dry-run by default.

export type LegacyRow = { id: string; quantity: number | null; exitOrderId: string | null; exitPrice: number | null; exitTime: string | null };
export type ExitOrderInfo = { quantity: number | null } | null;

export type ReconcileDecision =
  | { id: string; action: "verify"; exitQty: number }
  | { id: string; action: "needs_review"; reason: string };

export function classifyLegacyRows(rows: LegacyRow[], exitOrders: Map<string, ExitOrderInfo>): ReconcileDecision[] {
  const uses = new Map<string, number>();
  for (const r of rows) if (r.exitOrderId) uses.set(r.exitOrderId, (uses.get(r.exitOrderId) ?? 0) + 1);
  return rows.map(r => {
    if (!r.exitOrderId) return { id: r.id, action: "needs_review", reason: "Closed without an exit order id." };
    if ((uses.get(r.exitOrderId) ?? 0) > 1) return { id: r.id, action: "needs_review", reason: "The same SELL (" + r.exitOrderId + ") closed more than one lot." };
    if (r.quantity == null || !(r.quantity > 0)) return { id: r.id, action: "needs_review", reason: "Entry quantity unknown." };
    if (r.exitPrice == null) return { id: r.id, action: "needs_review", reason: "Exit price unknown." };
    const exit = exitOrders.get(r.exitOrderId);
    if (!exit || exit.quantity == null) return { id: r.id, action: "needs_review", reason: "Exit order quantity unknown, so a partial exit cannot be ruled out." };
    if (exit.quantity + 1e-6 < r.quantity) {
      return { id: r.id, action: "needs_review", reason: "Partial exit closed the whole lot: sold " + exit.quantity + " of " + r.quantity + " shares." };
    }
    return { id: r.id, action: "verify", exitQty: r.quantity };
  });
}
