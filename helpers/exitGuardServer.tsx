// Backend: gathers broker + database evidence for Axiom automated exits, applies the exitGuard
// decision (status corrections, alerts) and returns per-symbol guidance. Never places orders.
import { sql } from "kysely";
import { db } from "./db";
import { webullSnapshot, webullTodayOrders, type WebullKeys } from "./webullClient";
import { exitGuardDecision, type BrokerView, type ExitAttempt, type ExitGuardDecision } from "./exitGuard";
import { autoIntentId } from "./paperOrderIntent";
import { stopProtection } from "./stopProtection";

export type ExitGuardRow = ExitGuardDecision & { symbol: string; heldQty: number; nextIntentId: string | null };
export type ExitAlertView = { id: string; symbol: string; state: string; reason: string; attempts: number; updatedAt: string; createdAt: string };

export function ptDayKey(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
export function exitRetryIntentId(accountId: string, symbol: string, day: string, attemptNo: number) {
  return autoIntentId([accountId, "SELL", symbol.toUpperCase(), day, "retry", attemptNo]);
}

export async function evaluateExitGuard(userId: number, keys: WebullKeys, accountId: string, opts: { onlySymbol?: string; persist?: boolean } = {}) {
  const persist = opts.persist ?? true;
  const day = ptDayKey();
  const since = new Date(Date.now() - 36 * 3600_000);
  let q = db.selectFrom("paperOrderIntents").selectAll()
    .where("userId", "=", userId).where("accountId", "=", accountId).where("side", "=", "SELL")
    .where("createdAt", ">=", since);
  if (opts.onlySymbol) q = q.where("symbol", "=", opts.onlySymbol.toUpperCase());
  const intents = (await q.orderBy("createdAt", "asc").execute()).filter(r => {
    const purpose=(r.context as any)?.purpose;
    return (purpose==="auto-exit"||purpose==="auto-cleanup") && ptDayKey(new Date(r.createdAt))===day;
  });

  const protectedBuys = await db.selectFrom("paperOrderIntents").selectAll()
    .where("userId", "=", userId).where("accountId", "=", accountId).where("side", "=", "BUY")
    .where("status", "!=", "failed").execute();
  let brokerOrders: Awaited<ReturnType<typeof webullTodayOrders>> | null = null;
  try { brokerOrders = await webullTodayOrders(keys, accountId); } catch { brokerOrders = null; }
  const snapshot = await webullSnapshot(keys, accountId);
  const held = new Map<string, number>();
  for (const p of snapshot.positions) {
    const qn = Number(p.quantity ?? 0);
    if (Number.isFinite(qn)) held.set(p.symbol.toUpperCase(), (held.get(p.symbol.toUpperCase()) ?? 0) + qn);
  }

  let openAlerts = await db.selectFrom("cueExitAlerts").selectAll()
    .where("userId", "=", userId).where("accountId", "=", accountId).where("status", "=", "open").execute();
  const symbols = new Set<string>([...held.keys(), ...intents.map(i => i.symbol.toUpperCase()), ...protectedBuys.map(i => i.symbol.toUpperCase()), ...openAlerts.map(a => a.symbol.toUpperCase())]);
  if (opts.onlySymbol) { symbols.clear(); symbols.add(opts.onlySymbol.toUpperCase()); }

  const now = Date.now();
  const rows: ExitGuardRow[] = [];
  for (const symbol of symbols) {
    const attempts: ExitAttempt[] = intents.filter(i => i.symbol.toUpperCase() === symbol).map(i => {
      let broker: BrokerView;
      if (!brokerOrders) broker = { kind: "unknown" };
      else {
        const o = brokerOrders.find(b => b.clientOrderId === i.clientOrderId);
        broker = o ? { kind: "found", status: o.status, filledQty: o.filledQuantity != null ? Number(o.filledQuantity) : null } : { kind: "absent" };
      }
      return { intentId: i.intentId, status: i.status, error: i.error, createdAt: new Date(i.createdAt).getTime(), updatedAt: new Date(i.updatedAt).getTime(), broker };
    });
    const heldQty = held.get(symbol) ?? 0;
    let d = exitGuardDecision({ heldQty, attempts, now });
    const buys = protectedBuys.filter(i => i.symbol.toUpperCase() === symbol);
    if (heldQty > 0 || buys.length) {
      const stopIds = new Set<string>();
      for (const buy of buys) {
        const ctx = buy.context as unknown as { bracket?: { childOrderIds?: { stop?: string } } };
        if (ctx?.bracket?.childOrderIds?.stop) stopIds.add(ctx.bracket.childOrderIds.stop);
      }
      const stops = (brokerOrders ?? []).filter(o => stopIds.has(o.clientOrderId) || (o.symbol.toUpperCase()===symbol && o.side.toUpperCase()==="SELL" && ["STOP","STOPLOSS","STOPLIMIT"].includes(o.orderType.toUpperCase().replace(/[^A-Z]/g,"")))).map(o => ({
        status: o.status, quantity: o.quantity == null ? null : Number(o.quantity),
        filledQty: o.filledQuantity == null ? null : Number(o.filledQuantity),
      }));
      const protection = stopProtection({ heldQty, brokerReachable: brokerOrders != null, stops });
      if (protection.alert) d = { ...d, alert: true, reason: protection.reason + (d.alert ? " " + d.reason : "") };
    }
    const nextIntentId = d.nextAttemptNo ? exitRetryIntentId(accountId, symbol, day, d.nextAttemptNo) : null;
    rows.push({ ...d, symbol, heldQty, nextIntentId });

    if (!persist) continue;
    if (d.intentStatusFix) {
      const fix = d.intentStatusFix;
      const intent = intents.find(i => i.intentId === fix.intentId)!;
      await db.updateTable("paperOrderIntents").set({ status: fix.status, error: fix.error, updatedAt: new Date() }).where("id", "=", intent.id).execute();
      const o = brokerOrders?.find(b => b.clientOrderId === intent.clientOrderId);
      if (o) await db.updateTable("paperOrders").set({ status: o.status, updatedAt: new Date() }).where("clientOrderId", "=", intent.clientOrderId).execute();
    }
    const existing = openAlerts.find(a => a.symbol.toUpperCase() === symbol);
    if (d.alert) {
      const last = attempts.at(-1)?.intentId ?? null;
      if (existing) {
        await db.updateTable("cueExitAlerts").set({ state: d.state, reason: d.reason, attempts: d.attempts, lastIntentId: last, updatedAt: new Date() }).where("id", "=", existing.id).execute();
      } else {
        await db.insertInto("cueExitAlerts").values({ userId, accountId, symbol, state: d.state, reason: d.reason, attempts: d.attempts, lastIntentId: last })
          .onConflict(oc => oc.columns(["userId", "accountId", "symbol"]).where("status", "=", "open").doUpdateSet({ state: d.state, reason: d.reason, attempts: d.attempts, lastIntentId: last, updatedAt: new Date() }))
          .execute();
        await db.insertInto("cueAuditLog").values({ userId, action: "auto_exit_alert_opened", entityType: "exit_alert", entityId: symbol, details: { accountId, state: d.state, reason: d.reason, attempts: d.attempts } }).execute();
      }
    } else if (existing && (d.state === "flat" || brokerOrders != null)) {
      await db.updateTable("cueExitAlerts").set({ status: "resolved", state: d.state, reason: d.reason, resolvedAt: new Date(), updatedAt: new Date() }).where("id", "=", existing.id).execute();
    }
  }
  if (persist) {
    openAlerts = await db.selectFrom("cueExitAlerts").selectAll()
      .where("userId", "=", userId).where("accountId", "=", accountId).where("status", "=", "open").execute();
  }
  const alerts: ExitAlertView[] = openAlerts.map(a => ({ id: String(a.id), symbol: a.symbol, state: a.state, reason: a.reason, attempts: a.attempts, updatedAt: new Date(a.updatedAt).toISOString(), createdAt: new Date(a.createdAt).toISOString() }));
  return { rows, alerts, brokerReachable: brokerOrders != null };
}

