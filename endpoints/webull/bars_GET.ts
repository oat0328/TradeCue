import {apiUser,apiJson,apiFailure}from "../../helpers/apiAccess";
import {userKeys,webullRead}from "../../helpers/webullClient";
import {webullBars,webullDelayMinutes}from "../../helpers/webullBars";
import {schema}from "./bars_GET.schema";

const intervals={"1m":"M1","3m":"M1","5m":"M5","15m":"M15","30m":"M30","1H":"M60","4H":"M60","1D":"D","1W":"W"};

export async function handle(request:Request){
  try{
    const user=await apiUser(request);
    const input=schema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const raw=await webullRead(
      await userKeys(user),
      "/market-data/stocks/bars/list",
      {},
      {
        symbols:[input.symbol],
        category:"US_STOCK",
        timespan:intervals[input.timeframe],
        count:"480",
        real_time_required:true,
        trading_sessions:"OVN,PRE,RTH,ATH",
      },
    );
    return apiJson({
      ...input,
      source:"webull-paper",
      delayMinutes:webullDelayMinutes(raw),
      updatedAt:new Date(),
      bars:webullBars(raw,input.timeframe==="3m"?3:input.timeframe==="4H"?240:0).slice(-160),
    });
  }catch(error){
    return apiFailure(error);
  }
}
