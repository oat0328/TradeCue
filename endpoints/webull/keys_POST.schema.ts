import {z} from "zod";
import superjson from "superjson";
import {readApiResponse} from "../../helpers/apiClient";
export const schema=z.object({appKey:z.string().trim().min(16).max(256),appSecret:z.string().trim().min(16).max(256)});
export type OutputType={connected:true;accountCount:number};
export async function postWebullKeys(body:z.infer<typeof schema>):Promise<OutputType>{const r=await fetch("/_api/webull/keys",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:superjson.stringify(schema.parse(body))});return readApiResponse<OutputType>(r,"Unable to connect Webull PaperTrade");}

