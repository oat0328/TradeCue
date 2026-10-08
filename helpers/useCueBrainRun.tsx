import { useMutation,useQueryClient } from "@tanstack/react-query";
import { runCueBrain } from "../endpoints/brain/run_POST.schema";
export function useCueBrainRun(){
  const cache=useQueryClient();
  return useMutation({mutationFn:runCueBrain,onSuccess:async()=>{await cache.invalidateQueries({queryKey:["cue-latest-outlook"]});await cache.refetchQueries({queryKey:["cue-latest-outlook"],type:"active"});}});
}