import { db } from "./db";
import { userKeys,webullRead } from "./webullClient";
import { webullBarsBySymbol } from "./webullBars";
import type { CueBrainUser } from "./cueBrainShared";
import type { HunterRow } from "../endpoints/hunter/scan_GET.schema";
import type { Json } from "./schema";

type Keys=Awaited<ReturnType<typeof userKeys>>;
type Outcome="VALIDATED_RISK"|"VALIDATED_NO_EDGE"|"MISSED_CLEAN_MOVE"|"MIXED_CHOP"|"INCONCLUSIVE";

function skipOutcome(mfePercent:number,maePercent:number):Outcome{
  if(mfePercent>=1&&maePercent>-0.5)return "MISSED_CLEAN_MOVE";
  if(mfePercent>=1&&maePercent<=-0.75)return "MIXED_CHOP";
  if(maePercent<=-0.75&&mfePercent<1)return "VALIDATED_RISK";
  if(mfePercent<0.5)return "VALIDATED_NO_EDGE";
  return "INCONCLUSIVE";
}

export async function omegaSkipTraining(user:CueBrainUser,keys:Keys,rows:HunterRow[],marketMode:string){
  const now=new Date();
  let captured=0;
  const skipped=rows.filter(row=>
    marketMode==="RTH"&&
    row.fresh&&
    Boolean(row.latestBarTime)&&
    (row.setupGrade==="A"||row.setupGrade==="A+")&&
    row.action!=="ENTRY_READY"
  );

  for(const row of skipped){
    const latestBarTime=new Date(row.latestBarTime!);
    const inserted=await db.insertInto("cueSkipTrainingObservations").values({
      userId:user.id,
      symbol:row.symbol.toUpperCase(),
      observedAt:now,
      observedPrice:String(row.price),
      setupGrade:row.setupGrade,
      setupScore:row.setupScore12,
      confidence:String(row.confidence),
      cueScore:row.cueScore==null?null:String(row.cueScore),
      action:row.action,
      reason:[...(row.omegaEvidence?.rejectedReasons??[]),...row.flags].join(" · ").slice(0,2000)||"Omega rejected the setup.",
      marketMode,
      latestBarTime,
      evaluationDueAt:new Date(latestBarTime.getTime()+30*60*1000),
      details:{
        strategyVersion:"OMEGA-22-EXECUTION-CONVERSION",
        whyNow:row.whyNow,
        rejectedReasons:row.omegaEvidence?.rejectedReasons??[],
        flags:row.flags,
        marketAlignment:row.marketAlignment,
        omegaMarketMode:row.omegaMarketMode,
        timeframeScores:row.timeframeScores,
        observationPolicy:"Shadow learning only. Outcome labels do not change live entry gates automatically.",
        thresholds:{cleanMovePercent:1,maxCleanAdversePercent:-0.5,riskValidationPercent:-0.75,noEdgeMfePercent:0.5},
      } as Json,
    }).onConflict(oc=>oc.columns(["userId","symbol","latestBarTime"]).doNothing())
      .returning("id").executeTakeFirst();
    if(inserted)captured++;
  }

  const due=await db.selectFrom("cueSkipTrainingObservations")
    .selectAll()
    .where("userId","=",user.id)
    .where("evaluatedAt","is",null)
    .where("evaluationDueAt","<=",now)
    .orderBy("evaluationDueAt","asc")
    .limit(8)
    .execute();

  let evaluated=0;
  if(due.length){
    const symbols=[...new Set(due.map(row=>row.symbol.toUpperCase()))];
    const raw=await webullRead(keys,"/market-data/stocks/bars/list",{},{
      symbols,
      category:"US_STOCK",
      timespan:"M5",
      count:"120",
      real_time_required:true,
      trading_sessions:"PRE,RTH,ATH",
    });
    const barsBySymbol=webullBarsBySymbol(raw);

    for(const observation of due){
      const entry=Number(observation.observedPrice);
      const start=observation.latestBarTime?new Date(observation.latestBarTime).getTime():new Date(observation.observedAt).getTime();
      const end=new Date(observation.evaluationDueAt).getTime()+5*60*1000;
      const bars=(barsBySymbol[observation.symbol.toUpperCase()]??[])
        .filter(bar=>{
          const time=Date.parse(bar.time);
          return Number.isFinite(time)&&time>start&&time<=end;
        });
      if(!Number.isFinite(entry)||entry<=0||bars.length<3)continue;

      const endPrice=bars.at(-1)!.close;
      const high=Math.max(...bars.map(bar=>bar.high));
      const low=Math.min(...bars.map(bar=>bar.low));
      const mfePercent=(high-entry)/entry*100;
      const maePercent=(low-entry)/entry*100;
      const outcome=skipOutcome(mfePercent,maePercent);

      await db.updateTable("cueSkipTrainingObservations").set({
        evaluatedAt:now,
        endPrice:String(endPrice),
        mfePercent:String(mfePercent),
        maePercent:String(maePercent),
        outcome,
        details:{
          ...((observation.details&&typeof observation.details==="object"&&!Array.isArray(observation.details))?observation.details:{}),
          evaluationBars:bars.length,
          evaluationWindowMinutes:30,
          evaluationNote:"Forward 5-minute-bar study. This is counterfactual training evidence, not a simulated fill.",
        } as Json,
      }).where("id","=",observation.id).execute();

      await db.insertInto("cueAuditLog").values({
        userId:user.id,
        action:"omega_skip_evaluated",
        entityType:"omega_skip_training",
        entityId:String(observation.id),
        details:{
          symbol:observation.symbol,
          observedPrice:entry,
          endPrice,
          mfePercent,
          maePercent,
          outcome,
          setupGrade:observation.setupGrade,
          setupScore:observation.setupScore,
          confidence:Number(observation.confidence),
          observedAt:new Date(observation.observedAt).toISOString(),
          evaluatedAt:now.toISOString(),
        } as Json,
      }).execute();
      evaluated++;
    }
  }

  const summary=await db.selectFrom("cueSkipTrainingObservations")
    .select(["outcome"])
    .where("userId","=",user.id)
    .where("evaluatedAt","is not",null)
    .execute();
  const pendingRow=await db.selectFrom("cueSkipTrainingObservations")
    .select(({fn})=>fn.countAll<number>().as("count"))
    .where("userId","=",user.id)
    .where("evaluatedAt","is",null)
    .executeTakeFirst();

  const validated=summary.filter(row=>row.outcome==="VALIDATED_RISK"||row.outcome==="VALIDATED_NO_EDGE").length;
  const missed=summary.filter(row=>row.outcome==="MISSED_CLEAN_MOVE").length;
  const mixed=summary.filter(row=>row.outcome==="MIXED_CHOP").length;
  const inconclusive=summary.filter(row=>row.outcome==="INCONCLUSIVE").length;
  const scored=validated+missed;
  return {
    captured,
    evaluated,
    pending:Number(pendingRow?.count??0),
    evaluatedTotal:summary.length,
    validated,
    missedCleanMoves:missed,
    mixed,
    inconclusive,
    skipPrecision:scored?validated/scored*100:null,
    policy:"SHADOW_ONLY",
  };
}
