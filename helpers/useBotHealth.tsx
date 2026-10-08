import { useQuery } from "@tanstack/react-query";
import { getBotHealth } from "../endpoints/bot/health_GET.schema";

export function useBotHealth(accountId?:string){
  return useQuery({
    queryKey:["bot-health",accountId??"default"],
    queryFn:()=>getBotHealth(accountId),
    enabled:false,
    retry:false,
    staleTime:15_000,
  });
}