import {brokerPollInterval} from "./brokerPollInterval";
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
   refetchInterval:query=>brokerPollInterval(query.state.error,60_000),
   refetchIntervalInBackground:true,
 });
 const bars=useQuery({
   queryKey:["webull","bars",symbol,timeframe],
   queryFn:()=>getWebullBars(symbol,timeframe),
   enabled:enabled&&!!account.data,
   retry:false,
   staleTime:20_000,
   refetchInterval:query=>brokerPollInterval(query.state.error,30_000),
   refetchIntervalInBackground:true,
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
