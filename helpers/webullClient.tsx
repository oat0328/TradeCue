import { randomUUID, createHash } from "crypto";
import { signWebullRequest, decryptBrokerSecret } from "./brokerCrypto";
import { db } from "./db";
import { ApiError } from "./apiAccess";
import { effectiveMembership } from "./effectiveMembership";

export type WebullKeys = {appKey:string;appSecret:string};

const webullGetCache = new Map<string,{expiresAt:number,value:any}>();
const webullInFlight = new Map<string,Promise<any>>();

function webullCacheKey(keys:WebullKeys,path:string,query:Record<string,string>){
 const keyHash=createHash("sha256").update(keys.appKey).digest("hex").slice(0,12);
 return keyHash+"|"+path+"|"+new URLSearchParams(Object.entries(query).sort()).toString();
}
function webullGetTtl(path:string){
 if(path.includes("/fundamentals/")) return 5*60_000;
 if(path.includes("/screeners/")) return 20_000;
 if(path.includes("/snapshots/")) return 8_000;
 if(path.includes("/bars/")) return 8_000;
 if(path.includes("/trading/assets/")) return 15_000;
 if(path.includes("/trading/accounts/")) return 30_000;
 return 5_000;
}
function wait(ms:number){return new Promise(resolve=>setTimeout(resolve,ms));}

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

export async function webullRead(
  keys:WebullKeys,
  path:string,
  query:Record<string,string>={},
  body?:unknown,
  extraHeaders:Record<string,string>={},
) {
 const isGet=body===undefined;
 const cacheKey=isGet?webullCacheKey(keys,path,query):null;
 if(cacheKey){
   const cached=webullGetCache.get(cacheKey);
   if(cached&&cached.expiresAt>Date.now()) return cached.value;
   const existing=webullInFlight.get(cacheKey);
   if(existing) return existing;
 }

 const execute=async()=>{
   const host="api.sandbox.webull.com";
   const text=body===undefined?"":JSON.stringify(body);
   const url=new URL(path,"https://"+host);
   for(const [k,v]of Object.entries(query)) url.searchParams.set(k,v);

   let lastError:ApiError|null=null;
   for(let attempt=0;attempt<3;attempt++){
     const response=await fetch(url,{
       method:isGet?"GET":"POST",
       headers:{
         Accept:"application/json",
         "Content-Type":"application/json",
         ...signWebullRequest({host,path,query,body:text,...keys}),
         ...extraHeaders,
       },
       body:text||undefined,
       signal:AbortSignal.timeout(15000),
     });
     const data=await response.json().catch(()=>null);
     const code=typeof data?.error_code==="string"?data.error_code:"HTTP_"+response.status;
     const message=typeof data?.message==="string"?data.message:"Webull rejected the request.";
     const rateLimited=response.status===429||code==="TOO_MANY_REQUESTS";

     if(response.ok&&!data?.error_code){
       if(cacheKey) webullGetCache.set(cacheKey,{expiresAt:Date.now()+webullGetTtl(path),value:data});
       return data;
     }

     if(rateLimited&&attempt<2){
       const retryAfter=Number(response.headers.get("retry-after"));
       await wait(Number.isFinite(retryAfter)&&retryAfter>0?retryAfter*1000:700*Math.pow(2,attempt));
       continue;
     }

     lastError=rateLimited
       ? new ApiError(429,"Webull is rate-limiting market requests. TradeCUE is backing off automatically; wait a moment and retry.")
       : new ApiError(502,"Webull "+code+": "+message);
     break;
   }
   throw lastError??new ApiError(502,"Webull request failed.");
 };

 if(!cacheKey) return execute();
 const promise=execute().finally(()=>webullInFlight.delete(cacheKey));
 webullInFlight.set(cacheKey,promise);
 return promise;
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

export async function webullAccounts(keys:WebullKeys) {
 const rows=webullRows(await webullRead(keys,"/trading/accounts/list"));
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

export async function webullInstrument(keys:WebullKeys, symbol:string) {
 const raw=await webullRead(keys,"/market-data/stocks/snapshots/list",{
   symbols:symbol,
   category:"US_STOCK",
   extend_hour_required:"true",
 });
 const rows=webullRows(raw);
 const row=rows.find(r=>String(r.symbol||"").toUpperCase()===symbol.toUpperCase()) ?? rows[0];
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

export async function placeWebullPaperOrder(keys:WebullKeys,input:PaperOrderInput) {
 const accounts=await webullAccounts(keys);
 if(!accounts.some(account=>account.accountId===input.accountId)) throw new ApiError(403,"That Webull paper account is not available to this member.");
 const instrumentId=await webullInstrument(keys,input.symbol);
 const clientOrderId=randomUUID().replace(/-/g,"");
 const order=webullV3StockOrder(input,clientOrderId);
 const response=await webullRead(keys,"/trading/orders/place",{},{
   account_id:input.accountId,
   new_orders:[order],
 });
 return {response,instrumentId,clientOrderId};
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
   limitPrice:row.limit_price!=null?String(row.limit_price):null,
   status:String(row.status??row.order_status??"UNKNOWN"),
   createdAt:row.place_time_at??row.created_time??row.created_at??row.create_time??null,
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

