import type {OmegaProof} from "./omegaProofStatus";
export function omegaActivity(input:{online:boolean;armed:boolean;assigned:boolean;proof?:OmegaProof|null;now:number}){
 const p=input.proof;
 const scanTime=p?.lastScanTimestamp?Date.parse(p.lastScanTimestamp):NaN;
 const age=input.now-scanTime;
 const scanFresh=Number.isFinite(age)&&age>=0&&age<180000&&!p?.scanError;
 const healthy=p?.healthScore!=null&&p.healthScore>90&&p.criticalErrors===0;
 const ready=input.online&&input.armed&&input.assigned&&scanFresh&&healthy&&p?.brokerConnection==="CONNECTED"&&p.marketState==="RTH"&&!(p.healthBlockers?.length)&&!(p.protectionAlerts?.length)&&(p.qualifiedSetupCount??0)>0;
 const activity=!input.online?"WORKER OFFLINE":!input.armed?"SCAN ONLY":p?.protectionAlerts?.length?"PROTECTION NEEDS ATTENTION":(p?.openPositions??0)>0?"MANAGING POSITIONS":ready?"CHECKING QUALIFIED ENTRY":"WAITING";
 return {scanFresh,ready,activity,nextScanSeconds:input.online&&scanFresh?Math.max(0,Math.ceil(((p?.scanIntervalSeconds??120)*1000-age)/1000)):null};
}
export function omegaGateReason(reason:string){
 const labels:Record<string,string>={FIVE_MIN_NOT_QUALIFIED:"Waiting for the 5-minute setup","5M_NOT_QUALIFIED":"Waiting for the 5-minute setup",VWAP_UNAVAILABLE:"VWAP data missing",BELOW_VWAP:"Price below VWAP",VOLUME_NOT_RISING:"Waiting for stronger volume",STALE_TIMEFRAME:"Waiting for fresh candles","1H_NOT_BULLISH":"Hourly trend is not bullish","15M_NOT_BULLISH":"15-minute trend is not bullish",HIGHER_TIMEFRAME_BEARISH:"Higher timeframe is bearish",MARKET_BEARISH:"Market is bearish",MARKET_NOT_BULLISH:"Market is not bullish",GRADE_BELOW_A:"Setup quality below A",OUTSIDE_EXECUTION_UNIVERSE:"Outside approved stock list"};
 return reason.split(" · ").map(r=>labels[r]??r.toLowerCase().replaceAll("_"," ")).join(" · ");
}
