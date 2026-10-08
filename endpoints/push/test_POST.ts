import { sendPushNotifications } from "@floot/push";
import { apiUser,apiJson,apiFailure,ApiError } from "../../helpers/apiAccess";
import { db } from "../../helpers/db";
export async function handle(request:Request){
  try{
    const user=await apiUser(request);
    const rows=await db.selectFrom("pushSubscriptions").select(["id","subscription"]).where("userId","=",user.id).execute();
    if(!rows.length)throw new ApiError(409,"Enable push alerts on this device first.");
    const results=await sendPushNotifications(rows.map(row=>row.subscription as any),{
      title:"TradeCUE alerts are live",
      body:"Your device is connected. Armed watchlist symbols can use this channel for CUE alerts.",
      url:"/workstation",
      tag:"tradecue-test-"+Date.now(),
      data:{type:"test"},
    });
    const gone=rows.filter((_,i)=>results[i]?.gone);
    if(gone.length)await db.deleteFrom("pushSubscriptions").where("id","in",gone.map(row=>row.id)).execute();
    return apiJson({ok:true,sent:results.filter(r=>r.success).length,failed:results.filter(r=>!r.success).length});
  }catch(error){return apiFailure(error);}
}