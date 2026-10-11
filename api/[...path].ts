type EndpointModule={handle:(request:Request)=>Promise<Response>|Response};
type Loader=()=>Promise<EndpointModule>;

const routes:Record<string,Loader>={
  "POST /_realtime/lastseen":()=>import("../endpoints/_realtime/lastseen_POST"),
  "POST /_realtime/send":()=>import("../endpoints/_realtime/send_POST"),
  "POST /_realtime/token":()=>import("../endpoints/_realtime/token_POST"),
  "POST /admin/billing-setup":()=>import("../endpoints/admin/billing-setup_POST"),
  "POST /admin/coupon-status":()=>import("../endpoints/admin/coupon-status_POST"),
  "GET /admin/coupons":()=>import("../endpoints/admin/coupons_GET"),
  "POST /admin/coupons":()=>import("../endpoints/admin/coupons_POST"),
  "POST /admin/journal-reconcile":()=>import("../endpoints/admin/journal-reconcile_POST"),
  "GET /admin/member":()=>import("../endpoints/admin/member_GET"),
  "POST /admin/member-control":()=>import("../endpoints/admin/member-control_POST"),
  "POST /admin/member-coupon":()=>import("../endpoints/admin/member-coupon_POST"),
  "GET /admin/members":()=>import("../endpoints/admin/members_GET"),
  "GET /admin/overview":()=>import("../endpoints/admin/overview_GET"),
  "GET /admin/webull-bars":()=>import("../endpoints/admin/webull-bars_GET"),
  "GET /admin/webull-paper":()=>import("../endpoints/admin/webull-paper_GET"),
  "POST /auth/login_with_password":()=>import("../endpoints/auth/login_with_password_POST"),
  "POST /auth/logout":()=>import("../endpoints/auth/logout_POST"),
  "POST /auth/register_with_password":()=>import("../endpoints/auth/register_with_password_POST"),
  "GET /auth/session":()=>import("../endpoints/auth/session_GET"),
  "GET /automation/control":()=>import("../endpoints/automation/control_GET"),
  "POST /automation/control":()=>import("../endpoints/automation/control_POST"),
  "POST /automation/exit-guard":()=>import("../endpoints/automation/exit-guard_POST"),
  "POST /automation/kill":()=>import("../endpoints/automation/kill_POST"),
  "POST /billing/checkout":()=>import("../endpoints/billing/checkout_POST"),
  "POST /billing/portal":()=>import("../endpoints/billing/portal_POST"),
  "POST /billing/webhook":()=>import("../endpoints/billing/webhook_POST"),
  "GET /bot/health":()=>import("../endpoints/bot/health_GET"),
  "POST /bot/worker-access":()=>import("../endpoints/bot/worker-access_POST"),
  "GET /bot/worker-status":()=>import("../endpoints/bot/worker-status_GET"),
  "POST /bot/worker-tick":()=>import("../endpoints/bot/worker-tick_POST"),
  "POST /brain/run":()=>import("../endpoints/brain/run_POST"),
  "POST /coupons/redeem":()=>import("../endpoints/coupons/redeem_POST"),
  "GET /fundamentals/brief":()=>import("../endpoints/fundamentals/brief_GET"),
  "GET /futures/brief":()=>import("../endpoints/futures/brief_GET"),
  "GET /hunter/scan":()=>import("../endpoints/hunter/scan_GET"),
  "GET /journal/activity":()=>import("../endpoints/journal/activity_GET"),
  "GET /journal/chart-trades":()=>import("../endpoints/journal/chart-trades_GET"),
  "POST /journal/decision":()=>import("../endpoints/journal/decision_POST"),
  "POST /journal/sync":()=>import("../endpoints/journal/sync_POST"),
  "GET /learning/summary":()=>import("../endpoints/learning/summary_GET"),
  "GET /market/intelligence":()=>import("../endpoints/market/intelligence_GET"),
  "GET /market/position-monitor":()=>import("../endpoints/market/position-monitor_GET"),
  "GET /market/pulse":()=>import("../endpoints/market/pulse_GET"),
  "GET /market/webull-fundamentals":()=>import("../endpoints/market/webull-fundamentals_GET"),
  "GET /me/entitlements":()=>import("../endpoints/me/entitlements_GET"),
  "GET /outlook/latest":()=>import("../endpoints/outlook/latest_GET"),
  "POST /push/subscription":()=>import("../endpoints/push/subscription_POST"),
  "POST /push/test":()=>import("../endpoints/push/test_POST"),
  "GET /qa-matrix":()=>import("../endpoints/qa-matrix_GET"),
  "GET /reliability/status":()=>import("../endpoints/reliability/status_GET"),
  "GET /risk/macro":()=>import("../endpoints/risk/macro_GET"),
  "GET /search/symbols":()=>import("../endpoints/search/symbols_GET"),
  "GET /training/status":()=>import("../endpoints/training/status_GET"),
  "GET /version":()=>import("../endpoints/version_GET"),
  "GET /watchlist":()=>import("../endpoints/watchlist/index_GET"),
  "POST /watchlist/item":()=>import("../endpoints/watchlist/item_POST"),
  "GET /webull/account":()=>import("../endpoints/webull/account_GET"),
  "GET /webull/bars":()=>import("../endpoints/webull/bars_GET"),
  "GET /webull/callback":()=>import("../endpoints/webull/callback_GET"),
  "POST /webull/connect":()=>import("../endpoints/webull/connect_POST"),
  "POST /webull/disconnect":()=>import("../endpoints/webull/disconnect_POST"),
  "GET /webull/history":()=>import("../endpoints/webull/history_GET"),
  "POST /webull/keys":()=>import("../endpoints/webull/keys_POST"),
  "POST /webull/keys-disconnect":()=>import("../endpoints/webull/keys-disconnect_POST"),
  "GET /webull/live-account":()=>import("../endpoints/webull/live-account_GET"),
  "POST /webull/live-disconnect":()=>import("../endpoints/webull/live-disconnect_POST"),
  "POST /webull/live-keys":()=>import("../endpoints/webull/live-keys_POST"),
  "POST /webull/live-order":()=>import("../endpoints/webull/live-order_POST"),
  "POST /webull/order-cancel":()=>import("../endpoints/webull/order-cancel_POST"),
  "GET /webull/orders":()=>import("../endpoints/webull/orders_GET"),
  "POST /webull/paper-order":()=>import("../endpoints/webull/paper-order_POST"),
};

