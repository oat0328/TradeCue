import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  symbol: z.string().trim().min(1).max(12).transform((value) => value.toUpperCase()),
  timeframe: z.enum(["1m", "3m", "5m", "15m", "30m", "1H", "4H", "1D", "1W"]),
});

export type Bar = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type OutputType = {
  symbol: string;
  timeframe: string;
  source: "webull-paper";
  bars: Bar[];
};

export const getOwnerWebullBars = async (
  body: z.infer<typeof schema>,
  init?: RequestInit,
): Promise<OutputType> => {
  const input = schema.parse(body);
  const params = new URLSearchParams({
    symbol: input.symbol,
    timeframe: input.timeframe,
  });
  const response = await fetch("/_api/admin/webull-bars?" + params.toString(), {
    method: "GET",
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const error = superjson.parse<{ error: string }>(await response.text());
    throw new Error(error.error || "Unable to load Webull chart data");
  }

  return superjson.parse<OutputType>(await response.text());
};

