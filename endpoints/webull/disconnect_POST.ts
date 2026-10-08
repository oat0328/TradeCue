import superjson from "superjson";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import type { OutputType } from "./disconnect_POST.schema";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    await db.updateTable("brokerConnections")
      .set({
        status: "disconnected",
        encryptedAccessToken: null,
        encryptedRefreshToken: null,
        accessTokenExpiresAt: null,
        refreshTokenExpiresAt: null,
        updatedAt: new Date(),
      })
      .where("userId", "=", user.id)
      .where("provider", "=", "webull")
      .execute();

    await db.insertInto("cueAuditLog").values({
      userId: user.id,
      action: "webull_disconnected",
      entityType: "broker_connection",
      details: {},
    }).execute();

    return new Response(superjson.stringify({ disconnected: true } satisfies OutputType), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to disconnect Webull";
    return new Response(superjson.stringify({ error: message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
}
