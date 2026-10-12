import {useMutation,useQueryClient} from "@tanstack/react-query";
import {killAutomation} from "../endpoints/automation/kill_POST.schema";
export function useKillAutomation(){
  const client=useQueryClient();
  return useMutation({mutationFn:killAutomation,onSuccess:async()=>{
    await client.invalidateQueries({queryKey:["automation"]});
    await client.invalidateQueries({queryKey:["market","position-monitor"]});
  }});
}
