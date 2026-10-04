import { useQuery } from "@tanstack/react-query";
import { getHunterScan } from "../endpoints/hunter/scan_GET.schema";

export type HunterFilters = {
  mode:"auto"|"active"|"momentum"|"buy_low";
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
    staleTime:60_000,
    refetchInterval:90_000,
    refetchIntervalInBackground:true,
  });
}

