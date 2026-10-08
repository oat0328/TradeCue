import { z } from "zod";
import superjson from "superjson";
import { readApiResponse } from "../../helpers/apiClient";

export const schema = z.object({ accountId: z.string().min(1).max(100) });

export type ExitGuardRowOut = {
  symbol: string;
  heldQty: number;
  state: "flat" | "none" | "working" | "filled" | "residual" | "unconfirmed" | "backoff" | "retry_ready" | "exhausted";
  attempts: number;
  nextAttemptNo: number | null;
  nextIntentId: string | null;
  retryOfIntentId: string | null;
  retryAt: number | null;
  alert: boolean;
  reason: string;
};
export type OutputType = {
  rows: ExitGuardRowOut[];
  alerts: Array<{ id: string; symbol: string; state: string; reason: string; attempts: number; updatedAt: string; createdAt: string }>;
  brokerReachable: boolean;
  checkedAt: string;
};

export async function postExitGuard(body: z.infer<typeof schema>): Promise<OutputType> {
  const r = await fetch("/_api/automation/exit-guard", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: superjson.stringify(schema.parse(body)) });
  return readApiResponse<OutputType>(r, "Exit guard check failed");
}