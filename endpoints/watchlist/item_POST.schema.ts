import { z } from "zod";
import superjson from "superjson";
import { readApiResponse } from "../../helpers/apiClient";

export const schema=z.discriminatedUnion("action",[
  z.object({
    action:z.literal("add"),
    symbol:z.string().trim().toUpperCase().regex(/^[A-Z0-9.-]{1,15}$/),
    assetType:z.enum(["stocks","etfs"]).default("stocks"),
  }),
  z.object({action:z.literal("remove"),id:z.string().min(1)}),
  z.object({action:z.literal("move"),id:z.string().min(1),direction:z.enum(["up","down"])}),
  z.object({action:z.literal("toggle_alert"),id:z.string().min(1),enabled:z.boolean()}),
]);
export type OutputType={ok:true};
export async function postWatchlist(body:z.infer<typeof schema>):Promise<OutputType>{
  const r=await fetch("/_api/watchlist/item",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:superjson.stringify(schema.parse(body))});
  return readApiResponse<OutputType>(r,"Unable to update watchlist");
}
