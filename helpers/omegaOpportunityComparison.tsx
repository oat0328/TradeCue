export function omegaPortfolioRoom(input:{equity:number;buyingPower:number;maxRiskPerTrade:number;positions:Array<{quantity:number;entry:number;stop:number|null}>}){
  const valid=[input.equity,input.buyingPower,input.maxRiskPerTrade].every(Number.isFinite)&&input.equity>0&&input.buyingPower>=0&&input.maxRiskPerTrade>0;
  const unknownRisk=input.positions.some(p=>![p.quantity,p.entry].every(Number.isFinite)||p.quantity<0||p.entry<=0||p.stop==null||!Number.isFinite(p.stop)||p.stop<=0);
  const openRisk=unknownRisk?null:input.positions.reduce((sum,p)=>sum+Math.max(0,p.entry-p.stop!)*p.quantity,0);
  const riskCap=valid?Math.min(input.equity*.03,input.maxRiskPerTrade*3):0;
  return {openRisk,riskCap,remainingRisk:valid&&openRisk!=null?Math.max(0,riskCap-openRisk):0,usableBuyingPower:valid?input.buyingPower*.9:0,unknownRisk};
}
type Opportunity={candidate:{symbol:string;setupScore12:number;confidence:number};plan:{rewardRisk:number;plannedLoss:number;grossTargetProfit:number;entry:number;quantity:number}};
export function compareOmegaOpportunities<T extends Opportunity>(items:T[]){
  return items.slice().sort((a,b)=>b.candidate.setupScore12-a.candidate.setupScore12||b.plan.rewardRisk-a.plan.rewardRisk||b.candidate.confidence-a.candidate.confidence||(a.plan.entry*a.plan.quantity)-(b.plan.entry*b.plan.quantity)||a.candidate.symbol.localeCompare(b.candidate.symbol));
}