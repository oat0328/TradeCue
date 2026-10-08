import {useMutation,useQuery,useQueryClient}from "@tanstack/react-query";
import {getWebullLiveAccount}from "../endpoints/webull/live-account_GET.schema";
import {postWebullLiveKeys}from "../endpoints/webull/live-keys_POST.schema";
import {postWebullLiveDisconnect}from "../endpoints/webull/live-disconnect_POST.schema";
export function useWebullLive(enabled:boolean,accountId?:string){
 const cache=useQueryClient();
 const account=useQuery({queryKey:["webull-live","account",accountId],queryFn:()=>getWebullLiveAccount(accountId),enabled,retry:false,staleTime:15_000,refetchInterval:enabled?30_000:false,refetchIntervalInBackground:true});
 const connect=useMutation({mutationFn:postWebullLiveKeys,onSuccess:async()=>{cache.removeQueries({queryKey:["webull-live"]});await cache.invalidateQueries({queryKey:["admin"]});}});
 const disconnect=useMutation({mutationFn:postWebullLiveDisconnect,onSuccess:async()=>{cache.removeQueries({queryKey:["webull-live"]});await cache.invalidateQueries({queryKey:["admin"]});}});
 return {account,connect,disconnect};
}
