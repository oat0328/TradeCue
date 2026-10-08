import {createToken} from "@floot/realtime";
import {apiUser,apiJson,apiFailure,ApiError} from "../../helpers/apiAccess";
import {channels} from "../../helpers/realtimeChannels";
export async function handle(request:Request){
 try{
  const user=await apiUser(request);
  const result=await createToken({userId:String(user.id),channels:[channels.omega(user.id)],ttlSeconds:3600});
  if(!result.ok)throw new ApiError(502,result.error.message);
  return apiJson({token:result.token,wssEndpoint:result.wssEndpoint,userId:String(user.id)});
 }catch(error){return apiFailure(error);}
}