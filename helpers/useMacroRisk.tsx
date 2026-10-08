import { useQuery } from "@tanstack/react-query";
import { getMacroRisk } from "../endpoints/risk/macro_GET.schema";
export function useMacroRisk(enabled=true){
  return useQuery({queryKey:["macro-risk"],queryFn:getMacroRisk,enabled,staleTime:3*60_000,refetchInterval:5*60_000,retry:false});
}