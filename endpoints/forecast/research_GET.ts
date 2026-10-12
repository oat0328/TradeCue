import {apiUser,apiJson,apiFailure} from "../../helpers/apiAccess";
import {userKeys,webullRead} from "../../helpers/webullClient";
import {webullBars,webullBarsBySymbol} from "../../helpers/webullBars";
import {omegaIntermarketContext} from "../../helpers/omegaIntermarket";
import {researchOmegaForecast} from "../../helpers/omegaForecastResearch";
import {forecastQuery,type ForecastResponse} from "./research_GET.schema";

type ModelId="chronos2"|"kronos"|"nhits";
async function invokeModel(model:ModelId,symbol:string,bars:ReturnType<typeof webullBars>):Promise<NonNullable<ForecastResponse["remote"]>>{
  const address=process.env.OMEGA_FORECAST_URL;
  const key=process.env.OMEGA_FORECAST_SERVICE_KEY;
  if(!address||!key)return {model,status:"NOT_CONFIGURED",source:null,points:[],message:"Optional model server and authentication key are not configured."};
  try{
    const url=new URL("/forecast",address);
    if(url.protocol!=="https:"&&url.hostname!=="localhost"&&url.hostname!=="127.0.0.1")
      return {model,status:"UNAVAILABLE",source:null,points:[],message:"Model endpoint must use HTTPS."};
    const response=await fetch(url.toString(),{
      method:"POST",headers:{"Content-Type":"application/json","X-Omega-Service-Key":key},
      body:JSON.stringify({symbol,model,horizon:12,bars:bars.slice(-450)}),
      cache:"no-store",signal:AbortSignal.timeout(15_000),
    });
    if(!response.ok){
      const detail=response.status===503?"Model is not installed or ready.":"Model service returned HTTP "+response.status+".";
      return {model,status:"UNAVAILABLE",source:null,points:[],message:detail};
    }
    const raw=await response.json() as any;
    if(raw?.model!==model||!Array.isArray(raw?.points)||!raw?.source)
      return {model,status:"ERROR",source:null,points:[],message:"Model service response failed validation."};
    const points=raw.points.map((p:any)=>({
      horizonBars:Number(p.horizonBars),median:Number(p.median),
      lower:p.lower==null?null:Number(p.lower),upper:p.upper==null?null:Number(p.upper),
    }));
    if(!points.length||points.length>12||points.some((p:any)=>
      !Number.isInteger(p.horizonBars)||p.horizonBars<1||p.horizonBars>12||
      !Number.isFinite(p.median)||p.median<=0||
      (p.lower!=null&&(!Number.isFinite(p.lower)||p.lower<=0||p.lower>p.median))||
      (p.upper!=null&&(!Number.isFinite(p.upper)||p.upper<p.median)))){
      return {model,status:"ERROR",source:null,points:[],message:"Model returned invalid projected price levels."};
    }
    return {model,status:"READY",source:String(raw.source).slice(0,200),points,message:"Unvalidated research forecast. No claim of trading profitability."};
  }catch{
    return {model,status:"ERROR",source:null,points:[],message:"Forecast model service could not be reached in time."};
  }
}
export async function handle(request:Request){
  try{
    const user=await apiUser(request);
    const {symbol,model}=forecastQuery.parse(Object.fromEntries(new URL(request.url).searchParams));
    const keys=await userKeys(user);
    const raw=await webullRead(keys,"/market-data/stocks/bars/list",{},{
      symbols:[symbol],category:"US_STOCK",timespan:"M5",count:"480",
      real_time_required:true,trading_sessions:"OVN,PRE,RTH,ATH",
    });
    const bars=webullBars(raw).slice(-480);
    // Optional single batched peer-data read; failure never fabricates correlation.
    const peerSymbols=["SPY","QQQ"].filter(peer=>peer!==symbol);
    let intermarket:ReturnType<typeof omegaIntermarketContext>=[];
    if(peerSymbols.length){
      try{
        const peersRaw=await webullRead(keys,"/market-data/stocks/bars/list",{},{
          symbols:peerSymbols,category:"US_STOCK",timespan:"M5",count:"160",
          real_time_required:true,trading_sessions:"OVN,PRE,RTH,ATH",
        });
        const bySymbol=webullBarsBySymbol(peersRaw);
        intermarket=omegaIntermarketContext(bars,peerSymbols
          .filter(peer=>(bySymbol[peer]??[]).length>=30)
          .map(peer=>({symbol:peer,bars:bySymbol[peer]})));
      }catch{intermarket=[];}
    }
    const baseline=researchOmegaForecast({symbol,bars,source:"Webull 5-minute OHLCV"});
    const remote=model==="baseline"?null:await invokeModel(model,symbol,bars);
    return apiJson({
      symbol,generatedAt:new Date().toISOString(),source:"Webull 5-minute OHLCV",
      baseline,remote,intermarket,executionAllowed:false,
    } satisfies ForecastResponse);
  }catch(error){return apiFailure(error);}
}
