import { processSellFill, type JournalLotRow, type SellFillInput, type SellSyncStore, type SellSyncTx, type StoredExitFill } from "./cueJournalSellSync";

// In-memory store that mimics the Postgres behaviour the production store relies on:
// - transactions buffer writes and apply them only on commit (rollback discards them)
// - lockKey() is held until commit/rollback (pg_advisory_xact_lock)
// - claimFill() is a PRIMARY KEY insert: a concurrent claimer of the same fill waits for the
//   first transaction to finish, then sees the committed row and gets false
// Random awaits between steps force the two "sync runs" to interleave.
function sleep() { return new Promise(r => setTimeout(r, Math.floor(Math.random() * 4))); }

class MemDb {
  lots = new Map<string, JournalLotRow>();
  fills: StoredExitFill[] = [];
  claims = new Set<string>();
  pendingClaims = new Map<string, Promise<void>>();
  locks = new Map<string, Promise<void>>();
  useLock = true;
  inFlight = 0;
  maxInFlightInsideLock = 0;

  store(): SellSyncStore {
    return {
      transaction: async <T,>(fn: (tx: SellSyncTx) => Promise<T>) => {
        const writes: Array<() => void> = [];
        const release: Array<() => void> = [];
        let locked = false;
        const tx: SellSyncTx = {
          lockKey: async key => {
            await sleep();
            if (!this.useLock) return;
            while (this.locks.has(key)) await this.locks.get(key);
            let done!: () => void;
            this.locks.set(key, new Promise<void>(r => (done = r)));
            release.push(() => { this.locks.delete(key); done(); });
            locked = true;
            this.inFlight++;
            this.maxInFlightInsideLock = Math.max(this.maxInFlightInsideLock, this.inFlight);
            release.push(() => { this.inFlight--; });
          },
          claimFill: async f => {
            await sleep();
            while (this.pendingClaims.has(f.fillId)) await this.pendingClaims.get(f.fillId);
            if (this.claims.has(f.fillId)) return false;
            let done!: () => void;
            this.pendingClaims.set(f.fillId, new Promise<void>(r => (done = r)));
            release.push(() => { this.pendingClaims.delete(f.fillId); done(); });
            writes.push(() => this.claims.add(f.fillId));
            return true;
          },
          setClaimAllocated: async () => { await sleep(); },
          loadLots: async () => { await sleep(); return [...this.lots.values()].map(r => ({ ...r })); },
          loadExitFills: async ids => { await sleep(); return this.fills.filter(f => ids.includes(f.journalId)).map(f => ({ ...f })); },
          saveAllocation: async result => {
            await sleep();
            writes.push(() => {
              for (const piece of result.newFills) this.fills.push({ ...piece, journalId: String(result.id) });
              const lot = this.lots.get(String(result.id))!;
              if (result.closed) lot.status = "closed";
            });
          },
        };
        try {
          const out = await fn(tx);
          writes.forEach(w => w());
          return out;
        } finally {
          void locked;
          release.reverse().forEach(r => r());
        }
      },
    };
  }
  allocated(lotId: string) { return this.fills.filter(f => f.journalId === lotId).reduce((s, f) => s + f.qty, 0); }
}

function db(lots: Array<[string, number]>) {
  const m = new MemDb();
  for (const [id, qty] of lots) m.lots.set(id, { id, entryPrice: 100, quantity: qty, plannedRisk: 10, status: "open", exitOrderId: null });
  return m;
}
function sell(fillId: string, qty: number, price = 102): SellFillInput {
  return { userId: 1, accountId: "A", symbol: "AAPL", fillId, altIds: [], qty, price, time: "2026-10-05T14:00:00Z", priceSource: "filled" };
}

describe("cueJournalSellSync concurrency", () => {
  it("two overlapping sync runs never count the same sell twice", async () => {
    for (let round = 0; round < 25; round++) {
      const m = db([["1", 10]]);
      const [a, b] = await Promise.all([processSellFill(m.store(), sell("S1", 2)), processSellFill(m.store(), sell("S1", 2))]);
      expect([a.status, b.status].sort()).toEqual(["applied", "duplicate"]);
      expect(m.allocated("1")).toBe(2);
      expect(m.lots.get("1")!.status).toBe("open");
    }
  });

  it("the fill claim alone still blocks double counting if the lock were missing", async () => {
    for (let round = 0; round < 25; round++) {
      const m = db([["1", 10]]);
      m.useLock = false;
      const out = await Promise.all([processSellFill(m.store(), sell("S1", 2)), processSellFill(m.store(), sell("S1", 2))]);
      expect(out.filter(o => o.status === "applied").length).toBe(1);
      expect(m.allocated("1")).toBe(2);
    }
  });

  it("ten simultaneous runs of the same sell apply it exactly once", async () => {
    const m = db([["1", 10], ["2", 10]]);
    const out = await Promise.all(Array.from({ length: 10 }, () => processSellFill(m.store(), sell("S1", 12))));
    expect(out.filter(o => o.status === "applied").length).toBe(1);
    expect(m.allocated("1") + m.allocated("2")).toBe(12);
  });

  it("two different sells racing on one lot cannot over-allocate it", async () => {
    for (let round = 0; round < 25; round++) {
      const m = db([["1", 10]]);
      await Promise.all([processSellFill(m.store(), sell("S1", 6)), processSellFill(m.store(), sell("S2", 6))]);
      expect(m.allocated("1")).toBe(10);
      expect(m.lots.get("1")!.status).toBe("closed");
      expect(m.maxInFlightInsideLock).toBe(1);
    }
  });

  it("two-part exit: lot stays open after the first part and closes after the second", async () => {
    const m = db([["1", 10]]);
    const first = await processSellFill(m.store(), sell("S1", 2, 102));
    expect(first.status).toBe("applied");
    expect(m.lots.get("1")!.status).toBe("open");
    const second = await processSellFill(m.store(), sell("S2", 8, 99));
    expect(second.status).toBe("applied");
    expect(m.lots.get("1")!.status).toBe("closed");
    if (second.status === "applied") {
      expect(second.results[0].realizedPnl).toBeCloseTo(4 - 8, 6);
      expect(second.results[0].realizedR).toBeCloseTo(-0.4, 6);
    }
    // re-running both syncs later changes nothing
    expect((await processSellFill(m.store(), sell("S1", 2, 102))).status).toBe("duplicate");
    expect((await processSellFill(m.store(), sell("S2", 8, 99))).status).toBe("duplicate");
    expect(m.allocated("1")).toBe(10);
  });

  it("a sell with no open lot is not consumed, so a later sync can still apply it", async () => {
    const m = db([]);
    expect((await processSellFill(m.store(), sell("S1", 5))).status).toBe("no-open-lot");
    expect(m.claims.has("S1")).toBeFalse();
    m.lots.set("1", { id: "1", entryPrice: 100, quantity: 5, plannedRisk: 5, status: "open", exitOrderId: null });
    expect((await processSellFill(m.store(), sell("S1", 5))).status).toBe("applied");
  });

  it("a sell already used by the old journal code is treated as a duplicate", async () => {
    const m = db([["1", 10]]);
    m.lots.get("1")!.status = "closed";
    m.lots.get("1")!.exitOrderId = "CLIENT-1";
    m.lots.set("2", { id: "2", entryPrice: 100, quantity: 10, plannedRisk: 10, status: "open", exitOrderId: null });
    const out = await processSellFill(m.store(), { ...sell("BROKER-9", 10), altIds: ["CLIENT-1"] });
    expect(out.status).toBe("duplicate");
    expect(m.allocated("2")).toBe(0);
  });
});
