import {readApiResponse} from "../../helpers/apiClient";
export type TradeAlertEvent="ENTRY_READY"|"TP1"|"TP2"|"TP3"|"TP4"|"STOP";
export async function sendTradeAlert(input:{symbol:string;event:TradeAlertEvent;price:number;setup:string}){
  const r=await fetch("/_api/push/trade-alert",{
    method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify(input),
  });
  return readApiResponse<{ok:true;sent:number;failed:number}>(r,"Unable to send TradeCUE alert");
}
    9