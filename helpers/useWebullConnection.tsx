import { useMutation, useQueryClient } from "@tanstack/react-query";
import { postWebullConnect } from "../endpoints/webull/connect_POST.schema";
import { postWebullDisconnect } from "../endpoints/webull/disconnect_POST.schema";

export function useWebullConnection() {
  const queryClient = useQueryClient();

  const connect = useMutation({
    mutationFn: () => postWebullConnect(),
    onSuccess: (result) => {
      window.location.assign(result.authorizationUrl);
    },
  });

  const disconnect = useMutation({
    mutationFn: () => postWebullDisconnect(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me", "entitlements"] });
    },
  });

  return { connect, disconnect };
}

