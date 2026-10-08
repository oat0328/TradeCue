import superjson from "superjson";
import { effectiveMembership } from "../../helpers/effectiveMembership";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { membershipAccess } from "../../helpers/membershipAccess";
import type { OutputType } from "./entitlements_GET.schema";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    const membership = await effectiveMembership(user.id, user.role === "admin");

    if (!membership) {
      return new Response(superjson.stringify({ error: "Membership not found" }), { status: 404 });
    }

    const risk = await db
      .selectFrom("riskProfiles")
      .select([
        "maxRiskPerTrade",
        "maxDailyLoss",
        "maxTradesPerDay",
        "longOnly",
        "requireGreenConfirmation",
        "noChaseEnabled",
        "safeModeEnabled",
        "dayTradeFlatTimePt",
      ])
      .where("userId", "=", user.id)
      .executeTakeFirst();

    const brokers = await db
      .selectFrom("brokerConnections")
      .select(["provider", "status", "isPaper", "accountMask"])
      .where("userId", "=", user.id)
      .execute();

    const workspaces = await db
      .selectFrom("userWorkspaces")
      .select(["id", "name", "kind", "defaultAssetClass", "quietMode", "isDefault"])
      .where("userId", "=", user.id)
      .orderBy("isDefault", "desc")
      .orderBy("createdAt", "asc")
      .execute();

    const output: OutputType = {
      membership,
      features: membership.accessActive ? membershipAccess(membership.tier) : [],
      risk: risk ?? null,
      brokers,
      workspaces: workspaces.map((workspace) => ({
        ...workspace,
        id: String(workspace.id),
      })),
    };

    return new Response(superjson.stringify(output), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load entitlements";
    return new Response(superjson.stringify({ error: message }), { status: 401 });
  }
}
