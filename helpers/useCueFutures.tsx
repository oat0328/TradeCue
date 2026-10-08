import { useQuery } from "@tanstack/react-query";
import { getFuturesBrief } from "../endpoints/futures/brief_GET.schema";
export function useCueFutures(symbol:string,timespan:"M1"|"M5"|"M15"|"M30"|"M60"|"M240",enabled=true){
  return useQuery({queryKey:["cue-futures",symbol,timespan],queryFn:()=>getFuturesBrief({symbol,timespan}),enabled:enabled&&Boolean(symbol),staleTime:15_000,refetchInterval:30_000,retry:false});
}