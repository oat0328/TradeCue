import { useMutation,useQuery,useQueryClient } from "@tanstack/react-query";
import { getJournalActivity } from "../endpoints/journal/activity_GET.schema";
import { logCueDecision } from "../endpoints/journal/decision_POST.schema";
import { syncPaperJournal } from "../endpoints/journal/sync_POST.schema";
import { brokerPollInterval } from "./brokerPollInterval";
export function useCueJournal(enabled=true){
  const client=useQueryClient();
  const sync=useQuery({queryKey:["cue-journal-sync"],queryFn:async()=>{
    const result=await syncPaperJournal();
    await client.invalidateQueries({queryKey:["cue-journal"]});
    await client.invalidateQueries({queryKey:["cue-learning"]});
    return result;
  },enabled,staleTime:120_000,refetchInterval:query=>brokerPollInterval(query.state.error,120_000),refetchIntervalInBackground:true,retry:false});
  const activity=useQuery({queryKey:["cue-journal"],queryFn:getJournalActivity,enabled,staleTime:30_000,refetchInterval:120_000});
  const log=useMutation({mutationFn:logCueDecision,onSuccess:()=>client.invalidateQueries({queryKey:["cue-journal"]})});
  return {activity,log,sync};
}