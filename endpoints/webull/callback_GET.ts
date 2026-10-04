import superjson from "superjson";
import { db } from "../../helpers/db";
import {
  encryptBrokerSecret,
  hashOauthState,
  signWebullRequest,
} from "../../helpers/brokerCrypto";

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: string | number;
  rt_expires_in?: string | number;
  identity_id?: string;
  token_type?: string;
};

function env(name: string) {
  const value = (process.env as Record<string, string | undefined>)[name];
  if (!value) throw new Error(name + " is not configured");
  return value;
}

export async function handle(request: Request) {
  const appOrigin = new URL(request.url).origin;

  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const oauthError = url.searchParams.get("error");

    if (oauthError) {
      return Response.redirect(
        appOrigin + "/workstation?webull=error&message=" + encodeURIComponent(oauthError),
        302,
      );
    }

    if (!code || !state) {
      return Response.redirect(appOrigin + "/workstation?webull=missing_code", 302);
    }

    const stateHash = hashOauthState(state);
    const oauthState = await db
      .selectFrom("brokerOauthStates")
      .selectAll()
      .where("provider", "=", "webull")
      .where("stateHash", "=", stateHash)
      .where("usedAt", "is", null)
      .executeTakeFirst();

    if (!oauthState || oauthState.expiresAt < new Date()) {
      return Response.redirect(appOrigin + "/workstation?webull=invalid_state", 302);
    }

    const userId = oauthState.userId;

    await db.updateTable("brokerOauthStates")
      .set({ usedAt: new Date() })
      .where("id", "=", oauthState.id)
      .execute();

    const clientId = env("WEBULL_CLIENT_ID");
    const clientSecret = env("WEBULL_CLIENT_SECRET");
    const appKey = env("WEBULL_APP_KEY");
    const appSecret = env("WEBULL_APP_SECRET");
    const scope = env("WEBULL_SCOPE");

    const host = "oauth-open-api.sandbox.webull.com";
    const path = "/oauth2/tokens/create";
    const body = JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
    });

    const signed = signWebullRequest({
      host,
      path,
      body,
      appKey,
      appSecret,
    });

    const tokenResponse = await fetch("https://" + host + path, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...signed,
      },
      body,
    });

    if (!tokenResponse.ok) {
      const bodyText = await tokenResponse.text();
      await db.insertInto("cueAuditLog").values({
        userId: userId,
        action: "webull_oauth_token_error",
        entityType: "broker_connection",
        details: { status: tokenResponse.status, body: bodyText.slice(0, 500) },
      }).execute();
      return Response.redirect(appOrigin + "/workstation?webull=token_error", 302);
    }

    const token = await tokenResponse.json() as TokenResponse;
    if (!token.access_token || !token.refresh_token) {
      return Response.redirect(appOrigin + "/workstation?webull=token_error", 302);
    }

    const now = Date.now();
    const accessExpires = new Date(now + Number(token.expires_in || 1800) * 1000);
    const refreshExpires = new Date(now + Number(token.rt_expires_in || 1296000) * 1000);

    let externalAccountId: string | null = null;
    let accountMask: string | null = null;
    let accountType: string | null = null;

    const accountsResponse = await fetch(
      "https://oauth-open-api.sandbox.webull.com/oauth-openapi/account/list",
      {
        headers: {
          Accept: "application/json",
          Authorization: "Bearer " + token.access_token,
        },
      },
    );

    if (accountsResponse.ok) {
      const accounts = await accountsResponse.json() as any;
      const rows = Array.isArray(accounts) ? accounts : Array.isArray(accounts?.data) ? accounts.data : [];
      const first = rows[0];
      if (first) {
        externalAccountId = String(first.account_id ?? first.accountId ?? first.id ?? "") || null;
        const rawAccount = externalAccountId ?? "";
        accountMask = rawAccount ? "••••" + rawAccount.slice(-4) : null;
        accountType = typeof first.account_type === "string"
          ? first.account_type
          : typeof first.accountType === "string"
            ? first.accountType
            : null;
      }
    }

    const existing = await db
      .selectFrom("brokerConnections")
      .select(["id"])
      .where("userId", "=", userId)
      .where("provider", "=", "webull")
      .executeTakeFirst();

    const connectionValues = {
      status: "connected" as const,
      externalAccountId,
      accountMask,
      accountType,
      isPaper: true,
      scopes: scope.split(/[ :]+/).filter(Boolean),
      encryptedAccessToken: encryptBrokerSecret(token.access_token),
      encryptedRefreshToken: encryptBrokerSecret(token.refresh_token),
      accessTokenExpiresAt: accessExpires,
      refreshTokenExpiresAt: refreshExpires,
      oauthIdentityId: token.identity_id ?? null,
      oauthScope: scope,
      lastSyncedAt: new Date(),
      updatedAt: new Date(),
    };

    if (existing) {
      await db.updateTable("brokerConnections")
        .set(connectionValues)
        .where("id", "=", existing.id)
        .execute();
    } else {
      await db.insertInto("brokerConnections")
        .values({
          userId: userId,
          provider: "webull",
          ...connectionValues,
        })
        .execute();
    }

    await db.insertInto("cueAuditLog").values({
      userId: userId,
      action: "webull_connected",
      entityType: "broker_connection",
      entityId: externalAccountId,
      details: { environment: "sandbox", accountType },
    }).execute();

    return Response.redirect(appOrigin + oauthState.redirectAfter, 302);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webull callback failed";
    console.error("Webull callback error", error);
    return Response.redirect(
      appOrigin + "/workstation?webull=error&message=" + encodeURIComponent(message.slice(0, 120)),
      302,
    );
  }
}

