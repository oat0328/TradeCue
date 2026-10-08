import {apiUser,apiJson,apiFailure}from "../../helpers/apiAccess";
import {userKeys,webullRead}from "../../helpers/webullClient";
import {webullBars}from "../../helpers/webullBars";
import {schema}from "./history_GET.schema";

const intervals={"1m":"M1","3m":"M1","5m":"M5","15m":"M15","30m":"M30","1H":"M60","4H":"M60","1D":"D","1W":"W"} as const;

export async function handle(request:Request){
  try{
    const user=await apiUser(request);
    const input=schema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const keys=await userKeys(user);
    const interval=intervals[input.timeframe];
    const providerLimit=interval==="M1"?1650:1200;
    const count=Math.min(input.limit,providerLimit);
    const raw=await webullRead(keys,"/market-data/stocks/bars/list",{},{
      symbols:[input.symbol],
      category:"US_STOCK",
      timespan:interval,
      count:String(count),
      real_time_required:false,
      trading_sessions:"OVN,PRE,RTH,ATH",
    });
    const source=webullBars(raw);
    const minutes=input.timeframe==="3m"?3:input.timeframe==="4H"?240:0;
    const bars=(minutes?webullBars({result:source},minutes):source).slice(-input.limit);
    return apiJson({
      symbol:input.symbol,timeframe:input.timeframe,bars,requested:input.limit,loaded:bars.length,
      source:"webull-paper",updatedAt:new Date(),providerLimit,
      note:"Webull sandbox returned "+bars.length+" bars. TradeCUE shows the actual provider history rather than fabricating a 10K candle count.",
    });
  }catch(error){return apiFailure(error);}
}
