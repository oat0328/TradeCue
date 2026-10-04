import {apiUser,apiJson,apiFailure} from "../../helpers/apiAccess";
import {userKeys,webullSnapshot} from "../../helpers/webullClient";
import {schema} from "./account_GET.schema";
export async function handle(request:Request){try{const u=await apiUser(request);const v=schema.parse(Object.fromEntries(new URL(request.url).searchParams));return apiJson(await webullSnapshot(await userKeys(u),v.accountId));}catch(e){return apiFailure(e);}}
