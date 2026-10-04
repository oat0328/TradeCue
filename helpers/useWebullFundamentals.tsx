import { useQuery } from "@tanstack/react-query";
import { getWebullFundamentals } from "../endpoints/market/webull-fundamentals_GET.schema";

export function useWebullFundamentals(enabled:boolean,symbol:string){
  return useQuery({
    queryKey:["webull","fundamentals",symbol],
    queryFn:()=>getWebullFundamentals(symbol),
    enabled:enabled&&Boolean(symbol),
    retry:false,
    staleTime:5*60_000,
    refetchInterval:false,
  });
}
