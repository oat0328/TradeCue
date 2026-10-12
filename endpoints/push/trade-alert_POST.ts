import {sendPushNotifications} from "@floot/push";
import {apiUser,apiJson,apiFailure,ApiError} from "../../helpers/apiAccess";
import {db} from "../../helpers/db";

const EVENTS=["ENTRY_READY","TP1","TP2","TP3","TP4","STOP"] as const;
type EventName=typeof EVENTS[number];

function finite(value:unknown){
  const n=Number(value);
  return Number.isFinite(n)?n:null;
}
function money(value:number){
  return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:value>=100?2:4}).format(value);
}

export async function handle(request:Request){
  try{
    const user=await apiUser(request);
    const raw=await request.json().catch(()=>null) as any;
    const symbol=String(raw?.symbol??"").trim().toUpperCase();
    const event=String(raw?.event??"") as EventName;
    const price=finite(raw?.price);
    const setup=String(raw?.setup??"TradeCUE").slice(0,60);
    if(!/^[A-Z0-9.-]{1,15}$/.test(symbol))throw new ApiError(400,"Invalid symbol.");
    if(!EVENTS.includes(event))throw new ApiError(400,"Invalid trade alert event.");
    if(price==null||price<=0)throw new ApiError(400,"Invalid alert price.");

    const rows=await db.selectFrom("pushSubscriptions").select(["id","subscription"]).where("userId","=",user.id).execute();
    if(!rows.length)return apiJson({ok:true,sent:0,failed:0});

    const title=event==="ENTRY_READY"
      ?"🟢 ENTRY READY — "+symbol
      :event==="STOP"
        ?"🔴 STOP / INVALIDATION — "+symbol
        :"✅ "+event+" HIT — "+symbol;
    const body=(event==="ENTRY_READY"
      ?setup+" is armed at "
      :event==="STOP"
        ?"Price crossed the protected stop at "
        :setup+" reached "+event+" at ")+money(price)+" · paper-trading alert.";
    const results=await sendPushNotifications(rows.map(row=>row.subscription as any),{
      title,
      body,
      url:"/workstation",
      tag:"tradecue-"+symbol+"-"+event+"-"+price.toFixed(4),
      data:{type:"trade-alert",symbol,event,price,setup},
    });
    const gone=rows.filter((_,i)=>results[i]?.gone);
    if(gone.length)await db.deleteFrom("pushSubscriptions").where("id","in",gone.map(row=>row.id)).execute();
    return apiJson({ok:true,sent:results.filter(r=>r.success).length,failed:results.filter(r=>!r.success).length});
  }catch(error){return apiFailure(error);}
}
   53