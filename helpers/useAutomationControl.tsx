import {useMutation,useQuery,useQueryClient} from "@tanstack/react-query";
import {getAutomationControl} from "../endpoints/automation/control_GET.schema";
import {updateAutomationControl} from "../endpoints/automation/control_POST.schema";
export function useAutomationControl(enabled=true){
  const client=useQueryClient();
  const query=useQuery({queryKey:["automation","control"],queryFn:getAutomationControl,
    enabled,staleTime:10_000,retry:false,refetchInterval:30_000});
  const update=useMutation({mutationFn:updateAutomationControl,
    onSuccess:()=>client.invalidateQueries({queryKey:["automation","control"]})});
  return {query,update};
}
