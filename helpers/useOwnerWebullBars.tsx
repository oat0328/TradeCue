import { useQuery } from "@tanstack/react-query";
import { getOwnerWebullBars } from "../endpoints/admin/webull-bars_GET.schema";

export function useOwnerWebullBars(symbol: string, timeframe: string, enabled = true) {
  return useQuery({
    queryKey: ["owner", "webull-bars", symbol, timeframe],
    queryFn: () => getOwnerWebullBars({ symbol, timeframe: timeframe as any }),
    enabled: enabled && Boolean(symbol),
    staleTime: 10_000,
    retry: false,
    refetchInterval: 20_000,
  });
}

