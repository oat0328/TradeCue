import { apiUser,apiJson,apiFailure } from "../../helpers/apiAccess";
import { db } from "../../helpers/db";
import { cueTrainingGate } from "../../helpers/trainingGate";
function num(value:unknown){const n=Number(value);return value==null||value===""||!Number.isFinite(n)?null:n;}
export async function handle(request:Request){
  try{
    const user=await apiUser(request);
    const row=await db.selectFrom("cueLearningProfiles").select([
      "tradeCount","expectancy","profitFactor","winRate","maxLosingStreak",
    ]).where("userId","=",user.id).where("setup","=","ALL").executeTakeFirst();
    const stats={
      tradeCount:Number(row?.tradeCount??0),
      expectancy:num(row?.expectancy),
      profitFactor:num(row?.profitFactor),
      winRate:num(row?.winRate),
      maxLosingStreak:Number(row?.maxLosingStreak??0),
    };
    const gate=cueTrainingGate(stats);
    return apiJson({
      mode:"PAPER_TRAINING",
      capitalProfile:25000,
      ...gate,
      tradeCount:stats.tradeCount,
      expectancy:stats.expectancy,
      profitFactor:stats.profitFactor,
      winRate:stats.winRate,
    });
  }catch(error){return apiFailure(error);}
}