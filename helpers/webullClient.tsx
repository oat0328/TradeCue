import { randomUUID } from "crypto";
import { signWebullRequest, decryptBrokerSecret } from "./brokerCrypto";
import { db } from "./db";
import { ApiError } from "./apiAccess";
import { effectiveMembership } from "./effectiveMembership";
import { sharedMarketRead } from "./sharedMarketRead";
import { brokerTime } from "./brokerTime";

export type WebullKeys = {appKey:string;appSecret:string};
export type WebullEnvironment = "sandbox"|"live";

type ReadCacheEntry={data:unknown;expiresAt:number};
const readCache=new Map<string,ReadCacheEntry>();
const inflightReads=new Map<string,Promise<unknown>>();
const endpointQueues=new Map<string,Promise<void>>();
const endpointLastRequestAt=new Map<string,number>();

function sleep(ms:number){return new Promise(resolve=>setTimeout(resolve,ms));}
function marketDataPath(path:string){return path.startsWith("/market-data/");}
function cacheTtl(path:string){
 if(path.includes("/stocks/bars/"))return 10_000;
 if(path.includes("/snapshots/"))return 8_000;
 if(path.includes("/screeners/"))return 45_000;
 if(path.includes("/fundamentals/"))return 5*60_000;
 if(path==="/trading/accounts/list")return 30_000;
 if(path.includes("/trading/assets/"))return 8_000;
 if(path.includes("/historical-orders/"))return 10_000;
 return 0;
}
async function pacedMarketRequest<T>(path:string,worker:()=>Promise<T>):Promise<T>{
 let release!:()=>void;
 const previous=endpointQueues.get(path)??Promise.resolve();
 endpointQueues.set(path,new Promise<void>(resolve=>{release=resolve;}));
 await previous;
 const last=endpointLastRequestAt.get(path)??0;
 const gap=Date.now()-last;
 // Webull sandbox market-data endpoints are generally capped at 30 requests/60s/app-key.
 if(gap<2050)await sleep(2050-gap);
 try{return await worker();}
 finally{endpointLastRequestAt.set(path,Date.now());release();}
}

export function ownerKeys(): WebullKeys {
 const e=process.env as Record<string,string|undefined>;
 if(!e.WEBULL_APP_KEY || !e.WEBULL_APP_SECRET) throw new ApiError(503,"Add your Webull PaperTrade App Key and App Secret.");
 return {appKey:e.WEBULL_APP_KEY.trim(),appSecret:e.WEBULL_APP_SECRET.trim()};
}

export async function userKeys(user:{id:number;role:string}): Promise<WebullKeys> {
 const m=await effectiveMembership(user.id,user.role==="admin");
 if(!m.accessActive || m.tier==="scout") throw new ApiError(403,"An active Copilot or Autopilot membership is required.");
 const saved=await db.selectFrom("webullCredentials").selectAll().where("userId","=",user.id).executeTakeFirst();
 if(saved) return {appKey:decryptBrokerSecret(saved.appKeyEncrypted),appSecret:decryptBrokerSecret(saved.appSecretEncrypted)};
 if(user.role==="admin") return ownerKeys();
 throw new ApiError(409,"Connect your own Webull PaperTrade App Key and App Secret.");
}

export async function liveUserKeys(user:{id:number;role:string}): Promise<WebullKeys> {
 const row=await db.selectFrom("brokerConnections")
   .select(["metadata"])
   .where("userId","=",user.id)
   .where("provider","=","webull")
   .where("isPaper","=",false)
   .where("status","=","connected")
   .orderBy("updatedAt","desc")
   .executeTakeFirst();
 const metadata=(row?.metadata&&typeof row.metadata==="object"&&!Array.isArray(row.metadata)?row.metadata:{}) as Record<string,unknown>;
 const encryptedAppKey=typeof metadata.encryptedAppKey==="string"?metadata.encryptedAppKey:null;
 const encryptedAppSecret=typeof metadata.encryptedAppSecret==="string"?metadata.encryptedAppSecret:null;
 if(encryptedAppKey&&encryptedAppSecret)return {appKey:decryptBrokerSecret(encryptedAppKey),appSecret:decryptBrokerSecret(encryptedAppSecret)};
 const e=process.env as Record<string,string|undefined>;
 if(user.role==="admin"&&e.WEBULL_LIVE_APP_KEY&&e.WEBULL_LIVE_APP_SECRET)return {appKey:e.WEBULL_LIVE_APP_KEY.trim(),appSecret:e.WEBULL_LIVE_APP_SECRET.trim()};
 throw new ApiError(409,"Connect approved Webull Production OpenAPI credentials before using live trading.");
}

