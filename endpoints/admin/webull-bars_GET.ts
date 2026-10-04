import superjson from "superjson";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { getStockBars } from "../../helpers/webullPaperClient";
import { schema, type Bar } from "./webull-bars_GET.schema";

const intervalMap: Record<string, string> = {
  "1m": "M1",
  "3m": "M1",
  "5m": "M5",
  "15m": "M15",
  "30m": "M30",
  "1H": "M60",
  "4H": "M240",
  "1D": "D",
  "1W": "W",
};

function normalizeBars(raw: unknown): Bar[] {
  const outer = raw && typeof raw === "object" && Array.isArray((raw as any).result)
    ? (raw as any).result
    : Array.isArray(raw)
      ? raw
      : [];

  const rows = outer.length > 0 && outer[0] && typeof outer[0] === "object" && Array.isArray((outer[0] as any).result)
    ? (outer[0] as any).result
    : outer;

  return rows
    .map((row: any) => ({
      time: String(row?.time ?? row?.timestamp ?? ""),
      open: Number(row?.open),
      high: Number(row?.high),
      low: Number(row?.low),
      close: Number(row?.close),
      volume: Number(row?.volume ?? 0),
    }))
    .filter((bar: Bar) =>
      bar.time &&
      [bar.open, bar.high, bar.low, bar.close].every((value) => Number.isFinite(value)),
    );
}

function aggregateThreeMinute(input: Bar[]): Bar[] {
  const output: Bar[] = [];
  for (let index = 0; index < input.length; index += 3) {
    const chunk = input.slice(index, index + 3);
    if (chunk.length === 0) continue;
    output.push({
      time: chunk[0].time,
      open: chunk[0].open,
      high: Math.max(...chunk.map((bar) => bar.high)),
      low: Math.min(...chunk.map((bar) => bar.low)),
      close: chunk[chunk.length - 1].close,
      volume: chunk.reduce((sum, bar) => sum + bar.volume, 0),
    });
  }
  return output;
}

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Owner access required" }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
    }

    const url = new URL(request.url);
    const input = schema.parse({
      symbol: url.searchParams.get("symbol") ?? "",
      timeframe: url.searchParams.get("timeframe") ?? "",
    });

    const raw = await getStockBars(
      input.symbol,
      intervalMap[input.timeframe],
      null,
      input.timeframe === "3m" ? 300 : 160,
    );

    const bars = normalizeBars(raw);
    const finalBars = input.timeframe === "3m" ? aggregateThreeMinute(bars) : bars;

    return new Response(
      superjson.stringify({
        symbol: input.symbol,
        timeframe: input.timeframe,
        source: "webull-paper" as const,
        bars: finalBars.slice(-160),
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    const payload = typeof error === "object" && error && "payload" in error ? (error as any).payload : null;
    const message =
      payload && typeof payload === "object" && typeof (payload as any).message === "string"
        ? (payload as any).message
        : error instanceof Error
          ? error.message
          : "Unable to load Webull chart data";
    return new Response(
      superjson.stringify({ error: message }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
}

