import { apiUser,apiJson,apiFailure } from "../../helpers/apiAccess";
import { db } from "../../helpers/db";
export async function handle(request:Request){
  try{
    const user=await apiUser(request);
    const [automation,outlook,rows]=await Promise.all([
      db.selectFrom("cueAutomationControls").select(["brainEnabled","autoPaperEnabled","killSwitch","updatedAt"]).where("userId","=",user.id).executeTakeFirst(),
      db.selectFrom("cueDailyOutlooks").select(["outlookType","bias","updatedAt"]).where("userId","=",user.id).orderBy("updatedAt","desc").executeTakeFirst(),
      db.selectFrom("cueReliabilitySnapshots").select(["service","status","latencyMs","message","checkedAt"])
        .where(eb=>eb.or([eb("userId","=",user.id),eb("userId","is",null)])).orderBy("checkedAt","desc").limit(50).execute(),
    ]);
    const seen=new Set<string>();
    const services=rows.filter(row=>{if(seen.has(row.service))return false;seen.add(row.service);return true;}).map(row=>({
      service:row.service,status:row.status,latencyMs:row.latencyMs,message:row.message,checkedAt:new Date(row.checkedAt).toISOString(),
    }));
    return apiJson({
      automation:automation?{brainEnabled:automation.brainEnabled,autoPaperEnabled:automation.autoPaperEnabled,killSwitch:automation.killSwitch,updatedAt:new Date(automation.updatedAt).toISOString()}:null,
      latestOutlook:outlook?{type:outlook.outlookType,bias:outlook.bias,updatedAt:new Date(outlook.updatedAt).toISOString()}:null,
      services,
    });
  }catch(error){return apiFailure(error);}
}