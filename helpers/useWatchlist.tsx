import { useMutation,useQuery,useQueryClient } from "@tanstack/react-query";
import { getWatchlist } from "../endpoints/watchlist/index_GET.schema";
import { postWatchlist } from "../endpoints/watchlist/item_POST.schema";

export function useWatchlist(enabled=true){
  const cache=useQueryClient();
  const list=useQuery({
    queryKey:["watchlist"],
    queryFn:getWatchlist,
    enabled,
    staleTime:30_000,
    refetchInterval:60_000,
    refetchIntervalInBackground:false,
    retry:false,
  });
  const mutate=useMutation({
    mutationFn:postWatchlist,
    onSuccess:()=>cache.invalidateQueries({queryKey:["watchlist"]}),
  });
  return {list,mutate};
}

