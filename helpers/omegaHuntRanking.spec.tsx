import {omegaHuntRanking} from "./omegaHuntRanking";
describe("Active hunt ranking",()=>{
 it("keeps an entry-ready setup ahead of higher-scoring watch stocks",()=>{
  const rows=[
   {action:"WATCH",cueScore:99,setupScore12:12,confidence:100},
   {action:"ENTRY_READY",cueScore:75,setupScore12:9,confidence:80},
   {action:"WAIT",cueScore:100,setupScore12:12,confidence:100},
  ].sort(omegaHuntRanking);
  expect(rows.map(row=>row.action)).toEqual(["ENTRY_READY","WATCH","WAIT"]);
 });
 it("ranks stronger qualified setups first",()=>{
  const rows=[
   {action:"ENTRY_READY",cueScore:75,setupScore12:9,confidence:80},
   {action:"ENTRY_READY",cueScore:90,setupScore12:12,confidence:100},
  ].sort(omegaHuntRanking);
  expect(rows[0].setupScore12).toBe(12);
 });
});
