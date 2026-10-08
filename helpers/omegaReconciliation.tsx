import {isWorkingPaperOrder} from "./autoPaperRules";
const number=(v:unknown)=>v==null||v===""?NaN:Number(v);
export function omegaReconciliation(input:{accountId:string;cash:unknown;equity:unknown;buyingPower:unknown;positions:Array<{symbol:string;quantity:unknown}>;lots:Array<{symbol:string;quantity:unknown;exitedQuantity:unknown}>;intents:Array<{clientOrderId:string;status:string}>;orders:Array<{clientOrderId:string;status:string;side?:string}>}){
  const blockers:string[]=[];
  const cash=number(input.cash),equity=number(input.equity),buyingPower=number(input.buyingPower);
  if(!Number.isFinite(cash)||!Number.isFinite(equity)||equity<=0||!Number.isFinite(buyingPower)||buyingPower<0)blockers.push("Broker cash, equity or buying power is unavailable or invalid.");
  const held=new Map<string,number>(),journal=new Map<string,number>();
  for(const row of input.positions){
    const quantity=number(row.quantity),symbol=row.symbol.toUpperCase();
    if(!Number.isFinite(quantity)||quantity<0){blockers.push(symbol+": invalid or short broker quantity.");continue;}
    held.set(symbol,(held.get(symbol)??0)+quantity);
  }
  for(const row of input.lots){
    const quantity=number(row.quantity),exited=number(row.exitedQuantity),symbol=row.symbol.toUpperCase();
    if(!Number.isFinite(quantity)||!Number.isFinite(exited)||quantity<0||exited<0||exited>quantity+1e-6){blockers.push(symbol+": journal lot quantity is unresolved.");continue;}
    journal.set(symbol,(journal.get(symbol)??0)+Math.max(0,quantity-exited));
  }
  for(const symbol of new Set([...held.keys(),...journal.keys()])){
    if(Math.abs((held.get(symbol)??0)-(journal.get(symbol)??0))>1e-6)blockers.push(symbol+": broker holds "+(held.get(symbol)??0)+" shares; verified open journal holds "+(journal.get(symbol)??0)+".");
  }
  const evidence=new Map(input.orders.map(row=>[row.clientOrderId,row.status]));
  if(input.orders.some(row=>row.side?.toUpperCase()==="BUY"&&isWorkingPaperOrder(row.status)))blockers.push("A broker BUY is still working; wait for its fill or confirmed cancellation before allocating another entry.");
  for(const intent of input.intents){
    if(intent.status==="failed")continue;
    const status=evidence.get(intent.clientOrderId);
    if(!status||status.toUpperCase()==="UNKNOWN")blockers.push("An order intent lacks confirmed broker status; reconcile before another buy.");
  }
  return {state:blockers.length?"BLOCKED" as const:"MATCHED" as const,accountId:input.accountId,cash:Number.isFinite(cash)?cash:null,equity:Number.isFinite(equity)?equity:null,buyingPower:Number.isFinite(buyingPower)?buyingPower:null,positionCount:[...held.values()].filter(q=>q>0).length,workingOrders:input.orders.filter(row=>isWorkingPaperOrder(row.status)).length,blockers:[...new Set(blockers)]};
}