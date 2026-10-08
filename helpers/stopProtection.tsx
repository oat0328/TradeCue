import { isDeadBrokerStatus, isFilledBrokerStatus } from "./exitGuard";
export function stopProtection(input: { heldQty: number; brokerReachable: boolean; stops: Array<{ status: string; quantity: number | null; filledQty: number | null }> }) {
  if (!(input.heldQty > 1e-9)) return { alert: false, reason: "No shares held." };
  if (!input.brokerReachable) return { alert: true, reason: "STOP ALERT: Webull could not confirm protective stops. New automated buys paused; check protection manually." };
  const working = new Set(["NEW","OPEN","WORKING","PENDING","ACCEPTED","SUBMITTED","PARTIALLYFILLED"]);
  let covered = 0;
  for (const stop of input.stops) {
    const status = stop.status.toUpperCase().replace(/[^A-Z]/g, "");
    if (isDeadBrokerStatus(status) || isFilledBrokerStatus(status) || !working.has(status)) continue;
    if (stop.quantity != null && Number.isFinite(stop.quantity) && stop.quantity > 0) covered += Math.max(0, stop.quantity - (stop.filledQty ?? 0));
  }
  return covered + 1e-9 >= input.heldQty
    ? { alert: false, reason: "Webull confirms stop coverage for held shares." }
    : { alert: true, reason: "STOP ALERT: protective stop missing, rejected, cancelled, expired, or insufficient. " + input.heldQty + " shares held; " + covered + " confirmed covered. New automated buys paused; repair protection or exit manually." };
}
