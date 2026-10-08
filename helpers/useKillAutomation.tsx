import { useMutation,useQueryClient } from "@tanstack/react-query";
import { killAutomation } from "../endpoints/automation/kill_POST.schema";
export function useKillAutomation(){
  const cache=useQueryClient();
  return useMutation({
    mutationFn:killAutomation,
    onSuccess:async()=>{
      await cache.invalidateQueries({queryKey:["automation-control"]});
      await cache.invalidateQueries({queryKey:["webull","orders"]});
    },
  });
}