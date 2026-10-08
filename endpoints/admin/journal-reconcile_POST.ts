import superjson from "superjson";
import { apiUser, apiJson, apiFailure } from "../../helpers/apiAccess";
import { db } from "../../helpers/db";
import { parseNum } from "../../helpers/cueLotLedger";
import { classifyLegacyRows, type ExitOrderInfo } from "../../helpers/cueJournalReconcile";
import { rebuildLearningForUser } from "../../helpers/cueJournalBrain";
import { schema, type OutputType } from "./journal-reconcile_POST.schema";

// Owner-only. Reviews journal rows closed by the pre-ledger code (closed, with no allocation in
// cue_journal_exit_fills). Dry run unless {apply:true}. Applying marks unverifiable rows
// "needs_review" (excluded from learning stats), migrates verified rows into the fill ledger,
// and rebuilds the learning profiles of affected users.
export async function handle(request: Request) {
  try {
    await apiUser(request, true);
    const input = schema.parse(superjson.parse((await request.text()) || superjson.stringify({})));

    const legacy = await db.selectFrom("cueTradeJournal as j")
      .select(["j.id", "j.userId", "j.accountId", "j.symbol", "j.quantity", "j.exitOrderId", "j.exitPrice", "j.exitTime"])
      .where("j.status", "=", "closed")
      .where(eb => eb.not(eb.exists(eb.selectFrom("cueJournalExitFills as f").select("f.id").whereRef("f.journalId", "=", "j.id"))))
      .execute();

    const exitIds = [...new Set(legacy.map(r => r.exitOrderId).filter((v): v is string => !!v))];
    const orders = exitIds.length
      ? await db.selectFrom("paperOrders").select(["userId", "clientOrderId", "brokerOrderId", "quantity"])
          .where(eb => eb.or([eb("clientOrderId", "in", exitIds), eb("brokerOrderId", "in", exitIds)])).execute()
      : [];

    const byUser = new Map<number, typeof legacy>();
    for (const r of legacy) byUser.set(r.userId, [...(byUser.get(r.userId) ?? []), r]);

    const out: OutputType = { applied: input.apply, legacyRowsReviewed: legacy.length, verified: 0, needsReview: [], learningRebuiltForUsers: [] };
    for (const [userId, rows] of byUser) {
      const exitMap = new Map<string, ExitOrderInfo>();
      for (const o of orders.filter(o => o.userId === userId)) {
        const info = { quantity: parseNum(o.quantity) };
        exitMap.set(o.clientOrderId, info);
        if (o.brokerOrderId) exitMap.set(o.brokerOrderId, info);
      }
      const decisions = classifyLegacyRows(rows.map(r => ({
        id: String(r.id), quantity: parseNum(r.quantity), exitOrderId: r.exitOrderId, exitPrice: parseNum(r.exitPrice),
        exitTime: r.exitTime ? new Date(r.exitTime).toISOString() : null,
      })), exitMap);

      for (const d of decisions) {
        const r = rows.find(x => String(x.id) === d.id)!;
        if (d.action === "verify") out.verified++;
        else out.needsReview.push({ id: d.id, userId, symbol: r.symbol, reason: d.reason });
        if (!input.apply) continue;
        await db.transaction().execute(async trx => {
          const current = await trx.selectFrom("cueTradeJournal").select(["details", "status"]).where("id", "=", d.id).executeTakeFirstOrThrow();
          if (current.status !== "closed") return;
          const details = { ...((current.details && typeof current.details === "object" && !Array.isArray(current.details)) ? current.details as Record<string, unknown> : {}) };
          if (d.action === "verify") {
            await trx.insertInto("cueJournalExitFills").values({
              userId, accountId: r.accountId, journalId: d.id, fillId: r.exitOrderId!, qty: String(d.exitQty),
              price: String(parseNum(r.exitPrice)), priceSource: "legacy-verified", filledAt: r.exitTime ? new Date(r.exitTime) : new Date(),
            }).onConflict(oc => oc.columns(["userId", "accountId", "fillId", "journalId"]).doNothing()).execute();
            await trx.insertInto("cueJournalProcessedFills").values({
              userId, accountId: r.accountId, fillId: r.exitOrderId!, symbol: r.symbol, qty: String(d.exitQty), allocatedQty: String(d.exitQty),
            }).onConflict(oc => oc.columns(["userId", "accountId", "fillId"]).doNothing()).execute();
            await trx.updateTable("cueTradeJournal").set({ details: { ...details, lotPolicy: "LEGACY_VERIFIED" } as any, updatedAt: new Date() }).where("id", "=", d.id).execute();
          } else {
            await trx.updateTable("cueTradeJournal").set({
              status: "needs_review",
              details: { ...details, reconcile: { reason: d.reason, at: new Date().toISOString(), previousStatus: "closed" } } as any,
              updatedAt: new Date(),
            }).where("id", "=", d.id).execute();
          }
        });
      }
      if (input.apply) { await rebuildLearningForUser(userId); out.learningRebuiltForUsers.push(userId); }
    }
    return apiJson(out);
  } catch (error) {
    return apiFailure(error);
  }
}