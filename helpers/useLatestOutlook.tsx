import { useQuery } from "@tanstack/react-query";
import { getLatestOutlook } from "../endpoints/outlook/latest_GET.schema";
export function useLatestOutlook(enabled=true){
  return useQuery({queryKey:["cue-latest-outlook"],queryFn:getLatestOutlook,enabled,staleTime:60_000,refetchInterval:5*60_000,retry:false});
}