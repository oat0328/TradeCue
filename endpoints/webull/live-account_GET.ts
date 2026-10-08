import {apiUser,apiJson,apiFailure}from "../../helpers/apiAccess";
import {liveUserKeys,webullLiveSnapshot}from "../../helpers/webullClient";
import {effectiveMembership}from "../../helpers/effectiveMembership";
import {ApiError}from "../../helpers/apiAccess";
import {schema}from "./live-account_GET.schema";
export async function handle(request:Request){
 try{
  const user=await apiUser(request);
  const membership=await effectiveMembership(user.id,user.role==="admin");
  if(!membership.accessActive||membership.tier==="scout")throw new ApiError(403,"Copilot or Autopilot access is required for live Webull.");
  const input=schema.parse(Object.fromEntries(new URL(request.url).searchParams));
  return apiJson(await webullLiveSnapshot(await liveUserKeys(user),input.accountId));
 }catch(e){return apiFailure(e);}
}
