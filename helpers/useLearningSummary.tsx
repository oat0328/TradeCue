import { useQuery } from "@tanstack/react-query";
import { getLearningSummary } from "../endpoints/learning/summary_GET.schema";
export function useLearningSummary(enabled=true){
  return useQuery({queryKey:["cue-learning-summary"],queryFn:getLearningSummary,enabled,staleTime:60_000,refetchInterval:5*60_000,retry:false});
}