import {readApiResponse}from "../../helpers/apiClient";
export type OutputType={disconnected:true};
export async function postWebullLiveDisconnect():Promise<OutputType>{
 const r=await fetch("/_api/webull/live-disconnect",{method:"POST",credentials:"include"});
 return readApiResponse<OutputType>(r,"Unable to disconnect Webull Live");
}
