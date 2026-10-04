import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { postPaperOrder } from "../endpoints/webull/paper-order_POST.schema";
import { getPaperOrders } from "../endpoints/webull/orders_GET.schema";
import { postCancelPaperOrder } from "../endpoints/webull/order-cancel_POST.schema";

export function usePaperOrders(enabled:boolean,accountId?:string){
  const cache=useQueryClient();
  const orders=useQuery({
    queryKey:["webull","orders",accountId],
    queryFn:()=>getPaperOrders(accountId!),
    enabled:enabled&&!!accountId,
    staleTime:15_000,
    retry:false,
    refetchInterval:20_000,
  });
  const place=useMutation({
    mutationFn:postPaperOrder,
    onSuccess:async()=>{
      await cache.invalidateQueries({queryKey:["webull","orders"]});
      await cache.invalidateQueries({queryKey:["webull","account"]});
    },
  });
  const cancel=useMutation({
    mutationFn:postCancelPaperOrder,
    onSuccess:async()=>{
      await cache.invalidateQueries({queryKey:["webull","orders"]});
      await cache.invalidateQueries({queryKey:["webull","account"]});
    },
  });
  return {orders,place,cancel};
}