export async function webullRead(keys:WebullKeys,path:string,query:Record<string,string>={},body?:unknown,extraHeaders:Record<string,string>={}):Promise<any>{
 if(marketDataPath(path))return sharedMarketRead(keys.appKey,path,query,body,cacheTtl(path),()=>webullReadDirect(keys,path,query,body,extraHeaders));
 return webullReadDirect(keys,path,query,body,extraHeaders);
}
export async function webullReadLive(keys:WebullKeys,path:string,query:Record<string,string>={},body?:unknown,extraHeaders:Record<string,string>={}):Promise<any>{
 return webullReadDirect(keys,path,query,body,extraHeaders,"live");
}
async function webullReadDirect(
  keys:WebullKeys,
  path:string,
  query:Record<string,string>={},
  body?:unknown,
  extraHeaders:Record<string,string>={},
  environment:WebullEnvironment="sandbox",
) {
 const host=environment==="live"?"api.webull.com":"api.sandbox.webull.com";
 const text=body===undefined?"":JSON.stringify(body);
 const ttl=cacheTtl(path);
 const cacheKey=ttl?keys.appKey+"|"+path+"|"+JSON.stringify(query)+"|"+text:"";
 const cached=cacheKey?readCache.get(cacheKey):undefined;
 if(cached&&cached.expiresAt>Date.now())return cached.data;
 if(cacheKey){
   const pending=inflightReads.get(cacheKey);
   if(pending)return pending;
 }
 const url=new URL(path,"https://"+host);
 for(const [k,v]of Object.entries(query)) url.searchParams.set(k,v);
 const request=async()=>{
   let lastCode="";
   let lastMessage="Webull rejected the request.";
   for(let attempt=0;attempt<2;attempt++){
     const doFetch=async()=>fetch(url,{
       method:body===undefined?"GET":"POST",
       headers:{
         Accept:"application/json",
         "Content-Type":"application/json",
         ...signWebullRequest({host,path,query,body:text,...keys}),
         ...extraHeaders,
       },
       body:text||undefined,
       signal:AbortSignal.timeout(15000),
     });
     const response=marketDataPath(path)?await pacedMarketRequest(path,doFetch):await doFetch();
     const data=await response.json().catch(()=>null);
     if(response.ok&&!data?.error_code){
       if(cacheKey)readCache.set(cacheKey,{data,expiresAt:Date.now()+ttl});
       return data;
     }
     const code=typeof data?.error_code==="string"?data.error_code:"HTTP_"+response.status;
     const message=typeof data?.message==="string"?data.message:"Webull rejected the request.";
     lastCode=code;lastMessage=message;
     const throttled=response.status===429||/TOO_MANY_REQUESTS/i.test(code+" "+message);
     // Never automatically retry order placement or cancellation after a broker response.
     if(throttled&&body===undefined&&!marketDataPath(path)&&attempt===0){await sleep(650);continue;}
     throw new ApiError(502,"Webull "+code+": "+message);
   }
   throw new ApiError(502,"Webull "+lastCode+": "+lastMessage);
 };
 if(!cacheKey)return request();
 const pending=request();
 inflightReads.set(cacheKey,pending);
 try{return await pending;}
 finally{inflightReads.delete(cacheKey);}
}

export function webullRows(data:unknown): Record<string,any>[] {
 if(Array.isArray(data))return data.filter(x=>x && typeof x==="object");
 if(data && typeof data==="object")for(const key of ["data","items","accounts","positions","holdings","orders","result"]) {
   const value=(data as any)[key];
   if(Array.isArray(value)) {
     if(value.length && value[0] && typeof value[0]==="object" && Array.isArray((value[0] as any).result)) return webullRows((value[0] as any).result);
     return value.filter(x=>x && typeof x==="object");
   }
   if(value && typeof value==="object"){const nested=webullRows(value);if(nested.length)return nested;}
 }
 return [];
}

export async function webullAccounts(keys:WebullKeys,environment:WebullEnvironment="sandbox") {
 const reader=environment==="live"?webullReadLive:webullRead;
 const rows=webullRows(await reader(keys,"/trading/accounts/list"));
 return rows.filter(r=>r.account_id).map(r=>({
   accountId:String(r.account_id),
   accountMask:"••••"+String(r.account_number||r.account_id).slice(-4),
   accountType:String(r.account_label||r.account_type||"Paper")
 }));
}

