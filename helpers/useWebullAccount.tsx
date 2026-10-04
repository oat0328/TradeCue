import {useQuery,useMutation,useQueryClient}from "@tanstack/react-query";
import {getWebullAccount}from "../endpoints/webull/account_GET.schema";
import {getWebullBars}from "../endpoints/webull/bars_GET.schema";
import {postWebullKeys}from "../endpoints/webull/keys_POST.schema";
import {postWebullKeysDisconnect}from "../endpoints/webull/keys-disconnect_POST.schema";

export function useWebullAccount(enabled:boolean,symbol:string,timeframe:string,accountId?:string) {
 const cache=useQueryClient();
 const account=useQuery({
   queryKey:["webull","account",accountId],
   queryFn:()=>getWebullAccount(accountId),
   enabled,
   retry:false,
   staleTime:30_000,
   refetchInterval:60_000,
   refetchIntervalInBackground:false,
 });
 const bars=useQuery({
   queryKey:["webull","bars",symbol,timeframe],
   queryFn:()=>getWebullBars(symbol,timeframe),
   enabled:enabled&&!!account.data,
   retry:false,
   staleTime:10_000,
   refetchInterval:15_000,
   refetchIntervalInBackground:false,
 });
 const connect=useMutation({
   mutationFn:postWebullKeys,
   onSuccess:async()=>{
     cache.removeQueries({queryKey:["webull"]});
     await cache.invalidateQueries({queryKey:["me","entitlements"]});
   },
 });
 const disconnect=useMutation({
   mutationFn:postWebullKeysDisconnect,
   onSuccess:async()=>{
     cache.removeQueries({queryKey:["webull"]});
     await cache.invalidateQueries({queryKey:["me","entitlements"]});
   },
 });
 return {account,bars,connect,disconnect};
}

