import { useQuery } from "@tanstack/react-query";
import { getTrainingStatus } from "../endpoints/training/status_GET.schema";
export function useTrainingStatus(enabled=true){
  return useQuery({queryKey:["cue-training-status"],queryFn:getTrainingStatus,enabled,staleTime:60_000,refetchInterval:5*60_000,retry:false});
}