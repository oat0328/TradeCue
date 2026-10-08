import { apiUser,apiJson,apiFailure } from "../../helpers/apiAccess";
import { db } from "../../helpers/db";

function num(value:unknown){const n=Number(value);return value==null||value===""||!Number.isFinite(n)?null:n;}
function profile(row:any){
  return {
    setup:String(row.setup),
    tradeCount:Number(row.tradeCount??0),
    wins:Number(row.wins??0),
    losses:Number(row.losses??0),
    winRate:num(row.winRate),
    avgR:num(row.avgR),
    expectancy:num(row.expectancy),
    profitFactor:num(row.profitFactor),
    avgWinnerR:num(row.avgWinnerR),
    avgLoserR:num(row.avgLoserR),
    maxLosingStreak:Number(row.maxLosingStreak??0),
    confidence:String(row.confidence??"LOW"),
    updatedAt:new Date(row.updatedAt).toISOString(),
  };
}

function streaks(values:number[]){
  let wins=0,losses=0,maxWins=0,maxLosses=0;
  for(const value of values){
    if(value>0){wins++;losses=0;maxWins=Math.max(maxWins,wins);}
    else if(value<0){losses++;wins=0;maxLosses=Math.max(maxLosses,losses);}
    else {wins=0;losses=0;}
  }
  return {maxWins,maxLosses};
}

function groupedAverage(rows:Array<{key:string;r:number}>){
  const map=new Map<string,number[]>();
  for(const row of rows){const list=map.get(row.key)??[];list.push(row.r);map.set(row.key,list);}
  return [...map.entries()].map(([key,list])=>({key,count:list.length,avgR:list.reduce((a,b)=>a+b,0)/list.length}))
    .sort((a,b)=>b.avgR-a.avgR);
}

