import {omegaReconciliation} from "./omegaReconciliation";
import {omegaDataAgreement} from "./omegaDataAgreement";
import {omegaPortfolioRoom,compareOmegaOpportunities} from "./omegaOpportunityComparison";
const account={accountId:"paper",cash:"1000",equity:"2000",buyingPower:"1000",positions:[{symbol:"XYZ",quantity:"7"}],lots:[{symbol:"XYZ",quantity:"10",exitedQuantity:3}],intents:[],orders:[]};
describe("Omega broker account reconciliation",()=>{
  it("waits for a pending entry without blocking on protective sells",()=>{
    expect(omegaReconciliation({...account,orders:[{clientOrderId:"buy",side:"BUY",status:"NEW"}]}).state).toBe("BLOCKED");
    expect(omegaReconciliation({...account,orders:[{clientOrderId:"stop",side:"SELL",status:"NEW"}]}).state).toBe("MATCHED");
    expect(omegaReconciliation({...account,orders:[{clientOrderId:"buy",side:"BUY",status:"FINAL_FILLED"}]}).state).toBe("MATCHED");
  });
  it("matches partial-exit lots using remaining shares",()=>{
    expect(omegaReconciliation(account).state).toBe("MATCHED");
    expect(omegaReconciliation(account).cash).toBe(1000);
  });
  it("blocks journal/broker mismatch and missing holdings",()=>{
    expect(omegaReconciliation({...account,positions:[{symbol:"XYZ",quantity:"8"}]}).state).toBe("BLOCKED");
    expect(omegaReconciliation({...account,positions:[]}).state).toBe("BLOCKED");
    expect(omegaReconciliation({...account,lots:[]}).state).toBe("BLOCKED");
  });
  it("does not turn missing balances or quantities into zero",()=>{
    expect(omegaReconciliation({...account,cash:null}).state).toBe("BLOCKED");
    expect(omegaReconciliation({...account,positions:[{symbol:"XYZ",quantity:null}]}).state).toBe("BLOCKED");
    expect(omegaReconciliation({...account,lots:[{symbol:"XYZ",quantity:10,exitedQuantity:11}]}).state).toBe("BLOCKED");
  });
  it("requires broker evidence for unresolved intents",()=>{
    const intents=[{clientOrderId:"a",status:"uncertain"}];
    expect(omegaReconciliation({...account,intents}).state).toBe("BLOCKED");
    expect(omegaReconciliation({...account,intents,orders:[{clientOrderId:"a",status:"UNKNOWN"}]}).state).toBe("BLOCKED");
    expect(omegaReconciliation({...account,intents,orders:[{clientOrderId:"a",status:"FILLED"}]}).state).toBe("MATCHED");
    expect(omegaReconciliation({...account,intents:[{clientOrderId:"a",status:"failed"}]}).state).toBe("MATCHED");
  });
});
describe("Omega market data agreement",()=>{
  const now=Date.parse("2026-10-07T15:00:00Z");
  const data={quotePrice:100.5,barPrice:100,barTimes:["2026-10-07T14:50:00Z","2026-10-07T14:55:00Z"],now};
  it("accepts current aligned data",()=>expect(omegaDataAgreement(data).state).toBe("AGREED"));
  it("pauses on missing or divergent prices",()=>{
    expect(omegaDataAgreement({...data,quotePrice:null}).state).toBe("BLOCKED");
    expect(omegaDataAgreement({...data,quotePrice:102}).state).toBe("BLOCKED");
  });
  it("rejects stale, future, conflicting and unparseable timestamps",()=>{
    for(const barTimes of [["2026-10-07T14:30:00Z"],["2026-10-07T15:02:00Z"],["2026-10-07T14:55:00Z","2026-10-07T14:55:00Z"],["invalid"]])expect(omegaDataAgreement({...data,barTimes}).state).toBe("BLOCKED");
  });
});
describe("Omega portfolio-aware comparison",()=>{
  it("preserves cash and subtracts remaining open stop risk",()=>{
    const room=omegaPortfolioRoom({equity:1000,buyingPower:500,maxRiskPerTrade:10,positions:[{quantity:5,entry:100,stop:98}]});
    expect(room.usableBuyingPower).toBe(450);
    expect(room.openRisk).toBe(10);
    expect(room.remainingRisk).toBe(20);
  });
  it("blocks additional risk when stops are unknown or capacity is consumed",()=>{
    expect(omegaPortfolioRoom({equity:1000,buyingPower:500,maxRiskPerTrade:10,positions:[{quantity:5,entry:100,stop:null}]}).remainingRisk).toBe(0);
    expect(omegaPortfolioRoom({equity:1000,buyingPower:500,maxRiskPerTrade:10,positions:[{quantity:20,entry:100,stop:98}]}).remainingRisk).toBe(0);
  });
  it("prefers quality and payoff rather than the biggest dollar target",()=>{
    const a={candidate:{symbol:"A",setupScore12:10,confidence:90},plan:{rewardRisk:2,plannedLoss:5,grossTargetProfit:10,entry:100,quantity:1}};
    const b={candidate:{symbol:"B",setupScore12:10,confidence:90},plan:{rewardRisk:1,plannedLoss:100,grossTargetProfit:100,entry:100,quantity:10}};
    expect(compareOmegaOpportunities([b,a])[0].candidate.symbol).toBe("A");
    const stronger={...b,candidate:{...b.candidate,setupScore12:12}};
    expect(compareOmegaOpportunities([a,stronger])[0].candidate.symbol).toBe("B");
    const efficient={...a,candidate:{...a.candidate,symbol:"C"},plan:{...a.plan,entry:50}};
    expect(compareOmegaOpportunities([a,efficient])[0].candidate.symbol).toBe("C");
  });
});