export async function webullSnapshot(keys:WebullKeys, requested?:string) {
 const accounts=await webullAccounts(keys);
 if(!accounts.length)throw new ApiError(409,"Webull returned no PaperTrade accounts. Activate a sandbox paper account in Webull.");
 const selected=requested?accounts.find(a=>a.accountId===requested):accounts[0];
 if(!selected)throw new ApiError(403,"This account is not available to your Webull connection.");
 const [balance,positions]=await Promise.all([
   webullRead(keys,"/trading/assets/balances/get",{account_id:selected.accountId}),
   webullRead(keys,"/trading/assets/positions/list",{account_id:selected.accountId}),
 ]);
 const b=balance?.data||balance;
 const currency=webullRows(b?.account_currency_assets).find(r=>r.currency==="USD")||{};
 const scalar=(v:unknown)=>typeof v==="string"||typeof v==="number"?String(v):null;
 return {
   connected:true as const,
   environment:"sandbox" as const,
   accounts,
   selectedAccountId:selected.accountId,
   updatedAt:new Date(),
   balance:{
     cash:scalar(b?.total_cash_balance),
     equity:scalar(b?.total_net_liquidation_value),
     dayPnl:scalar(b?.total_day_profit_loss),
     buyingPower:scalar(currency.cash_buying_power ?? currency.buying_power ?? currency.day_buying_power),
     currency:String(b?.total_asset_currency||"USD"),
   },
   positions:webullRows(positions).map(r=>({
     symbol:String(r.symbol||r.ticker||r.instrument?.symbol||"—"),
     quantity:scalar(r.quantity??r.total_quantity??r.qty),
     marketValue:scalar(r.market_value),
     unrealizedPnl:scalar(r.unrealized_profit_loss),
     costPrice:scalar(r.cost_price??r.avg_cost),
   })),
 };
}

export async function webullLiveSnapshot(keys:WebullKeys,requested?:string){
 const accounts=await webullAccounts(keys,"live");
 if(!accounts.length)throw new ApiError(409,"Webull Production returned no trading accounts for these credentials.");
 const selected=requested?accounts.find(a=>a.accountId===requested):accounts[0];
 if(!selected)throw new ApiError(403,"This live Webull account is not available to this connection.");
 const [balance,positions]=await Promise.all([
   webullReadLive(keys,"/trading/assets/balances/get",{account_id:selected.accountId}),
   webullReadLive(keys,"/trading/assets/positions/list",{account_id:selected.accountId}),
 ]);
 const b=balance?.data||balance;
 const currency=webullRows(b?.account_currency_assets).find(r=>r.currency==="USD")||{};
 const scalar=(v:unknown)=>typeof v==="string"||typeof v==="number"?String(v):null;
 return {
   connected:true as const,
   environment:"live" as const,
   accounts,
   selectedAccountId:selected.accountId,
   updatedAt:new Date(),
   balance:{
     cash:scalar(b?.total_cash_balance),
     equity:scalar(b?.total_net_liquidation_value),
     dayPnl:scalar(b?.total_day_profit_loss),
     buyingPower:scalar(currency.cash_buying_power ?? currency.buying_power ?? currency.day_buying_power),
     currency:String(b?.total_asset_currency||"USD"),
   },
   positions:webullRows(positions).map(r=>({
     symbol:String(r.symbol||r.ticker||r.instrument?.symbol||"—"),
     quantity:scalar(r.quantity??r.total_quantity??r.qty),
     marketValue:scalar(r.market_value),
     unrealizedPnl:scalar(r.unrealized_profit_loss),
     costPrice:scalar(r.cost_price??r.avg_cost),
   })),
 };
}

export async function webullInstrument(keys:WebullKeys, symbol:string) {
 const raw=await webullRead(keys,"/market-data/stocks/snapshots/list",{
   symbols:symbol,
   category:"US_STOCK",
   extend_hour_required:"true",
 });
 const rows=webullRows(raw);
 const row=rows.find(r=>String(r.symbol||"").toUpperCase()===symbol.toUpperCase());
 const instrumentId=row?.instrument_id ?? row?.instrumentId;
 if(!instrumentId) throw new ApiError(409,"Webull did not return an instrument ID for "+symbol+".");
 return String(instrumentId);
}

