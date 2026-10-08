import {useQuery} from "@tanstack/react-query";
import {useAuth} from "./useAuth";
import {getChartTrades} from "../endpoints/journal/chart-trades_GET.schema";
export function useChartTrades(accountId:string|undefined,symbol:string,from:string|undefined,to:string|undefined){
 const {authState}=useAuth();
 const userId=authState.type==="authenticated"?authState.user.id:null;
 return useQuery({queryKey:["chart-filled-trades",userId,accountId,symbol,from,to],enabled:userId!=null&&Boolean(accountId&&from&&to),queryFn:()=>getChartTrades({accountId:accountId!,symbol:symbol.toUpperCase(),from:from!,to:to!}),staleTime:30000,refetchInterval:60000,retry:false});
}