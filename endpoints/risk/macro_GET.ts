import { apiUser,apiJson,apiFailure } from "../../helpers/apiAccess";
import { serverMacroRisk } from "../../helpers/macroRiskServer";
export async function handle(request:Request){
  try{await apiUser(request);return apiJson(await serverMacroRisk());}
  catch(error){return apiFailure(error);}
}

