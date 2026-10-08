import {workerStatus} from "./workerStatus";
describe("worker status evidence",()=>{
 const now=1000000;
 const base={enabled:true,paperExecutionEnabled:true,completedAt:new Date(now-30000),status:"WAITING",mode:"PAPER"};
 it("recognizes a recent paper check-in",()=>{expect(workerStatus(base,now).executionMode).toBe("SERVER_PAPER");});
 it("never upgrades observation to paper execution",()=>{expect(workerStatus({...base,mode:"OBSERVE"},now).executionMode).toBe("SERVER_OBSERVE");});
 it("does not claim a dead or failed runner is connected",()=>{
  expect(workerStatus({...base,completedAt:new Date(now-360001)},now).fresh).toBeFalse();
  expect(workerStatus({...base,status:"ERROR"},now).fresh).toBeFalse();
 });
 it("keeps browser execution paused when the assigned runner goes stale",()=>{expect(workerStatus({...base,completedAt:null},now).serverExecutionAssigned).toBeTrue();});
 it("rejects future check-ins and revoked access",()=>{
  expect(workerStatus({...base,completedAt:new Date(now+1)},now).fresh).toBeFalse();
  expect(workerStatus({...base,enabled:false},now).serverExecutionAssigned).toBeFalse();
 });
});
