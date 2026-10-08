import {adaptivePaperEntryLimit,autoPaperQuantity} from "./autoPaperRules";
export function omegaEntryPlan(input:{price:number;entryHigh:number;stop:number;target:number;budget:number;buyingPower:number;maxRiskPerTrade:number;maxShares?:number}){
 const entry=adaptivePaperEntryLimit({plannedEntryHigh:input.entryHigh,currentPrice:input.price,maxChaseRatio:.001});
 if(entry==null)return null;
 if(![input.price,input.stop,input.target].every(Number.isFinite)||input.price<=input.stop||input.price>=input.target)return null;
 const risk=entry-input.stop,reward=input.target-entry;
 if(risk<=0||reward<=0||reward/risk<1)return null;
 const quantity=autoPaperQuantity({...input,entry});
 if(quantity<1)return null;
 return {entry,stop:input.stop,target:input.target,quantity,rewardRisk:reward/risk,plannedLoss:quantity*risk,grossTargetProfit:quantity*reward};
}