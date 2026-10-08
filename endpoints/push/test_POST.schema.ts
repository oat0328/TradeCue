import { readApiResponse } from "../../helpers/apiClient";
export async function sendTestPush(){
  const r=await fetch("/_api/push/test",{method:"POST",credentials:"include"});
  return readApiResponse<{ok:true;sent:number;failed:number}>(r,"Unable to send test alert");
}