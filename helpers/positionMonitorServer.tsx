import { apiUser,apiJson,apiFailure } from "./apiAccess";
import { calculateCueSignal } from "./cueSignal";
import { userKeys,webullRead,webullSnapshot } from "./webullClient";
import { webullBarsBySymbol } from "./webullBars";
import { schema } from "../endpoints/market/position-monitor_GET.schema";
import { db } from "./db";
import { afterPacificFlatTime } from "./marketClock";
import { calculateMarketStructure } from "./marketStructure";
import { positionCommander } from "./positionCommander";

async function evaluate<T,R>(items:T[],size:number,worker:(item:T)=>Promise<R>):Promise<R[]>{
  const output:R[]=[];
  for(let i=0;i<items.length;i+=size){
    const settled=await Promise.allSettled(items.slice(i,i+size).map(worker));
    for(const result of settled)if(result.status==="fulfilled")output.push(result.value);
  }
  return output;
}

export async function positionMonitorForUser(user:Awaited<ReturnType<typeof apiUser>>,rawInput:unknown){
  try{
    const input=schema.parse(rawInput);
    const keys=await userKeys(user);
    const snapshot=await webullSnapshot(keys,input.accountId);
    const risk=await db.selectFrom("riskProfiles").select(["dayTradeFlatTimePt"]).where("userId","=",user.id).executeTakeFirst();
    const forceFlat=afterPacificFlatTime(risk?.dayTradeFlatTimePt??"12:30");
    const openJournal=await db.selectFrom("cueTradeJournal").select(["symbol","entryTime","entryPrice","stopPrice","target2"])
      .where("userId","=",user.id).where("accountId","=",snapshot.selectedAccountId)
      .where("status","=","open").orderBy("entryTime","desc").execute();
    const journalBySymbol=new Map<string,typeof openJournal>();
    for(const row of openJournal){
      const symbol=row.symbol.toUpperCase();
      journalBySymbol.set(symbol,[...(journalBySymbol.get(symbol)??[]),row]);
    }
    const recentEntries=await db.selectFrom("paperOrders")
      .select(["symbol","rawResponse","createdAt"])
      .where("userId","=",user.id)
      .where("accountId","=",snapshot.selectedAccountId)
      .where("side","=","BUY")
      .orderBy("createdAt","desc")
      .limit(100)
      .execute();
    const entryPlans=new Map<string,{entryLow:number;entryHigh:number;stop:number;target1:number;target2:number;target3:number}>();
    for(const row of recentEntries){
      const symbol=row.symbol.toUpperCase();
      if(entryPlans.has(symbol))continue;
      const raw=row.rawResponse as any;
      const plan=raw?.cuePlan;
      if(!plan||![plan.entryLow,plan.entryHigh,plan.stop,plan.target1,plan.target2,plan.target3].every(Number.isFinite))continue;
      entryPlans.set(symbol,{
        entryLow:Number(plan.entryLow),entryHigh:Number(plan.entryHigh),stop:Number(plan.stop),
        target1:Number(plan.target1),target2:Number(plan.target2),target3:Number(plan.target3),
      });
    }

    const watchedPositions=snapshot.positions.slice(0,12);
    const symbols=watchedPositions.map(position=>position.symbol);
    const raw=symbols.length?await webullRead(keys,"/market-data/stocks/bars/list",{},{
      symbols,
      category:"US_STOCK",
      timespan:"M5",
      count:"100",
      real_time_required:true,
      trading_sessions:"OVN,PRE,RTH,ATH",
    }):null;
    const barsBySymbol=raw?webullBarsBySymbol(raw):{};

    const positions=watchedPositions.map(position=>{
      const bars=(barsBySymbol[position.symbol]??[]).slice(-100);
      const signal=calculateCueSignal(bars);
      const latest=bars.at(-1);
      const originalPlan=entryPlans.get(position.symbol.toUpperCase())??null;
      const lots=journalBySymbol.get(position.symbol.toUpperCase())??[];
      // High-water protection needs one unambiguous, fill-linked lot. Avoid using an old order or a prior trade's candles.
      const lot=lots.length===1?lots[0]:null;
      const lotStop=lot?.stopPrice==null?NaN:Number(lot.stopPrice);
      const stop=Number.isFinite(lotStop)&&lotStop>0?lotStop:originalPlan?.stop??null;
      const lotTarget=lot?.target2==null?NaN:Number(lot.target2);
      const target=Number.isFinite(lotTarget)&&lotTarget>0?lotTarget:originalPlan?.target2??null;
      const age=latest?.time&&Number.isFinite(Date.parse(latest.time))
        ? Math.max(0,(Date.now()-Date.parse(latest.time))/60000)
        : Number.POSITIVE_INFINITY;
      const fresh=age<=20;

      const entryPrice=Number(position.costPrice??originalPlan?.entryHigh??NaN);
      const originalRisk=stop!=null&&Number.isFinite(entryPrice)?entryPrice-stop:NaN;
      const currentR=latest&&Number.isFinite(originalRisk)&&originalRisk>0?(latest.close-entryPrice)/originalRisk:null;
      const entryTime=lot?.entryTime?new Date(lot.entryTime).getTime():NaN;
      const tradeBars=Number.isFinite(entryTime)?bars.filter(bar=>Date.parse(bar.time)>=entryTime):[];
      const peakR=tradeBars.length&&Number.isFinite(originalRisk)&&originalRisk>0
        ?Math.max(0,...tradeBars.map(bar=>(bar.close-entryPrice)/originalRisk)):null;
      const structure=bars.length?calculateMarketStructure(bars.slice(0,-1)):null;
      const commander=positionCommander({
        fresh,
        forceFlat,
        stopHit:Boolean(stop!=null&&latest&&latest.close<=stop),
        targetHit:Boolean(target!=null&&latest&&latest.close>=target),
        currentR,
        peakR,
        technicalState:signal.available?signal.state:null,
        structureTrend:structure?.trend??null,
        latestStructureEvent:structure?.latestEvent?.kind??null,
        aboveEma20:signal.available?signal.metrics.aboveEma20:null,
        aboveVwap:signal.available?signal.metrics.aboveVwap:null,
        entryPrice:Number.isFinite(entryPrice)?entryPrice:null,
      });
      const cue:"HOLD"|"WATCH"|"EXIT REVIEW"|"DATA CHECK"=
        commander.action==="EXIT"?"EXIT REVIEW":
        commander.action==="DATA CHECK"?"DATA CHECK":
        commander.action==="HOLD"?"HOLD":"WATCH";
      const reason=commander.reason;

      return {
        symbol:position.symbol,
        quantity:position.quantity,
        costPrice:position.costPrice,
        marketValue:position.marketValue,
        unrealizedPnl:position.unrealizedPnl,
        lastPrice:latest?.close??null,
        cue,
        commanderAction:commander.action,
        currentR:currentR==null?null:Math.round(currentR*100)/100,
        peakR:peakR==null?null:Math.round(peakR*100)/100,
        suggestedStop:commander.suggestedStop,
        structure:structure?.summary??null,
        cueScore:signal.available?signal.score:null,
        fresh,
        stop:stop??(signal.available&&fresh?signal.plan?.stop??null:null),
        target:target??(signal.available&&fresh?signal.plan?.target2??null:null),
        reason,
      };
    });

    return apiJson({generatedAt:new Date(),positions});
  }catch(error){
    return apiFailure(error);
  }
}

