import { useQuery } from "@tanstack/react-query";
import { getMarketPulse } from "../endpoints/market/pulse_GET.schema";
import { getPositionMonitor } from "../endpoints/market/position-monitor_GET.schema";

export function useMarketPulse(enabled:boolean){
  return useQuery({
    queryKey:["market","pulse"],
    queryFn:getMarketPulse,
    enabled,
    retry:false,
    staleTime:30_000,
    refetchInterval:60_000,
    refetchIntervalInBackground:false,
  });
}

export function usePositionMonitor(enabled:boolean,accountId?:string){
  return useQuery({
    queryKey:["market","position-monitor",accountId??"default"],
    queryFn:()=>getPositionMonitor(accountId),
    enabled,
    retry:false,
    staleTime:30_000,
    refetchInterval:60_000,
    refetchIntervalInBackground:false,
  });
}
