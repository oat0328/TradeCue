import superjson from "superjson";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import {
  getPaperAccounts,
  getPaperBalance,
  getPaperPositions,
} from "../../helpers/webullPaperClient";

function normalizeRows(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["data", "items", "accounts"]) {
      const candidate = record[key];
      if (Array.isArray(candidate)) {
        return candidate.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
      }
    }
  }
  return [];
}

function str(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Owner access required", code: "OWNER_ONLY" }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
    }

    const url = new URL(request.url);
    const requestedAccountId = url.searchParams.get("account_id");
    const accountsRaw = await getPaperAccounts();
    const accountRows = normalizeRows(accountsRaw);
    const accounts = accountRows
      .map((row) => {
        const accountId = str(row, "account_id", "accountId", "id");
        if (!accountId) return null;
        const accountType = str(row, "account_type", "accountType", "type") || "UNKNOWN";
        return {
          accountId,
          accountMask: "••••" + accountId.slice(-4),
          accountType,
        };
      })
      .filter((row): row is { accountId: string; accountMask: string; accountType: string } => Boolean(row));

    const selected = requestedAccountId
      ? accounts.find((account) => account.accountId === requestedAccountId) ?? null
      : accounts.find((account) => account.accountType === "MARGIN")
        ?? accounts.find((account) => account.accountType === "CASH")
        ?? accounts[0]
        ?? null;

    let balance: unknown = null;
    let positions: unknown[] = [];

    if (selected) {
      const [balanceRaw, positionsRaw] = await Promise.all([
        getPaperBalance(selected.accountId),
        getPaperPositions(selected.accountId),
      ]);
      balance = balanceRaw;
      positions = normalizeRows(positionsRaw);
    }

    return new Response(
      superjson.stringify({
        connected: true,
        environment: "sandbox",
        accounts,
        selectedAccountId: selected?.accountId ?? null,
        balance,
        positions,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number((error as any).status) : 400;
    const payload = typeof error === "object" && error && "payload" in error ? (error as any).payload : null;
    const message =
      payload && typeof payload === "object" && typeof (payload as any).message === "string"
        ? (payload as any).message
        : error instanceof Error
          ? error.message
          : "Unable to sync Webull PaperTrade";

    return new Response(
      superjson.stringify({
        error: message,
        code: status === 401 ? "WEBULL_AUTH_REQUIRED" : "WEBULL_SYNC_ERROR",
      }),
      {
        status: status === 401 ? 401 : 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

