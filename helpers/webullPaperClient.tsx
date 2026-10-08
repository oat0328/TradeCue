import { signWebullRequest } from "./brokerCrypto";

const HOST = "api.sandbox.webull.com";
const BASE_URL = "https://" + HOST;

function env(name: string) {
  const value = (process.env as Record<string, string | undefined>)[name];
  if (!value) throw new Error(name + " is not configured");
  return value;
}

export type WebullRequestOptions = {
  method?: "GET" | "POST";
  path: string;
  query?: Record<string, string>;
  body?: unknown;
  accessToken?: string | null;
};

export async function webullPaperRequest({
  method = "GET",
  path,
  query = {},
  body,
  accessToken,
}: WebullRequestOptions) {
  const appKey = env("WEBULL_APP_KEY");
  const appSecret = env("WEBULL_APP_SECRET");
  const bodyText = body == null ? "" : JSON.stringify(body);

  const signed = signWebullRequest({
    host: HOST,
    path,
    query,
    body: bodyText,
    appKey,
    appSecret,
  });

  const url = new URL(path, BASE_URL);
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...signed,
  };

  if (accessToken) headers["x-access-token"] = accessToken;
  if (method === "POST") headers["Content-Type"] = "application/json";

  const response = await fetch(url, {
    method,
    headers,
    body: method === "POST" && bodyText ? bodyText : undefined,
  });

  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const error = new Error("Webull API request failed with status " + response.status) as Error & {
      status?: number;
      payload?: unknown;
    };
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return data;
}

export async function getPaperAccounts(accessToken?: string | null) {
  return webullPaperRequest({
    path: "/trading/accounts/list",
    accessToken,
  });
}

export async function getPaperBalance(accountId: string, accessToken?: string | null) {
  return webullPaperRequest({
    path: "/trading/assets/balances/get",
    query: { account_id: accountId },
    accessToken,
  });
}

export async function getPaperPositions(accountId: string, accessToken?: string | null) {
  return webullPaperRequest({
    path: "/trading/assets/positions/list",
    query: { account_id: accountId },
    accessToken,
  });
}

export async function getStockBars(
  symbol: string,
  interval: string,
  accessToken?: string | null,
  count = 160,
) {
  return webullPaperRequest({
    method: "POST",
    path: "/market-data/stocks/bars/list",
    body: {
      symbols: [symbol],
      category: "US_STOCK",
      timespan: interval,
      count: String(count),
      real_time_required: true,
      trading_sessions: "PRE,RTH,ATH",
    },
    accessToken,
  });
}
