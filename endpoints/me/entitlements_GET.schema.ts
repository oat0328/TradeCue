import { z } from "zod";
import superjson from "superjson";
import type { MembershipStatus, MembershipTier } from "../../helpers/schema";

export const schema = z.object({});

export type OutputType = {
  membership: {
    tier: MembershipTier;
    status: MembershipStatus;
    trialEndsAt: Date;
    currentPeriodEndsAt: Date | null;
  };
  features: string[];
  risk: {
    maxRiskPerTrade: string;
    maxDailyLoss: string;
    maxTradesPerDay: number;
    longOnly: boolean;
    requireGreenConfirmation: boolean;
    noChaseEnabled: boolean;
    safeModeEnabled: boolean;
    dayTradeFlatTimePt: string;
  } | null;
  brokers: Array<{
    provider: "webull" | "tradovate";
    status: string;
    isPaper: boolean;
    accountMask: string | null;
  }>;
  workspaces: Array<{
    id: string;
    name: string;
    kind: string;
    defaultAssetClass: string;
    quietMode: boolean;
    isDefault: boolean;
  }>;
};

export const getEntitlements = async (init?: RequestInit): Promise<OutputType> => {
  const result = await fetch("/_api/me/entitlements", {
    method: "GET",
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const error = superjson.parse<{ error: string }>(await result.text());
    throw new Error(error.error || "Unable to load membership");
  }
  return superjson.parse<OutputType>(await result.text());
};
