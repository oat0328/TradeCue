import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  accountId: z.string().optional(),
});

export type PaperAccountSummary = {
  accountId: string;
  accountMask: string;
  accountType: string;
};

export type OutputType = {
  connected: true;
  environment: "sandbox";
  accounts: PaperAccountSummary[];
  selectedAccountId: string | null;
  balance: unknown;
  positions: unknown[];
};

export const getOwnerWebullPaper = async (
  body: z.infer<typeof schema> = {},
  init?: RequestInit,
): Promise<OutputType> => {
  const input = schema.parse(body);
  const params = new URLSearchParams();
  if (input.accountId) params.set("account_id", input.accountId);
  const response = await fetch("/_api/admin/webull-paper" + (params.size ? "?" + params.toString() : ""), {
    method: "GET",
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const error = superjson.parse<{ error: string; code?: string }>(await response.text());
    throw new Error(error.error || "Unable to sync Webull PaperTrade account");
  }

  return superjson.parse<OutputType>(await response.text());
};

