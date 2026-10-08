import { useQuery } from "@tanstack/react-query";
import { getWebullFundamentals } from "../endpoints/market/webull-fundamentals_GET.schema";

export function useWebullFundamentals(enabled:boolean,symbol:string){
  return useQuery({
    queryKey:["market","webull-fundamentals",symbol],
    queryFn:()=>getWebullFundamentals(symbol),
    enabled,
    retry:false,
    staleTime:5*60_000,
    refetchInterval:10*60_000,
    refetchIntervalInBackground:true,
  });
}
