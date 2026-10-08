// Protective-exit guard for Axiom automated SELLs.
// A rejected exit must never silently leave a position open. For each held symbol with an
// automated exit attempt today, decide from BROKER evidence whether the last attempt is still
// working, filled, confirmed rejected, or unconfirmed — and only allow a retry after a confirmed
// rejection, with a backoff and a hard cap. Anything that needs a human raises an alert.

export const MAX_EXIT_ATTEMPTS = 3;
export const EXIT_RETRY_BACKOFF_MS = 60_000;
export const UNCONFIRMED_ALERT_MS = 120_000;

export type BrokerView =
  | { kind: "found"; status: string; filledQty: number | null }
  | { kind: "absent" } // lookup succeeded and the order is not at the broker
  | { kind: "unknown" }; // lookup failed

export type ExitAttempt = {
  intentId: string;
  status: "submitting" | "submitted" | "failed" | "uncertain";
  error: string | null;
  createdAt: number;
  updatedAt: number;
  broker: BrokerView;
};

export type ExitGuardState =
  | "flat" // no shares held: nothing to protect
  | "none" // held, no automated exit attempted today
  | "working" // exit order live at the broker
  | "filled" // last exit filled (and nothing remains)
  | "residual" // last exit filled but shares remain
  | "unconfirmed" // cannot yet prove what happened to the last exit
  | "backoff" // confirmed rejected; waiting before the next attempt
  | "retry_ready" // confirmed rejected; a controlled retry may be sent now
  | "exhausted"; // confirmed rejected MAX times; manual action required

export type ExitGuardDecision = {
  state: ExitGuardState;
  attempts: number;
  nextAttemptNo: number | null;
  retryOfIntentId: string | null;
  retryAt: number | null;
  alert: boolean;
  reason: string;
  /** Corrections to stored intent status implied by broker evidence. */
  intentStatusFix: { intentId: string; status: "submitted" | "failed"; error: string | null } | null;
};

function norm(s: string) { return String(s || "").toUpperCase().replace(/[^A-Z]/g, ""); }
export function isDeadBrokerStatus(s: string) { const n = norm(s); return n.includes("CANCEL") || n.includes("REJECT") || ["FAILED", "EXPIRED"].includes(n); }
export function isFilledBrokerStatus(s: string) { return ["FILLED", "FINALFILLED", "COMPLETED"].includes(norm(s)); }

type Classified = { outcome: "working" | "filled" | "rejected" | "unconfirmed"; detail: string; fix: ExitGuardDecision["intentStatusFix"] };

export function classifyAttempt(a: ExitAttempt, now: number): Classified {
  if (a.broker.kind === "found") {
    const st = a.broker.status;
    if (isFilledBrokerStatus(st)) return { outcome: "filled", detail: "Webull filled the exit.", fix: a.status !== "submitted" ? { intentId: a.intentId, status: "submitted", error: null } : null };
    if (isDeadBrokerStatus(st)) {
      if ((a.broker.filledQty ?? 0) > 0) return { outcome: "filled", detail: "Webull partly filled, then ended the exit (" + st + ").", fix: null };
      return { outcome: "rejected", detail: "Webull reports the exit as " + st + ".", fix: a.status !== "failed" ? { intentId: a.intentId, status: "failed", error: "Webull status " + st } : null };
    }
    return { outcome: "working", detail: "Exit order is live at Webull (" + st + ").", fix: a.status === "failed" ? { intentId: a.intentId, status: "submitted", error: null } : null };
  }
  if (a.broker.kind === "absent") {
    if (a.status === "failed") return { outcome: "rejected", detail: "Exit was not accepted" + (a.error ? ": " + a.error : "") + ". Webull has no record of it.", fix: null };
    // submitted/submitting/uncertain but Webull has nothing: not proven rejected yet
    const old = now - a.createdAt >= UNCONFIRMED_ALERT_MS;
    return { outcome: "unconfirmed", detail: old ? "Exit was sent but Webull still has no record of it." : "Exit is being confirmed with Webull.", fix: null };
  }
  return { outcome: "unconfirmed", detail: "Webull could not be reached to confirm the exit.", fix: null };
}

export function exitGuardDecision(input: {
  heldQty: number;
  attempts: ExitAttempt[]; // today's automated exit attempts for the symbol, oldest first
  now: number;
  maxAttempts?: number;
  backoffMs?: number;
}): ExitGuardDecision {
  const max = input.maxAttempts ?? MAX_EXIT_ATTEMPTS;
  const backoff = input.backoffMs ?? EXIT_RETRY_BACKOFF_MS;
  const n = input.attempts.length;
  const base = { attempts: n, nextAttemptNo: null, retryOfIntentId: null, retryAt: null, intentStatusFix: null } as const;
  if (!(input.heldQty > 1e-9)) return { ...base, state: "flat", alert: false, reason: "No shares held." };
  if (!n) return { ...base, state: "none", alert: false, reason: "No automated exit attempted today." };

  const last = input.attempts[n - 1];
  const c = classifyAttempt(last, input.now);
  const fix = c.fix;
  if (c.outcome === "working") return { ...base, intentStatusFix: fix, state: "working", alert: false, reason: c.detail };
  if (c.outcome === "filled") {
    return { ...base, intentStatusFix: fix, state: "residual", alert: true, reason: c.detail + " " + input.heldQty + " share(s) still held — exit the remainder manually." };
  }
  if (c.outcome === "unconfirmed") {
    const alert = input.now - last.createdAt >= UNCONFIRMED_ALERT_MS || last.broker.kind === "unknown";
    return { ...base, intentStatusFix: fix, state: "unconfirmed", alert, reason: c.detail + " No retry until Webull confirms the first exit was rejected." };
  }
  // confirmed rejected
  if (n >= max) {
    return { ...base, intentStatusFix: fix, state: "exhausted", alert: true, reason: c.detail + " Automatic retries used (" + n + "/" + max + "). POSITION UNPROTECTED — exit manually." };
  }
  const retryAt = last.updatedAt + backoff;
  if (input.now < retryAt) {
    return { ...base, intentStatusFix: fix, state: "backoff", alert: true, retryAt, nextAttemptNo: n + 1, retryOfIntentId: last.intentId, reason: c.detail + " Retry " + (n + 1) + "/" + max + " scheduled." };
  }
  return { ...base, intentStatusFix: fix, state: "retry_ready", alert: true, retryAt, nextAttemptNo: n + 1, retryOfIntentId: last.intentId, reason: c.detail + " Sending controlled retry " + (n + 1) + "/" + max + "." };
}
