import { useQuery } from "@tanstack/react-query";
import { brokerPollInterval } from "./brokerPollInterval";
import { getHunterScan } from "../endpoints/hunter/scan_GET.schema";

export type HunterFilters = {
  mode:"auto"|"active"|"momentum"|"buy_low"|"portfolio"|"bearish";
  maxPrice?:number;
  budget?:number;
  minScore:number;
  limit:number;
};

export function useCueHunter(enabled:boolean,filters:HunterFilters){
  return useQuery({
    queryKey:["cue-hunter",filters],
    queryFn:()=>getHunterScan(filters),
    enabled,
    retry:false,
    staleTime:90_000,
    refetchInterval:query=>brokerPollInterval(query.state.error,120_000),
    refetchIntervalInBackground:true,
  });
}
