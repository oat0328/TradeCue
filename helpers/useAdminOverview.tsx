import { useQuery } from "@tanstack/react-query";
import { getAdminOverview } from "../endpoints/admin/overview_GET.schema";

export function useAdminOverview(enabled = true) {
  return useQuery({
    queryKey: ["admin", "overview"],
    queryFn: () => getAdminOverview(),
    enabled,
    staleTime: 30_000,
  });
}

