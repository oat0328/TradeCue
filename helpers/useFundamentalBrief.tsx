import { useQuery } from "@tanstack/react-query";
import { getFundamentalBrief } from "../endpoints/fundamentals/brief_GET.schema";

export function useFundamentalBrief(symbol: string, enabled = true) {
  return useQuery({
    queryKey: ["fundamentals", "brief", symbol],
    queryFn: () => getFundamentalBrief({ symbol }),
    enabled: enabled && Boolean(symbol),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
