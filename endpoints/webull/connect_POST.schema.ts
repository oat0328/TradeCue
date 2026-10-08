import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});

export type OutputType = {
  authorizationUrl: string;
  environment: "sandbox";
};

export async function postWebullConnect(init?: RequestInit): Promise<OutputType> {
  const response = await fetch("/_api/webull/connect", {
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
    const error = superjson.parse<{ error: string; code?: string }>(await response.text());
    throw new Error(error.error || "Unable to start Webull connection");
  }

  return superjson.parse<OutputType>(await response.text());
}
