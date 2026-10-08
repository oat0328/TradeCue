import {brokerPollInterval} from "./brokerPollInterval";
import { useCallback, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { postPaperOrder } from "../endpoints/webull/paper-order_POST.schema";
import { getPaperOrders } from "../endpoints/webull/orders_GET.schema";
import { postCancelPaperOrder } from "../endpoints/webull/order-cancel_POST.schema";
import { newIntentId, PENDING_MARKER } from "./paperOrderIntent";

export function usePaperOrders(enabled:boolean,accountId?:string){
  const cache=useQueryClient();
  const orders=useQuery({
    queryKey:["webull","orders",accountId],
    queryFn:()=>getPaperOrders(accountId!),
    enabled:enabled&&!!accountId,
    staleTime:20_000,
    retry:false,
    refetchInterval:query=>brokerPollInterval(query.state.error,30_000),
    refetchIntervalInBackground:true,
  });
  const refresh=async()=>{
    await cache.invalidateQueries({queryKey:["webull","orders"]});
    await cache.invalidateQueries({queryKey:["webull","account"]});
  };
  const place=useMutation({
    mutationFn:postPaperOrder,
    onSuccess:refresh,
    onError:refresh,
  });
  const cancel=useMutation({
    mutationFn:postCancelPaperOrder,
    onSuccess:refresh,
  });

  // Audit H-01: one intent id per order attempt. The same id is reused while the attempt is
  // unresolved (network failure or a "still pending" answer), so a re-click reconciles instead
  // of placing a duplicate. A new id is issued after success, a definitive rejection, or when
  // the order parameters change.
  const attempt=useRef<{fingerprint:string;id:string}|null>(null);
  const intentFor=useCallback((fingerprint:string)=>{
    if(!attempt.current||attempt.current.fingerprint!==fingerprint)attempt.current={fingerprint,id:newIntentId()};
    return attempt.current.id;
  },[]);
  const settleAttempt=useCallback((error?:unknown)=>{
    const unresolved=error instanceof TypeError||(error instanceof Error&&error.message.includes(PENDING_MARKER));
    if(!unresolved)attempt.current=null;
  },[]);

  return {orders,place,cancel,intentFor,settleAttempt};
}
