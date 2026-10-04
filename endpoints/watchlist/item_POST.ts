import superjson from "superjson";
import { apiUser,apiJson,apiFailure,ApiError } from "../../helpers/apiAccess";
import { db } from "../../helpers/db";
import { schema } from "./item_POST.schema";

export async function handle(request:Request){
  try{
    const user=await apiUser(request);
    const input=schema.parse(superjson.parse(await request.text()));

    if(input.action==="add"){
      const count=await db.selectFrom("watchlistItems").select(eb=>eb.fn.countAll<string>().as("count")).where("userId","=",user.id).executeTakeFirstOrThrow();
      if(Number(count.count)>=100)throw new ApiError(400,"Watchlist limit is 100 symbols.");
      const max=await db.selectFrom("watchlistItems").select(eb=>eb.fn.max("sortOrder").as("max")).where("userId","=",user.id).executeTakeFirst();
      await db.insertInto("watchlistItems").values({
        userId:user.id,
        symbol:input.symbol,
        assetType:input.assetType,
        sortOrder:Number(max?.max??-1)+1,
        alertEnabled:false,
      }).onConflict(oc=>oc.columns(["userId","symbol","assetType"]).doNothing()).execute();
      await db.insertInto("cueAuditLog").values({userId:user.id,action:"watchlist_add",entityType:"symbol",entityId:input.symbol,details:{assetType:input.assetType}}).execute();
    }

    if(input.action==="remove"){
      const item=await db.selectFrom("watchlistItems").select(["id","symbol"]).where("id","=",input.id).where("userId","=",user.id).executeTakeFirst();
      if(!item)throw new ApiError(404,"Watchlist item not found.");
      await db.deleteFrom("watchlistItems").where("id","=",input.id).where("userId","=",user.id).execute();
      await db.insertInto("cueAuditLog").values({userId:user.id,action:"watchlist_remove",entityType:"symbol",entityId:item.symbol,details:{}}).execute();
    }

    if(input.action==="move"){
      const items=await db.selectFrom("watchlistItems").select(["id","sortOrder"]).where("userId","=",user.id).orderBy("sortOrder","asc").orderBy("createdAt","asc").execute();
      const index=items.findIndex(item=>String(item.id)===input.id);
      if(index<0)throw new ApiError(404,"Watchlist item not found.");
      const swapIndex=input.direction==="up"?index-1:index+1;
      if(swapIndex>=0&&swapIndex<items.length){
        const current=items[index],other=items[swapIndex];
        await db.transaction().execute(async trx=>{
          const temp=Math.max(...items.map(item=>item.sortOrder),0)+1000;
          await trx.updateTable("watchlistItems").set({sortOrder:temp}).where("id","=",current.id).where("userId","=",user.id).execute();
          await trx.updateTable("watchlistItems").set({sortOrder:current.sortOrder}).where("id","=",other.id).where("userId","=",user.id).execute();
          await trx.updateTable("watchlistItems").set({sortOrder:other.sortOrder}).where("id","=",current.id).where("userId","=",user.id).execute();
        });
      }
    }

    return apiJson({ok:true});
  }catch(error){
    return apiFailure(error);
  }
}