export type PaperOrderInput = {
 accountId:string;
 symbol:string;
 side:"BUY"|"SELL";
 orderType:"MARKET"|"LIMIT";
 quantity:number;
 limitPrice?:number;
};

export type PaperBracketInput=PaperOrderInput&{
  stopPrice:number;
  takeProfitPrice:number;
};

function webullV3StockOrder(input:PaperOrderInput,clientOrderId:string){
 const order:Record<string,unknown>={
   combo_type:"NORMAL",
   client_order_id:clientOrderId,
   symbol:input.symbol,
   instrument_type:"EQUITY",
   market:"US",
   order_type:input.orderType,
   quantity:String(input.quantity),
   support_trading_session:"CORE",
   side:input.side,
   time_in_force:"DAY",
   entrust_type:"QTY",
 };
 if(input.orderType==="LIMIT")order.limit_price=String(input.limitPrice);
 return order;
}

function webullV3BracketOrder(input:PaperBracketInput,ids:{combo:string;master:string;profit:string;stop:string}){
 const base={
   symbol:input.symbol,
   instrument_type:"EQUITY",
   market:"US",
   quantity:String(input.quantity),
   time_in_force:"DAY",
   support_trading_session:"CORE",
   entrust_type:"QTY",
 };
 const master:Record<string,unknown>={
   ...base,
   client_order_id:ids.master,
   combo_type:"MASTER",
   side:"BUY",
   order_type:input.orderType,
 };
 if(input.orderType==="LIMIT")master.limit_price=String(input.limitPrice);
 const profit={
   ...base,
   client_order_id:ids.profit,
   combo_type:"STOP_PROFIT",
   side:"SELL",
   order_type:"LIMIT",
   limit_price:String(input.takeProfitPrice),
 };
 const stop={
   ...base,
   client_order_id:ids.stop,
   combo_type:"STOP_LOSS",
   side:"SELL",
   order_type:"STOP_LOSS",
   stop_price:String(input.stopPrice),
 };
 return {account_id:input.accountId,client_combo_order_id:ids.combo,new_orders:[master,profit,stop]};
}

export async function previewWebullPaperOrder(keys:WebullKeys,input:PaperOrderInput) {
 const accounts=await webullAccounts(keys);
 if(!accounts.some(account=>account.accountId===input.accountId)) throw new ApiError(403,"That Webull paper account is not available to this member.");
 const clientOrderId=randomUUID().replace(/-/g,"");
 const order=webullV3StockOrder(input,clientOrderId);
 const response=await webullRead(keys,"/trading/orders/preview",{},{
   account_id:input.accountId,
   new_orders:[order],
 });
 return {response,clientOrderId};
}

export async function previewWebullPaperBracket(keys:WebullKeys,input:PaperBracketInput){
 const accounts=await webullAccounts(keys);
 if(!accounts.some(account=>account.accountId===input.accountId))throw new ApiError(403,"That Webull paper account is not available to this member.");
 const ids={
   combo:randomUUID().replace(/-/g,""),
   master:randomUUID().replace(/-/g,""),
   profit:randomUUID().replace(/-/g,""),
   stop:randomUUID().replace(/-/g,""),
 };
 const body=webullV3BracketOrder(input,ids);
 const response=await webullRead(keys,"/trading/orders/preview",{},body);
 return {response,ids};
}

// `fixedClientOrderId` (audit H-01): the order route reserves a durable intent first and passes
// its pre-generated id here, so a retry of the same intent reuses the same broker client_order_id.
export async function placeWebullPaperOrder(keys:WebullKeys,input:PaperOrderInput,fixedClientOrderId?:string) {
 const accounts=await webullAccounts(keys);
 if(!accounts.some(account=>account.accountId===input.accountId)) throw new ApiError(403,"That Webull paper account is not available to this member.");
 const instrumentId=await webullInstrument(keys,input.symbol);
 const clientOrderId=fixedClientOrderId??randomUUID().replace(/-/g,"");
 const order=webullV3StockOrder(input,clientOrderId);
 const response=await webullRead(keys,"/trading/orders/place",{},{
   account_id:input.accountId,
   new_orders:[order],
 });
 return {response,instrumentId,clientOrderId};
}