async function rawBody(req:any){
  if(req.method==="GET"||req.method==="HEAD")return undefined;
  if(typeof req.body==="string")return req.body;
  if(Buffer.isBuffer(req.body))return req.body;
  if(req.body!=null&&typeof req.body==="object")return JSON.stringify(req.body);
  const chunks:Buffer[]=[];
  for await(const chunk of req)chunks.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk));
  return chunks.length?Buffer.concat(chunks):undefined;
}

export default async function handler(req:any,res:any){
  try{
    const rawPath=Array.isArray(req.query?.path)?req.query.path.join("/"):String(req.query?.path??"");
    const route="/"+rawPath.replace(/^\/+|\/+$/g,"");
    const key=String(req.method||"GET").toUpperCase()+" "+route;
    const loader=routes[key];
    if(!loader){res.statusCode=404;res.end(JSON.stringify({error:"API route not found",route:key}));return;}

    const host=String(req.headers?.host||"localhost");
    const incoming=new URL(String(req.url||"/"),"https://"+host);
    const normalized=new URL("/_api"+route,"https://"+host);
    normalized.search=incoming.search;

    const headers=new Headers();
    for(const [name,value] of Object.entries(req.headers||{})){
      if(value==null)continue;
      if(Array.isArray(value))value.forEach(v=>headers.append(name,String(v)));
      else headers.set(name,String(value));
    }

    const body=await rawBody(req);
    const request=new Request(normalized.toString(),{
      method:String(req.method||"GET"),
      headers,
      body:body as any,
    });

    const mod=await loader();
    const response=await mod.handle(request);
    res.statusCode=response.status;

    const responseHeaders:any=response.headers as any;
    if(typeof responseHeaders.getSetCookie==="function"){
      const cookies=responseHeaders.getSetCookie();
      if(cookies?.length)res.setHeader("Set-Cookie",cookies);
    }
    response.headers.forEach((value,name)=>{
      if(name.toLowerCase()==="set-cookie")return;
      res.setHeader(name,value);
    });

    const buffer=Buffer.from(await response.arrayBuffer());
    res.end(buffer);
  }catch(error){
    res.statusCode=500;
    res.setHeader("Content-Type","application/json");
    res.end(JSON.stringify({error:error instanceof Error?error.message:"Unhandled API error"}));
  }
}
