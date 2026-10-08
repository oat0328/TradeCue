export function isWorkingPaperOrder(status:string){
  const normalized=String(status||"").toUpperCase().replace(/[^A-Z]/g,"");
  if(["FILLED","FINALFILLED","COMPLETED","CANCELED","CANCELLED","REJECTED","FAILED","EXPIRED"].includes(normalized))return false;
  return Boolean(normalized);
}

export function autoPaperQuantity(input:{
  budget:number;
  buyingPower:number;
  entry:number;
  stop:number;
  maxRiskPerTrade:number;
  maxShares?:number;
}){
  const {budget,buyingPower,entry,stop,maxRiskPerTrade,maxShares}=input;
  if(![budget,buyingPower,entry,stop,maxRiskPerTrade].every(Number.isFinite)||budget<=0||buyingPower<=0||entry<=0||stop<=0||stop>=entry||maxRiskPerTrade<=0)return 0;
  const cashBudget=Math.min(budget,buyingPower);
  const byCash=Math.floor(cashBudget/entry);
  const riskPerShare=entry-stop;
  const byRisk=Math.floor(maxRiskPerTrade/riskPerShare);
  const cap=maxShares!=null&&Number.isFinite(maxShares)&&maxShares>0?Math.floor(maxShares):Number.POSITIVE_INFINITY;
  return Math.max(0,Math.min(byCash,byRisk,cap));
}

export function adaptivePaperEntryLimit(input:{
  plannedEntryHigh:number;
  currentPrice:number;
  maxChaseRatio?:number;
}){
  const planned=Number(input.plannedEntryHigh),current=Number(input.currentPrice);
  const tolerance=Number.isFinite(input.maxChaseRatio)&&Number(input.maxChaseRatio)>=0?Number(input.maxChaseRatio):.001;
  if(!Number.isFinite(planned)||!Number.isFinite(current)||planned<=0||current<=0)return null;
  if(current<=planned)return Math.round(planned*100)/100;
  const maxAllowed=planned*(1+tolerance);
  if(current>maxAllowed)return null;
  const desired=Math.min(maxAllowed,current*1.0002);
  return Math.floor(desired*100)/100;
}

export function autoPaperMarketReady(mode:string|null|undefined){
  return mode==="RTH";
}