import { apiUser,apiFailure } from "../../helpers/apiAccess";
import { positionMonitorForUser } from "../../helpers/positionMonitorServer";
export async function handle(request:Request){
  try{return await positionMonitorForUser(await apiUser(request),Object.fromEntries(new URL(request.url).searchParams));}
  catch(error){return apiFailure(error);}
}
