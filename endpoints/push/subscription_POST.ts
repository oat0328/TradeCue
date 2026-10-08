import superjson from "superjson";
import { apiUser,apiJson,apiFailure,ApiError } from "../../helpers/apiAccess";
import { db } from "../../helpers/db";
import { schema } from "./subscription_POST.schema";

function identityOf(sub:Record<string,unknown>){
  const id=(typeof sub.endpoint==="string"&&sub.endpoint)||(typeof sub.fcmToken==="string"&&sub.fcmToken)||(typeof sub.apnsToken==="string"&&sub.apnsToken);
  if(!id)throw new ApiError(400,"Push subscription has no identity.");
  return id;
}
export async function handle(request:Request){
  try{
    const user=await apiUser(request);
    const text=await request.text();
    let raw:unknown;
    try{raw=superjson.parse(text);}catch{raw=JSON.parse(text);}
    const input=schema.parse(raw);
    if(input.action==="save"){
      const identity=identityOf(input.subscription);
      await db.insertInto("pushSubscriptions").values({userId:user.id,identity,subscription:input.subscription as any,updatedAt:new Date()})
        .onConflict(oc=>oc.columns(["userId","identity"]).doUpdateSet({subscription:input.subscription as any,updatedAt:new Date()})).execute();
    }else if(input.action==="delete"){
      await db.deleteFrom("pushSubscriptions").where("userId","=",user.id).where("identity","=",input.identity).execute();
    }else{
      await db.deleteFrom("pushSubscriptions").where("userId","=",user.id).execute();
    }
    return apiJson({ok:true});
  }catch(error){return apiFailure(error);}
}