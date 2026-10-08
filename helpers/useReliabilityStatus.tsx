import { useQuery } from "@tanstack/react-query";
import { getReliabilityStatus } from "../endpoints/reliability/status_GET.schema";
export function useReliabilityStatus(enabled=true){
  return useQuery({queryKey:["cue-reliability"],queryFn:getReliabilityStatus,enabled,staleTime:30_000,refetchInterval:60_000,retry:false});
}