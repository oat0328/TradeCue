import { apiUser,apiJson,apiFailure } from "../../helpers/apiAccess";
import { db } from "../../helpers/db";
import { userKeys,webullRead,webullRows } from "../../helpers/webullClient";

function numberValue(...values:unknown[]){
  for(const value of values){
    const number=Number(value);
    if(value!==null&&value!==""&&Number.isFinite(number))return number;
  }
  return null;
}

export async function handle(request:Request){
  try{
    const user=await apiUser(request);
    const rows=await db
      .selectFrom("watchlistItems")
      .select(["id","symbol","assetType","sortOrder"])
      .select(["alertEnabled"])
      .where("userId","=",user.id)
      .orderBy("sortOrder","asc")
      .orderBy("createdAt","asc")
      .execute();

    let quotes=new Map<string,{price:number|null;change:number|null;changePercent:number|null}>();
    let quoteStatus:"connected"|"unavailable"="unavailable";
    let quoteMessage:string|null="Connect Webull PaperTrade to load quote data.";

    const symbols=rows.filter(row=>row.assetType==="stocks"||row.assetType==="etfs").map(row=>row.symbol);
    if(symbols.length){
      try{
        const raw=await webullRead(await userKeys(user),"/market-data/stocks/snapshots/list",{
          symbols:symbols.join(","),
          category:"US_STOCK",
          extend_hour_required:"true",
        });
        for(const row of webullRows(raw)){
          const symbol=String(row.symbol??row.ticker??row.instrument?.symbol??"").toUpperCase();
          if(!symbol)continue;
          const price=numberValue(row.latest_price,row.last_price,row.last,row.close,row.price,row.latestPrice);
          const change=numberValue(row.change,row.change_value,row.changeValue);
          let changePercent=numberValue(row.change_ratio,row.change_rate,row.change_percent,row.changePercent);
          if(changePercent!=null&&Math.abs(changePercent)<=2)changePercent*=100;
          quotes.set(symbol,{price,change,changePercent});
        }
        quoteStatus="connected";
        quoteMessage=null;
      }catch(error){
        quoteMessage=error instanceof Error?error.message:"Quote data unavailable.";
      }
    }

    return apiJson({
      items:rows.map(row=>({
        id:String(row.id),
        symbol:row.symbol,
        assetType:row.assetType,
        sortOrder:row.sortOrder,
        alertEnabled:Boolean(row.alertEnabled),
        price:quotes.get(row.symbol)?.price??null,
        change:quotes.get(row.symbol)?.change??null,
        changePercent:quotes.get(row.symbol)?.changePercent??null,
      })),
      quoteStatus,
      quoteMessage,
    });
  }catch(error){
    return apiFailure(error);
  }
}
