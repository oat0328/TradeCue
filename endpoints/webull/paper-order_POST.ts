import superjson from "superjson";
import { apiUser,apiFailure } from "../../helpers/apiAccess";
import { executePaperOrder } from "../../helpers/paperOrderService";
export async function handle(request:Request){
  try{return await executePaperOrder(await apiUser(request),superjson.parse(await request.text()));}
  catch(error){return apiFailure(error);}
}
