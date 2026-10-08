import superjson from "superjson";
import { apiUser, apiJson, apiFailure } from "../../helpers/apiAccess";
import { userKeys } from "../../helpers/webullClient";
import { evaluateExitGuard } from "../../helpers/exitGuardServer";
import { schema, type OutputType } from "./exit-guard_POST.schema";

// Checks Axiom's automated exits against Webull, corrects stored statuses, opens/resolves
// alerts, and tells the client whether a controlled retry is allowed. Never places orders.
export async function handle(request: Request) {
  try {
    const user = await apiUser(request);
    const input = schema.parse(superjson.parse(await request.text()));
    const keys = await userKeys(user);
    const result = await evaluateExitGuard(user.id, keys, input.accountId);
    const out: OutputType = { ...result, rows: result.rows.map(r => ({
      symbol: r.symbol, heldQty: r.heldQty, state: r.state, attempts: r.attempts, nextAttemptNo: r.nextAttemptNo,
      nextIntentId: r.nextIntentId, retryOfIntentId: r.retryOfIntentId, retryAt: r.retryAt, alert: r.alert, reason: r.reason,
    })), checkedAt: new Date().toISOString() };
    return apiJson(out);
  } catch (error) {
    return apiFailure(error);
  }
}