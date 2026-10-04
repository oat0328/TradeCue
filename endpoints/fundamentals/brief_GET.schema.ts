import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  symbol: z.string().trim().min(1).max(12).transform((value) => value.toUpperCase()),
});

export type NewsItem = {
  symbol: string | null;
  publishedDate: string | null;
  title: string;
  text: string | null;
  site: string | null;
  url: string | null;
};

export type EarningsItem = {
  date: string | null;
  epsActual: number | null;
  epsEstimated: number | null;
  revenueActual: number | null;
  revenueEstimated: number | null;
};

export type OutputType = {
  symbol: string;
  generatedAt: string;
  cueSummary: string;
  news: NewsItem[];
  earnings: EarningsItem[];
  ratingSnapshot: Record<string, unknown> | null;
  priceTargetConsensus: Record<string, unknown> | null;
};

export const getFundamentalBrief = async (
  body: z.infer<typeof schema>,
  init?: RequestInit,
): Promise<OutputType> => {
  const input = schema.parse(body);
  const params = new URLSearchParams({ symbol: input.symbol });
  const result = await fetch("/_api/fundamentals/brief?" + params.toString(), {
    method: "GET",
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    const error = superjson.parse<{ error: string; code?: string }>(await result.text());
    const message = error.code === "FMP_NOT_CONNECTED"
      ? "Fundamental data provider is not connected yet."
      : error.error || "Unable to load fundamental intelligence";
    throw new Error(message);
  }

  return superjson.parse<OutputType>(await result.text());
};

