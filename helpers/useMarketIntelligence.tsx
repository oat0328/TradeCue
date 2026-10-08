import { useQuery } from "@tanstack/react-query";
import { getMarketIntelligence } from "../endpoints/market/intelligence_GET.schema";
export function useMarketIntelligence(enabled:boolean,symbol:string){
  return useQuery({
    queryKey:["market","intelligence",symbol],
    queryFn:()=>getMarketIntelligence(symbol),
    enabled,
    retry:false,
    staleTime:90_000,
    refetchInterval:120_000,
    refetchIntervalInBackground:true,
  });
}
