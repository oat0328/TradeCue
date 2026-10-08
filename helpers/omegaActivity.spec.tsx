import {omegaActivity} from "./omegaActivity";
const now=Date.now();
const base={online:true,armed:true,assigned:true,now,proof:{lastScanTimestamp:new Date(now).toISOString(),healthScore:100,criticalErrors:0,brokerConnection:"CONNECTED",marketState:"RTH",qualifiedSetupCount:1,healthBlockers:[],protectionAlerts:[]}};
describe("Omega readiness evidence",()=>{
 it("requires fresh scan and all entry checks",()=>{expect(omegaActivity(base).ready).toBeTrue();expect(omegaActivity({...base,proof:{...base.proof,lastScanTimestamp:new Date(now-180001).toISOString()}}).ready).toBeFalse()});
 it("does not treat health or a setup alone as readiness",()=>{for(const proof of [{marketState:"OVERNIGHT"},{healthScore:90},{criticalErrors:1},{brokerConnection:"UNCONFIRMED"},{healthBlockers:["risk blocked"]},{scanError:"data missing"}])expect(omegaActivity({...base,proof:{...base.proof,...proof}}).ready).toBeFalse()});
 it("requires armed assigned fresh worker",()=>{expect(omegaActivity({...base,armed:false}).ready).toBeFalse();expect(omegaActivity({...base,online:false}).ready).toBeFalse();expect(omegaActivity({...base,assigned:false}).ready).toBeFalse()});
 it("shows management without claiming protection",()=>{expect(omegaActivity({...base,proof:{...base.proof,openPositions:1}}).activity).toBe("MANAGING POSITIONS")});
});
