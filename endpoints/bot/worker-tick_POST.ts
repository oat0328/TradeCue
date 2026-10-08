import superjson from "superjson";
import { apiJson,apiFailure,ApiError } from "../../helpers/apiAccess";
import { db } from "../../helpers/db";
import { validWorkerToken,workerTokenHash } from "../../helpers/workerToken";
import { runOmegaWorker } from "../../helpers/axiomWorkerServer";
import { schema } from "./worker-tick_POST.schema";
export async function handle(request:Request){
  try{
    const token=request.headers.get("authorization")?.replace(/^Bearer /,"")??"";
    if(!validWorkerToken(token))throw new ApiError(401,"Worker access required.");
    const access=await db.selectFrom("cueWorkerAccess").selectAll().where("tokenHash","=",workerTokenHash(token)).where("enabled","=",true).executeTakeFirst();
    if(!access)throw new ApiError(401,"Worker access required.");
    const user=await db.selectFrom("users").select(["id","role","email","displayName","avatarUrl"]).where("id","=",access.userId).executeTakeFirst();
    if(!user||user.role!=="admin")throw new ApiError(403,"Personal owner worker only.");
    const input=schema.parse(superjson.parse(await request.text()));
    return apiJson(await runOmegaWorker(user,input.dryRun||!access.paperExecutionEnabled));
  }catch(error){return apiFailure(error);}
}
