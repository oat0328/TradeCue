import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "./useDebounce";
import { searchSymbols } from "../endpoints/search/symbols_GET.schema";
export function useSymbolSearch(q:string,enabled=true){
  const debounced=useDebounce(q.trim(),400);
  return useQuery({
    queryKey:["symbol-search",debounced],
    queryFn:()=>searchSymbols(debounced),
    enabled:enabled&&debounced===q.trim()&&debounced.length>=1,
    staleTime:5*60*1000,
    retry:false,
  });
}