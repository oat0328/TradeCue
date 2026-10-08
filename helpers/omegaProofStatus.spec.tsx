import {omegaProofStatus} from "./omegaProofStatus";
import {cueTrainingGate} from "./trainingGate";
describe("Omega proof and frozen learning",()=>{
 const now=1000000;
 const base={enabled:true,paperExecutionEnabled:true,completedAt:new Date(now-30000).toISOString(),status:"WAITING",mode:"PAPER",proof:{decision:"WAIT — NO QUALIFIED A/A+ SETUP",brokerConnection:"CONNECTED",scannerState:"IDLE"}};
 it("expires heartbeat without needing another server response",()=>{
  expect(omegaProofStatus(base,now).online).toBeTrue();
  expect(omegaProofStatus(base,now+180001).online).toBeFalse();
  expect(omegaProofStatus(base,now+180001).decision).toBe("WAIT — WORKER OFFLINE");
  expect(omegaProofStatus(base,now+180001).brokerConnection).toBe("UNCONFIRMED");
 });
 it("does not infer worker or broker health from future, revoked, or failed check-ins",()=>{
  for(const override of [{enabled:false},{status:"ERROR"},{completedAt:new Date(now+1).toISOString()}]){
   expect(omegaProofStatus({...base,...override},now).online).toBeFalse();
  }
 });
 it("observation never gains execution ownership",()=>{
  expect(omegaProofStatus({...base,paperExecutionEnabled:false,mode:"OBSERVE"},now).assigned).toBeFalse();
 });
 it("uses the explicit paper calibration threshold, then returns to the approved strict score",()=>{
  const calibration=cueTrainingGate({tradeCount:0,expectancy:null,profitFactor:null,maxLosingStreak:0});
  expect(calibration.minCueScore).toBe(70);expect(calibration.maxAutoPositions).toBe(2);
  for(const stats of [
   {tradeCount:100,expectancy:-10,profitFactor:0,maxLosingStreak:100},
   {tradeCount:50,expectancy:.1,profitFactor:1.1,maxLosingStreak:0},
   {tradeCount:100000,expectancy:100,profitFactor:100,maxLosingStreak:0}]){
    const gate=cueTrainingGate(stats);
    expect(gate.minCueScore).toBe(82);expect(gate.maxAutoPositions).toBe(2);
   }
 });
});