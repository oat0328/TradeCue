import { apiUser,apiJson,apiFailure } from "../../helpers/apiAccess";
import { db } from "../../helpers/db";
export async function handle(request:Request){
  try{
    const user=await apiUser(request);
    const row=await db.selectFrom("cueDailyOutlooks").selectAll()
      .where("userId","=",user.id).orderBy("updatedAt","desc").executeTakeFirst();
    if(!row)return apiJson({available:false,outlook:null});
    return apiJson({available:true,outlook:{
      sessionDate:String(row.sessionDate),
      outlookType:row.outlookType,
      marketMode:row.marketMode,
      bias:row.bias,
      headline:row.headline,
      summary:row.summary,
      watchSymbols:Array.isArray(row.watchSymbols)?row.watchSymbols.map(String):[],
      plan:row.plan&&typeof row.plan==="object"&&!Array.isArray(row.plan)?row.plan as Record<string,unknown>:{},
      updatedAt:new Date(row.updatedAt).toISOString(),
    }});
  }catch(error){return apiFailure(error);}
}