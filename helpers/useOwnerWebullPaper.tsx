import { useQuery } from "@tanstack/react-query";
import { getOwnerWebullPaper } from "../endpoints/admin/webull-paper_GET.schema";

export function useOwnerWebullPaper(enabled = true, accountId?: string) {
  return useQuery({
    queryKey: ["owner", "webull-paper", accountId ?? "default"],
    queryFn: () => getOwnerWebullPaper(accountId ? { accountId } : {}),
    enabled,
    staleTime: 15_000,
    retry: false,
  });
}

