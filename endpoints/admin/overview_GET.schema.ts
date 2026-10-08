import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});

export type OutputType = {
  users: number;
  memberships: Record<"scout" | "copilot" | "autopilot", number>;
  brokers: Record<"webull" | "tradovate", number>;
  fundamentalEvents: number;
  recentAudit: Array<{
    id: string;
    action: string;
    entityType: string | null;
    entityId: string | null;
    createdAt: Date;
  }>;
};

export const getAdminOverview = async (init?: RequestInit): Promise<OutputType> => {
  const response = await fetch("/_api/admin/overview", {
    method: "GET",
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const error = superjson.parse<{ error: string }>(await response.text());
    throw new Error(error.error || "Unable to load admin overview");
  }
  return superjson.parse<OutputType>(await response.text());
};
