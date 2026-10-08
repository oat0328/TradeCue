import { apiUser,apiJson,apiFailure,ApiError } from "../../helpers/apiAccess";
import { userKeys,webullRead } from "../../helpers/webullClient";
import { webullBarsBySymbol,webullBars } from "../../helpers/webullBars";
import { calculateCueSignal } from "../../helpers/cueSignal";
import { calculateMarketStructure } from "../../helpers/marketStructure";
import { schema } from "./brief_GET.schema";

export async function handle(request:Request){
  try{
    const user=await apiUser(request);
    const input=schema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const keys=await userKeys(user);
    let raw:unknown;
    try{
      raw=await webullRead(keys,"/market-data/futures/bars/list",{
        symbols:input.symbol,category:"US_FUTURES",timespan:input.timespan,count:"160",real_time_required:"true",
      });
    }catch(error){
      const message=error instanceof Error?error.message:"";
      if(/permission|entitlement|subscription|unauthorized|417|403/i.test(message)){
        throw new ApiError(409,"Webull futures market-data entitlement is required for Cue Futures. Enable the futures data subscription on the connected OpenAPI account.");
      }
      throw error;
    }
    const grouped=webullBarsBySymbol(raw);
    const bars=(grouped[input.symbol]??webullBars(raw)).slice(-160);
    if(!bars.length)throw new ApiError(409,"Webull returned no futures candles for "+input.symbol+". Verify the contract or continuous symbol.");
    const signal=calculateCueSignal(bars);
    const structure=calculateMarketStructure(bars);
    return apiJson({
      symbol:input.symbol,timespan:input.timespan,bars,latest:bars.at(-1)?.close??null,
      cue:{state:signal.available?signal.state:null,score:signal.available?signal.score:null,plan:signal.available?signal.plan:null},
      structure:{trend:structure.trend,pattern:structure.pattern,summary:structure.summary},
      note:"Read-only Webull futures intelligence. No futures order is submitted from this module.",
    });
  }catch(error){return apiFailure(error);}
}