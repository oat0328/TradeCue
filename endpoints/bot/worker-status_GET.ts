import {apiUser,apiJson,apiFailure} from "../../helpers/apiAccess";
import {db} from "../../helpers/db";
import {workerStatus} from "../../helpers/workerStatus";
export async function handle(request:Request){
 try{
 const user=await apiUser(request);
 const [access,state]=await Promise.all([
  db.selectFrom("cueWorkerAccess").select(["enabled","paperExecutionEnabled"]).where("userId","=",user.id).executeTakeFirst(),
  db.selectFrom("cueWorkerState").select(["completedAt","status","message","lastAction"]).where("userId","=",user.id).executeTakeFirst()
 ]);
 const evidence=workerStatus({enabled:access?.enabled??false,paperExecutionEnabled:access?.paperExecutionEnabled??false,completedAt:state?.completedAt??null,status:state?.status??null,mode:(state?.lastAction as any)?.mode??null});
 return apiJson({...evidence,enabled:access?.enabled??false,paperExecutionEnabled:access?.paperExecutionEnabled??false,mode:(state?.lastAction as any)?.mode??null,proof:(state?.lastAction as any)?.proof??null,status:state?.status??"NOT_STARTED",message:state?.message??"Background runner has not checked in.",completedAt:state?.completedAt?new Date(state.completedAt).toISOString():null});
 }catch(error){return apiFailure(error);}
}
