// Concurrency-safe application of one broker SELL fill to the trade journal (audit H-02 follow-up).
// Storage-agnostic so the exact same code runs against Postgres in production and an in-memory
// store in tests. Two independent guarantees prevent a sell from being counted twice when sync
// runs overlap:
//   1. lockKey(): a per (user, account, symbol) lock held for the whole transaction, so lot state
//      is read and written by one run at a time (Postgres: pg_advisory_xact_lock).
//   2. claimFill(): an insert into a table whose PRIMARY KEY is (user, account, fill id). A second
//      run claiming the same fill gets false (Postgres blocks it until the first commits, then the
//      ON CONFLICT DO NOTHING returns no row) and stops without touching any lot.
import { allocateExitFill, type ExitFill, type LotResult, type LotState } from "./cueLotLedger";

export type JournalLotRow = {
  id: string;
  entryPrice: number | null;
  quantity: number | null;
  plannedRisk: number | null;
  status: string;
  exitOrderId: string | null;
};

export type StoredExitFill = ExitFill & { journalId: string };

export interface SellSyncTx {
  lockKey(key: string): Promise<void>;
  /** true if this run now owns the fill; false if any run already processed it. */
  claimFill(fill: { fillId: string; qty: number; symbol: string }): Promise<boolean>;
  setClaimAllocated(fillId: string, allocatedQty: number): Promise<void>;
  /** All journal rows for the user/account/symbol, oldest entry first. */
  loadLots(): Promise<JournalLotRow[]>;
  loadExitFills(journalIds: string[]): Promise<StoredExitFill[]>;
  saveAllocation(result: LotResult, fill: ExitFill & { priceSource: string }): Promise<void>;
}

export interface SellSyncStore {
  /** Runs fn in one transaction; throwing rolls everything back. */
  transaction<T>(fn: (tx: SellSyncTx) => Promise<T>): Promise<T>;
}

export type SellFillInput = {
  userId: number;
  accountId: string;
  symbol: string;
  fillId: string;
  altIds: string[]; // other ids the same order may carry (client vs broker id), for legacy matching
  qty: number;
  price: number;
  time: string;
  priceSource: "filled" | "limit-estimate";
};

export type SellFillOutcome =
  | { status: "applied"; results: LotResult[]; unallocatedQty: number }
  | { status: "duplicate"; results: []; unallocatedQty: 0 }
  | { status: "no-open-lot"; results: []; unallocatedQty: number };

class NoOpenLot extends Error {}

export function sellLockKey(userId: number, accountId: string, symbol: string) {
  return "tradecue:journal:" + userId + ":" + accountId + ":" + symbol.toUpperCase();
}

export async function processSellFill(store: SellSyncStore, input: SellFillInput): Promise<SellFillOutcome> {
  try {
    return await store.transaction(async tx => {
      await tx.lockKey(sellLockKey(input.userId, input.accountId, input.symbol));
      const rows = await tx.loadLots();

      // Fills closed by the pre-ledger code carry the exit id on the journal row itself.
      const ids = new Set([input.fillId, ...input.altIds].filter(Boolean));
      if (rows.some(r => r.exitOrderId && ids.has(r.exitOrderId))) {
        await tx.claimFill({ fillId: input.fillId, qty: input.qty, symbol: input.symbol });
        return { status: "duplicate", results: [], unallocatedQty: 0 } as const;
      }
      if (!(await tx.claimFill({ fillId: input.fillId, qty: input.qty, symbol: input.symbol }))) {
        return { status: "duplicate", results: [], unallocatedQty: 0 } as const;
      }

      const open = rows.filter(r => r.status === "open");
      const fills = await tx.loadExitFills(open.map(r => r.id));
      const lots: LotState[] = open.map(r => ({
        id: r.id,
        entryPrice: r.entryPrice,
        quantity: r.quantity,
        plannedRisk: r.plannedRisk,
        exitFills: fills.filter(f => f.journalId === r.id).map(({ journalId: _j, ...f }) => f),
      }));
      const fill: ExitFill = { fillId: input.fillId, qty: input.qty, price: input.price, time: input.time };
      const { results, unallocatedQty } = allocateExitFill(lots, fill, new Set());
      if (!results.length) throw new NoOpenLot(String(unallocatedQty || input.qty)); // roll back the claim so a later sync can retry
      for (const result of results) await tx.saveAllocation(result, { ...fill, priceSource: input.priceSource });
      await tx.setClaimAllocated(input.fillId, input.qty - unallocatedQty);
      return { status: "applied", results, unallocatedQty } as const;
    });
  } catch (error) {
    if (error instanceof NoOpenLot) return { status: "no-open-lot", results: [], unallocatedQty: Number(error.message) };
    throw error;
  }
}
