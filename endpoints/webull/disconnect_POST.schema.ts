import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});
export type OutputType = { disconnected: true };

export async function postWebullDisconnect(init?: RequestInit): Promise<OutputType> {
  const response = await fetch("/_api/webull/disconnect", {
    method: "POST",
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    body: superjson.stringify({}),
  });

  if (!response.ok) {
    const error = superjson.parse<{ error: string }>(await response.text());
    throw new Error(error.error || "Unable to disconnect Webull");
  }

  return superjson.parse<OutputType>(await response.text());
}

