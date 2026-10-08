import {apiUser,apiJson,apiFailure}from "../../helpers/apiAccess";import {configureBilling}from "../../helpers/configureBilling";
export async function handle(request:Request){try{await apiUser(request,true);return apiJson(await configureBilling());}catch(e){return apiFailure(e);}}
