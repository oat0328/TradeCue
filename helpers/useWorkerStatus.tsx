import {useAuth} from "./useAuth";
import {getWorkerStatus} from "../endpoints/bot/worker-status_GET.schema";
import {useRealtimeQuery} from "../components/FlootRealtimeProvider";
import {channels} from "./realtimeChannels";
export function useWorkerStatus(enabled:boolean){
 const {authState}=useAuth();
 const id=authState.type==="authenticated"?authState.user.id:null;
 return useRealtimeQuery({queryKey:["axiom-worker-status",id],queryFn:getWorkerStatus,channel:id?channels.omega(id):null,enabled:enabled&&id!=null,retry:false});
}