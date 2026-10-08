import { apiUser, apiJson, apiFailure } from "../../helpers/apiAccess";
import { userKeys, webullTodayOrders } from "../../helpers/webullClient";
import { schema } from "./orders_GET.schema";

export async function handle(request:Request){
  try{
    const user=await apiUser(request);
    const input=schema.parse(Object.fromEntries(new URL(request.url).searchParams));
    return apiJson({orders:await webullTodayOrders(await userKeys(user),input.accountId)});
  }catch(error){
    return apiFailure(error);
  }
}
   14