import {useQuery} from "@tanstack/react-query";
import {getLearningSummary} from "../endpoints/learning/summary_GET.schema";
export function useLearningSummary(enabled=true){
  return useQuery({queryKey:["learning","summary"],queryFn:getLearningSummary,
    enabled,retry:false,staleTime:60_000,refetchInterval:false});
}
