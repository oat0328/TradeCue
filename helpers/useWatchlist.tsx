import { useMutation,useQuery,useQueryClient } from "@tanstack/react-query";
import { getWatchlist } from "../endpoints/watchlist/index_GET.schema";
import { postWatchlist } from "../endpoints/watchlist/item_POST.schema";

export function useWatchlist(enabled=true){
  const cache=useQueryClient();
  const list=useQuery({
    queryKey:["watchlist"],
    queryFn:getWatchlist,
    enabled,
    staleTime:5_000,
    refetchInterval:15_000,
    refetchIntervalInBackground:true,
    retry:false,
  });
  const mutate=useMutation({
    mutationFn:postWatchlist,
    onSuccess:async()=>{
      await cache.invalidateQueries({queryKey:["watchlist"]});
      await cache.refetchQueries({queryKey:["watchlist"],type:"active"});
    },
  });
  return {list,mutate};
}
