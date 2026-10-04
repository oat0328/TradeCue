import { apiUser,apiJson,apiFailure } from "../../helpers/apiAccess";
import { userKeys,webullRead,webullRows } from "../../helpers/webullClient";

function finite(value:unknown):number|null{
  const number=Number(value);
  return value!==null&&value!==""&&Number.isFinite(number)?number:null;
}
function percent(value:unknown):number|null{
  const number=finite(value);
  if(number==null)return null;
  return Math.abs(number)<=2?number*100:number;
}
function rows(raw:unknown){
  return webullRows(raw).map(row=>({
    symbol:String(row.symbol??row.ticker??"").toUpperCase(),
    name:String(row.name??""),
    price:finite(row.price??row.close??row.latest_price??row.last_price),
    changePercent:percent(row.change_ratio??row.change_percent??row.changePercent),
    relativeVolume:finite(row.relative_volume_10d),
    volume:finite(row.volume),
  })).filter(row=>row.symbol);
}

export async function handle(request:Request){
  try{
    const user=await apiUser(request);
    const keys=await userKeys(user);
    const [gainersRaw,losersRaw,activeRaw,benchRaw]=await Promise.all([
      webullRead(keys,"/market-data/screeners/gainers-losers/list",{category:"US_STOCK",rank_type:"DAY_1",sort_by:"CHANGE_RATIO",direction:"DESC"}),
      webullRead(keys,"/market-data/screeners/gainers-losers/list",{category:"US_STOCK",rank_type:"DAY_1",sort_by:"CHANGE_RATIO",direction:"ASC"}),
      webullRead(keys,"/market-data/screeners/top-actives/list",{category:"US_STOCK",rank_type:"RELATIVE_VOLUME_10D",sort_by:"RELATIVE_VOLUME_10D",direction:"DESC"}),
      webullRead(keys,"/market-data/stocks/snapshots/list",{symbols:"SPY,QQQ,IWM,DIA",category:"US_STOCK",extend_hour_required:"true"}),
    ]);

    const activeAll=rows(activeRaw);
    const breadth=activeAll.slice(0,100).reduce((acc,row)=>{
      if((row.changePercent??0)>0)acc.advancers++;
      else if((row.changePercent??0)<0)acc.decliners++;
      else acc.flat++;
      return acc;
    },{advancers:0,decliners:0,flat:0});

    return apiJson({
      generatedAt:new Date(),
      source:"webull-paper" as const,
      benchmarks:rows(benchRaw).map(row=>({symbol:row.symbol,price:row.price,changePercent:row.changePercent})),
      gainers:rows(gainersRaw).slice(0,8),
      losers:rows(losersRaw).slice(0,8),
      active:activeAll.slice(0,8),
      breadth,
    });
  }catch(error){
    return apiFailure(error);
  }
}

