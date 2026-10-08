import {z} from "zod";import superjson from "superjson";import {readApiResponse} from "../../helpers/apiClient";
export const schema=z.object({});export type OutputType={disconnected:true};
export async function postWebullKeysDisconnect():Promise<OutputType>{const r=await fetch("/_api/webull/keys-disconnect",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:superjson.stringify({})});return readApiResponse<OutputType>(r,"Unable to disconnect Webull PaperTrade");}
