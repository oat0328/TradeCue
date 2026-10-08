import { z } from "zod";
import superjson from "superjson";
import { readApiResponse } from "../../helpers/apiClient";

export const schema = z.object({
  apply: z.boolean().default(false), // false = dry run (report only)
});

export type OutputType = {
  applied: boolean;
  legacyRowsReviewed: number;
  verified: number;
  needsReview: Array<{ id: string; userId: number; symbol: string; reason: string }>;
  learningRebuiltForUsers: number[];
};

export async function postJournalReconcile(body: z.input<typeof schema>): Promise<OutputType> {
  const r = await fetch("/_api/admin/journal-reconcile", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: superjson.stringify(schema.parse(body)) });
  return readApiResponse<OutputType>(r, "Journal reconciliation failed");
}