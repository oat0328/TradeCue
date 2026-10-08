import {apiUser,apiJson,apiFailure} from "../../helpers/apiAccess";
import {omegaHealthForUser} from "../../helpers/omegaHealthForUser";
import {schema} from "./health_GET.schema";
import {db} from "../../helpers/db";
import {workerStatus} from "../../helpers/workerStatus";
export async function handle(request:Request){
 try{
  const user=await apiUser(request);
  const input=schema.parse(Object.fromEntries(new URL(request.url).searchParams));
  const health=await omegaHealthForUser(user,input.accountId);
  const access=await db.selectFrom("cueWorkerAccess").selectAll().where("userId","=",user.id).executeTakeFirst();
  const state=await db.selectFrom("cueWorkerState").selectAll().where("userId","=",user.id).executeTakeFirst();
  const worker=workerStatus({enabled:access?.enabled??false,paperExecutionEnabled:access?.paperExecutionEnabled??false,completedAt:state?.completedAt??null,status:state?.status??null,mode:(state?.lastAction as any)?.mode??null});
  return apiJson({...health,executionMode:worker.executionMode,alwaysOnVerified:false,workerOnline:worker.fresh});
 }catch(error){return apiFailure(error);}
}