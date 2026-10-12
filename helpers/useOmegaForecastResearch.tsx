import {useQuery} from "@tanstack/react-query";
import {getOmegaForecastResearch} from "../endpoints/forecast/research_GET.schema";
export type ResearchModel="baseline"|"chronos2"|"kronos"|"nhits";
export function useOmegaForecastResearch(enabled:boolean,symbol:string,model:ResearchModel){
  return useQuery({
    queryKey:["omega-forecast-research",symbol,model],
    queryFn:()=>getOmegaForecastResearch(symbol,model),
    enabled:enabled&&Boolean(symbol),retry:false,staleTime:4*60_000,
    refetchInterval:false,
  });
}
