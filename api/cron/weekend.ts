import {cueWeekend} from "../../helpers/cueWeekend";
import {allowed,cronResponse} from "./_guard";
export default async function(req:any,res:any){
  if(!allowed(req))return cronResponse(res,401,{error:"unauthorized"});
  await cueWeekend();
  return cronResponse(res,200,{ok:true,job:"weekend"});
}
