import { flootAi, FlootAiOutOfCreditsError, FlootAiRateLimitError } from "@floot/ai";
import superjson from "superjson";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import {
  schema,
  type EarningsItem,
  type NewsItem,
  type OutputType,
} from "./brief_GET.schema";

const FMP_BASE = "https://financialmodelingprep.com/stable";

async function fmpFetch(path: string, apiKey: string) {
  const separator = path.includes("?") ? "&" : "?";
  const response = await fetch(FMP_BASE + path + separator + "apikey=" + encodeURIComponent(apiKey), {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error("FMP request failed (" + response.status + "): " + body.slice(0, 300));
  }

  return response.json();
}

function normalizeNews(value: unknown, fallbackSymbol: string): NewsItem[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 10).map((item: any) => ({
    symbol: typeof item.symbol === "string" ? item.symbol : fallbackSymbol,
    publishedDate: typeof item.publishedDate === "string"
      ? item.publishedDate
      : typeof item.publishedAt === "string"
        ? item.publishedAt
        : null,
    title: typeof item.title === "string" ? item.title : "Untitled market update",
    text: typeof item.text === "string" ? item.text : null,
    site: typeof item.site === "string"
      ? item.site
      : typeof item.publisher === "string"
        ? item.publisher
        : null,
    url: typeof item.url === "string" ? item.url : null,
  }));
}

function normalizeEarnings(value: unknown): EarningsItem[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 8).map((item: any) => ({
    date: typeof item.date === "string" ? item.date : null,
    epsActual: typeof item.epsActual === "number" ? item.epsActual : null,
    epsEstimated: typeof item.epsEstimated === "number" ? item.epsEstimated : null,
    revenueActual: typeof item.revenueActual === "number" ? item.revenueActual : null,
    revenueEstimated: typeof item.revenueEstimated === "number" ? item.revenueEstimated : null,
  }));
}

export async function handle(request: Request) {
  try {
    await getServerUserSession(request);

    const url = new URL(request.url);
    const input = schema.parse({ symbol: url.searchParams.get("symbol") ?? "" });
    const apiKey = (process.env as Record<string, string | undefined>)["FMP_API_KEY"];

    if (!apiKey) {
      return new Response(
        superjson.stringify({
          error: "Financial Modeling Prep is not connected.",
          code: "FMP_NOT_CONNECTED",
        }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      );
    }

    const symbol = input.symbol;
    const [newsRaw, earningsRaw, ratingRaw, targetRaw] = await Promise.all([
      fmpFetch("/news/stock?symbols=" + encodeURIComponent(symbol) + "&limit=10", apiKey),
      fmpFetch("/earnings?symbol=" + encodeURIComponent(symbol) + "&limit=8", apiKey),
      fmpFetch("/ratings-snapshot?symbol=" + encodeURIComponent(symbol), apiKey),
      fmpFetch("/price-target-consensus?symbol=" + encodeURIComponent(symbol), apiKey),
    ]);

    const news = normalizeNews(newsRaw, symbol);
    const earnings = normalizeEarnings(earningsRaw);
    const ratingSnapshot = Array.isArray(ratingRaw) && ratingRaw.length > 0
      ? ratingRaw[0] as Record<string, unknown>
      : null;
    const priceTargetConsensus = Array.isArray(targetRaw) && targetRaw.length > 0
      ? targetRaw[0] as Record<string, unknown>
      : null;

    const aiInput = {
      symbol,
      latestNews: news.slice(0, 6),
      recentEarnings: earnings.slice(0, 4),
      ratingSnapshot,
      priceTargetConsensus,
    };

    const ai = await flootAi.chat({
      model: "gpt-6-luna",
      reasoning: { effort: "low" },
      max_output_tokens: 700,
      instructions:
        "You are Professor Cue inside TradeCue. Summarize fundamental intelligence for an educational trading workstation. " +
        "Use only the supplied facts. Separate company/fundamental strength from trade-entry quality. " +
        "Never promise profit and never say a user should buy merely because news is positive. " +
        "Write 4 concise paragraphs: Catalyst, Fundamental read, What can invalidate it, and What price confirmation is still needed. " +
        "If data is mixed or incomplete, say so plainly.",
      input: JSON.stringify(aiInput),
    });

    const output: OutputType = {
      symbol,
      generatedAt: new Date().toISOString(),
      cueSummary: ai.output_text?.trim() || "No AI summary was produced.",
      news,
      earnings,
      ratingSnapshot,
      priceTargetConsensus,
    };

    return new Response(superjson.stringify(output), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof FlootAiOutOfCreditsError) {
      return new Response(
        superjson.stringify({
          error: "AI features are temporarily unavailable. Please contact the app owner.",
          code: "OUT_OF_CREDITS",
        }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      );
    }

    if (error instanceof FlootAiRateLimitError) {
      return new Response(
        superjson.stringify({ error: "AI is busy. Try again in about a minute.", code: "AI_RATE_LIMIT" }),
        { status: 429, headers: { "Content-Type": "application/json" } },
      );
    }

    const message = error instanceof Error ? error.message : "Unable to load fundamental intelligence";
    return new Response(
      superjson.stringify({ error: message }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
}