export async function placeWebullPaperBracket(keys:WebullKeys,input:PaperBracketInput,fixedIds?:{combo:string;master:string;profit:string;stop:string}){
 const accounts=await webullAccounts(keys);
 if(!accounts.some(account=>account.accountId===input.accountId))throw new ApiError(403,"That Webull paper account is not available to this member.");
 const instrumentId=await webullInstrument(keys,input.symbol);
 const ids=fixedIds??{
   combo:randomUUID().replace(/-/g,""),
   master:randomUUID().replace(/-/g,""),
   profit:randomUUID().replace(/-/g,""),
   stop:randomUUID().replace(/-/g,""),
 };
 const response=await webullRead(keys,"/trading/orders/place",{},webullV3BracketOrder(input,ids));
 return {response,instrumentId,clientOrderId:ids.master,comboClientOrderId:ids.combo,childOrderIds:{profit:ids.profit,stop:ids.stop}};
}

export async function previewWebullLiveOrder(keys:WebullKeys,input:PaperOrderInput){
 const accounts=await webullAccounts(keys,"live");
 if(!accounts.some(account=>account.accountId===input.accountId))throw new ApiError(403,"That live Webull account is not available.");
 const clientOrderId=randomUUID().replace(/-/g,"");
 const order=webullV3StockOrder(input,clientOrderId);
 const response=await webullReadLive(keys,"/trading/orders/preview",{},{
   account_id:input.accountId,
   new_orders:[order],
 });
 return {response,clientOrderId};
}

export async function placeWebullLiveOrder(keys:WebullKeys,input:PaperOrderInput,fixedClientOrderId?:string){
 const accounts=await webullAccounts(keys,"live");
 if(!accounts.some(account=>account.accountId===input.accountId))throw new ApiError(403,"That live Webull account is not available.");
 const clientOrderId=fixedClientOrderId??randomUUID().replace(/-/g,"");
 const order=webullV3StockOrder(input,clientOrderId);
 const response=await webullReadLive(keys,"/trading/orders/place",{},{
   account_id:input.accountId,
   new_orders:[order],
 });
 return {response,clientOrderId};
}

function flattenOrderGroups(raw:unknown){
 const groups=webullRows(raw);
 const rows:Record<string,any>[]=[];
 for(const group of groups){
   if(Array.isArray(group.orders)){
     for(const order of group.orders){
       if(order&&typeof order==="object")rows.push(order as Record<string,any>);
     }
   }else{
     rows.push(group);
   }
 }
 return rows;
}

export async function webullTodayOrders(keys:WebullKeys,accountId:string) {
 const accounts=await webullAccounts(keys);
 if(!accounts.some(account=>account.accountId===accountId)) throw new ApiError(403,"That Webull paper account is not available to this member.");
 const raw=await webullRead(keys,"/trading/orders/historical-orders/list",{account_id:accountId});
 return flattenOrderGroups(raw).map(row=>({
   clientOrderId:String(row.client_order_id??row.clientOrderId??""),
   orderId:row.order_id!=null?String(row.order_id):row.orderId!=null?String(row.orderId):null,
   symbol:String(row.symbol??row.ticker??row.instrument?.symbol??"—"),
   side:String(row.side??""),
   orderType:String(row.order_type??row.orderType??""),
   quantity:row.total_quantity!=null?String(row.total_quantity):row.quantity!=null?String(row.quantity):row.qty!=null?String(row.qty):null,
   filledQuantity:row.filled_quantity!=null?String(row.filled_quantity):row.filled_qty!=null?String(row.filled_qty):null,
   filledPrice:row.avg_filled_price!=null?String(row.avg_filled_price):row.filled_price!=null?String(row.filled_price):row.avg_fill_price!=null?String(row.avg_fill_price):null,
   filledAt:brokerTime(row.filled_time??row.filled_at??row.update_time_at??row.updated_time),
   limitPrice:row.limit_price!=null?String(row.limit_price):null,
   status:String(row.status??row.order_status??"UNKNOWN"),
   createdAt:brokerTime(row.place_time_at??row.created_time??row.created_at??row.create_time),
 }));
}

export async function cancelWebullPaperOrder(keys:WebullKeys,accountId:string,clientOrderId:string) {
 const accounts=await webullAccounts(keys);
 if(!accounts.some(account=>account.accountId===accountId)) throw new ApiError(403,"That Webull paper account is not available to this member.");
 return webullRead(keys,"/trading/orders/cancel",{},{
   account_id:accountId,
   client_order_id:clientOrderId,
 });
}

