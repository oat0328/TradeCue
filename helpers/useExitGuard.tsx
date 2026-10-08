import { useQuery } from "@tanstack/react-query";
import { brokerPollInterval } from "./brokerPollInterval";
import { postExitGuard } from "../endpoints/automation/exit-guard_POST.schema";

/** Polls the protective-exit guard. Runs whenever a paper account is connected, armed or not,
 *  so an unprotected position stays visible even after Axiom is disarmed. */
export function useExitGuard(enabled: boolean, accountId?: string) {
  return useQuery({
    queryKey: ["automation", "exit-guard", accountId],
    queryFn: () => postExitGuard({ accountId: accountId! }),
    enabled: enabled && !!accountId,
    refetchInterval: query => brokerPollInterval(query.state.error, 60_000),
    refetchIntervalInBackground: true,
    staleTime: 10_000,
    retry: false,
    placeholderData: (prev) => prev,
  });
}