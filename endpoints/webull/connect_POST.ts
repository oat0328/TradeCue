import { randomBytes } from "crypto";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { hashOauthState } from "../../helpers/brokerCrypto";
import type { OutputType } from "./connect_POST.schema";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const membership = await db
      .selectFrom("userMemberships")
      .select(["tier", "status"])
      .where("userId", "=", user.id)
      .executeTakeFirst();

    if (!membership || membership.tier === "scout" || !["trial", "active"].includes(membership.status)) {
      return new Response(
        superjson.stringify({
          error: "Webull Connect is available in Copilot and Autopilot.",
          code: "WEBULL_TIER_REQUIRED",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
    }

    const env = process.env as Record<string, string | undefined>;
    const clientId = env["WEBULL_CLIENT_ID"];
    const scope = env["WEBULL_SCOPE"];
    const redirectUri = new URL("/_api/webull/callback", request.url).toString();

    if (!clientId || !scope) {
      return new Response(
        superjson.stringify({
          error: "Webull Connect credentials are not connected yet.",
          code: "WEBULL_NOT_CONFIGURED",
        }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      );
    }

    const state = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await db.insertInto("brokerOauthStates").values({
      userId: user.id,
      provider: "webull",
      stateHash: hashOauthState(state),
      redirectAfter: "/workstation?webull=connected",
      expiresAt,
    }).execute();

    await db.deleteFrom("brokerOauthStates")
      .where("userId", "=", user.id)
      .where("provider", "=", "webull")
      .where("expiresAt", "<", new Date())
      .execute();

    const url = new URL("https://passport.webull.com/oauth2/sandbox/authenticate/login");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("scope", scope);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);

    await db.insertInto("cueAuditLog").values({
      userId: user.id,
      action: "webull_oauth_started",
      entityType: "broker_connection",
      details: { environment: "sandbox" },
    }).execute();

    const output: OutputType = {
      authorizationUrl: url.toString(),
      environment: "sandbox",
    };

    return new Response(superjson.stringify(output), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start Webull OAuth";
    return new Response(superjson.stringify({ error: message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
}