export async function handle(request:Request){
  try{
    const user=await apiUser(request);
    const rows=await db.selectFrom("cueLearningProfiles").selectAll().where("userId","=",user.id).orderBy("tradeCount","desc").execute();
    const trades=await db.selectFrom("cueTradeJournal").select([
      "id","symbol","setup","cueScore","entryPrice","exitPrice","quantity","realizedPnl","realizedR","outcome","entryTime","exitTime","stopPrice","target2","plannedRisk",
    ]).where("userId","=",user.id).where("status","=","closed").orderBy("exitTime","desc").limit(1000).execute();
    const all=rows.find(row=>row.setup==="ALL");
    const overall=all?profile(all):null;
    const resolved=trades.flatMap(row=>{
      const r=num(row.realizedR);
      return r==null?[]:[{...row,r}];
    }).sort((a,b)=>+new Date(a.exitTime??0)-+new Date(b.exitTime??0));
    const rValues=resolved.map(row=>row.r);
    const mean=rValues.length?rValues.reduce((a,b)=>a+b,0)/rValues.length:null;
    const variance=mean==null||rValues.length<2?null:rValues.reduce((sum,r)=>sum+(r-mean)**2,0)/(rValues.length-1);
    const sharpe=mean==null||variance==null||variance<=0?null:mean/Math.sqrt(variance)*Math.sqrt(rValues.length);
    let curve=0,peak=0,maxDrawdownR=0;
    for(const r of rValues){curve+=r;peak=Math.max(peak,curve);maxDrawdownR=Math.max(maxDrawdownR,peak-curve);}
    const streak=streaks(rValues);
    const bySymbol=groupedAverage(resolved.map(row=>({key:row.symbol,r:row.r}))).filter(row=>row.count>=2);
    const bySetup=groupedAverage(resolved.map(row=>({key:row.setup??"UNKNOWN",r:row.r}))).filter(row=>row.count>=2);
    const byHour=groupedAverage(resolved.flatMap(row=>{
      if(!row.entryTime)return [];
      const hour=new Intl.DateTimeFormat("en-US",{timeZone:"America/Los_Angeles",hour:"numeric",hour12:true}).format(new Date(row.entryTime));
      return [{key:hour,r:row.r}];
    })).filter(row=>row.count>=2);
    const omegaTrades=trades.filter(row=>row.setup!=="EXTERNAL_PAPER");
    const compliantOmegaTrades=omegaTrades.filter(row=>
      num(row.cueScore)!=null&&num(row.stopPrice)!=null&&num(row.target2)!=null&&num(row.plannedRisk)!=null
    );
    const ruleCompliance=omegaTrades.length?compliantOmegaTrades.length/omegaTrades.length*100:null;
    const performance={
      sharpeRatio:sharpe,
      maxDrawdownR,
      longestWinStreak:streak.maxWins,
      longestLossStreak:streak.maxLosses,
      bestSymbol:bySymbol[0]??null,
      worstSymbol:bySymbol.length?bySymbol.at(-1)!:null,
      bestSetup:bySetup[0]??null,
      worstSetup:bySetup.length?bySetup.at(-1)!:null,
      bestTime:byHour[0]??null,
      worstTime:byHour.length?byHour.at(-1)!:null,
      ruleCompliance,
      successCriteria:{
        profitFactorMet:(overall?.profitFactor??0)>1.5,
        winRateMet:(overall?.winRate??0)>50,
        ruleComplianceMet:ruleCompliance!=null&&ruleCompliance>90,
        maxDrawdownUnder10R:maxDrawdownR<10,
        sampleSizeMet:(overall?.tradeCount??0)>=200,
      },
    };
    const tradeCount=overall?.tradeCount??0;
    const completedReviewMilestone=Math.floor(tradeCount/100)*100;
    const recommendations:string[]=[];
    if(completedReviewMilestone>=100){
      if(performance.bestSetup)recommendations.push("Best setup: "+performance.bestSetup.key+" at "+performance.bestSetup.avgR.toFixed(2)+"R average over "+performance.bestSetup.count+" trades.");
      if(performance.worstSetup)recommendations.push("Review worst setup: "+performance.worstSetup.key+" at "+performance.worstSetup.avgR.toFixed(2)+"R average. Do not remove it automatically.");
      if(performance.bestSymbol)recommendations.push("Best symbol: "+performance.bestSymbol.key+" at "+performance.bestSymbol.avgR.toFixed(2)+"R average.");
      if(performance.worstSymbol)recommendations.push("Review worst symbol: "+performance.worstSymbol.key+" at "+performance.worstSymbol.avgR.toFixed(2)+"R average.");
      if(performance.bestTime)recommendations.push("Best time bucket: "+performance.bestTime.key+" at "+performance.bestTime.avgR.toFixed(2)+"R average.");
      if(performance.worstTime)recommendations.push("Review worst time bucket: "+performance.worstTime.key+" at "+performance.worstTime.avgR.toFixed(2)+"R average.");
      if(!performance.successCriteria.profitFactorMet)recommendations.push("Profit factor is below 1.50. Keep the strategy unchanged until a human reviews the evidence.");
      if(!performance.successCriteria.winRateMet)recommendations.push("Win rate is at or below 50%. Review skipped/failed A and A+ setups before changing rules.");
    }
    return apiJson({
      overall,
      setups:rows.filter(row=>row.setup!=="ALL").map(profile),
      performance,
      learningReview:{
        completedMilestone:completedReviewMilestone||null,
        nextMilestone:Math.max(100,(Math.floor(tradeCount/100)+1)*100),
        recommendations,
        autoChangesApplied:false,
      },
      recentTrades:trades.slice(0,20).map(row=>({
        id:String(row.id),symbol:row.symbol,setup:row.setup,
        entryPrice:num(row.entryPrice),exitPrice:num(row.exitPrice),quantity:num(row.quantity),
        realizedPnl:num(row.realizedPnl),realizedR:num(row.realizedR),outcome:row.outcome,
        entryTime:row.entryTime?new Date(row.entryTime).toISOString():null,
        exitTime:row.exitTime?new Date(row.exitTime).toISOString():null,
      })),
      sampleWarning:!overall||overall.tradeCount<200?"Omega needs a 200-trade paper sample before treating performance statistics as decision-grade evidence. Learning may recommend improvements before then, but it does not rewrite the strategy automatically.":null,
    });
  }catch(error){return apiFailure(error);}
}