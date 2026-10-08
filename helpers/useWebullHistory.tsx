import { useQuery } from "@tanstack/react-query";
import { getWebullHistory } from "../endpoints/webull/history_GET.schema";

export function useWebullHistory(enabled:boolean,symbol:string,timeframe:string){
  const limit=timeframe==="1m"||timeframe==="3m"?1650:1200;
  return useQuery({
    queryKey:["webull","pro-history",symbol,timeframe],
    queryFn:()=>getWebullHistory(symbol,timeframe,limit),
    enabled,
    retry:false,
    staleTime:10*60_000,
    gcTime:30*60_000,
    refetchOnWindowFocus:false,
  });
}
