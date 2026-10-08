import { TRADECUE_BUILD_ID } from "../helpers/buildVersion";
export async function handle(){
  return new Response(JSON.stringify({buildId:TRADECUE_BUILD_ID,generatedAt:new Date().toISOString()}),{
    headers:{"Content-Type":"application/json","Cache-Control":"no-store"},
  });
}