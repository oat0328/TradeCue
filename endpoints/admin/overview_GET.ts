import superjson from "superjson";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import type { OutputType } from "./overview_GET.schema";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Admin access required" }), { status: 403 });
    }

    const [
      userCount,
      membershipRows,
      brokerRows,
      fundamentalCount,
      auditRows,
    ] = await Promise.all([
      db.selectFrom("users").select((eb) => eb.fn.countAll<string>().as("count")).executeTakeFirstOrThrow(),
      db.selectFrom("userMemberships")
        .select(["tier"])
        .select((eb) => eb.fn.countAll<string>().as("count"))
        .groupBy("tier")
        .execute(),
      db.selectFrom("brokerConnections")
        .select(["provider"])
        .select((eb) => eb.fn.countAll<string>().as("count"))
        .groupBy("provider")
        .execute(),
      db.selectFrom("fundamentalEvents").select((eb) => eb.fn.countAll<string>().as("count")).executeTakeFirstOrThrow(),
      db.selectFrom("cueAuditLog")
        .select(["id", "action", "entityType", "entityId", "createdAt"])
        .orderBy("createdAt", "desc")
        .limit(12)
        .execute(),
    ]);

    const memberships: OutputType["memberships"] = { scout: 0, copilot: 0, autopilot: 0 };
    for (const row of membershipRows) memberships[row.tier] = Number(row.count);

    const brokers: OutputType["brokers"] = { webull: 0, tradovate: 0 };
    for (const row of brokerRows) brokers[row.provider] = Number(row.count);

    const output: OutputType = {
      users: Number(userCount.count),
      memberships,
      brokers,
      fundamentalEvents: Number(fundamentalCount.count),
      recentAudit: auditRows.map((row) => ({ ...row, id: String(row.id) })),
    };

    return new Response(superjson.stringify(output), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load admin overview";
    return new Response(superjson.stringify({ error: message }), { status: 401 });
  }
}
