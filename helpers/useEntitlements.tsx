import { useQuery } from "@tanstack/react-query";
import { getEntitlements } from "../endpoints/me/entitlements_GET.schema";

export function useEntitlements(enabled = true) {
  return useQuery({
    queryKey: ["me", "entitlements"],
    queryFn: () => getEntitlements(),
    enabled,
    staleTime: 60_000,
  });
}

