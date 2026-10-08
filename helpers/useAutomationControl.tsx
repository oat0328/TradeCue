import { useMutation,useQuery,useQueryClient } from "@tanstack/react-query";
import { getAutomationControl } from "../endpoints/automation/control_GET.schema";
import { updateAutomationControl } from "../endpoints/automation/control_POST.schema";

export function useAutomationControl(enabled=true){
  const cache=useQueryClient();
  const query=useQuery({
    queryKey:["automation-control"],
    queryFn:getAutomationControl,
    enabled,
    staleTime:5_000,
    refetchInterval:15_000,
    refetchIntervalInBackground:true,
    retry:false,
  });
  const update=useMutation({
    mutationFn:updateAutomationControl,
    onSuccess:async()=>{
      await cache.invalidateQueries({queryKey:["automation-control"]});
      await cache.refetchQueries({queryKey:["automation-control"],type:"active"});
    },
  });
  return {query,update};
}