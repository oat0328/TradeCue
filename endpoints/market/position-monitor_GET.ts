import { apiUser,apiJson,apiFailure } from "../../helpers/apiAccess";
import { calculateCueSignal } from "../../helpers/cueSignal";
import { userKeys,webullRead,webullSnapshot } from "../../helpers/webullClient";
import { webullBars } from "../../helpers/webullBars";
import { schema } from "./position-monitor_GET.schema";

async function evaluate<T,R>(items:T[],size:number,worker:(item:T)=>Promise<R>):Promise<R[]>{
  const output:R[]=[];
  for(let i=0;i<items.length;i+=size){
    const settled=await Promise.allSettled(items.slice(i,i+size).map(worker));
    for(const result of settled)if(result.status==="fulfilled")output.push(result.value);
  }
  return output;
}

export async function handle(request:Request){
  try{
    const user=await apiUser(request);
    const input=schema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const keys=await userKeys(user);
    const snapshot=await webullSnapshot(keys,input.accountId);

    const positions=await evaluate(snapshot.positions.slice(0,12),3,async(position)=>{
      const raw=await webullRead(keys,"/market-data/stocks/bars/list",{},{
        symbols:[position.symbol],
        category:"US_STOCK",
        timespan:"M5",
        count:"160",
        real_time_required:true,
        trading_sessions:"PRE,RTH,ATH",
      });
      const bars=webullBars(raw).slice(-160);
      const signal=calculateCueSignal(bars);
      const latest=bars.at(-1);
      const age=latest?.time&&Number.isFinite(Date.parse(latest.time))
        ? Math.max(0,(Date.now()-Date.parse(latest.time))/60000)
        : Number.POSITIVE_INFINITY;
      const fresh=age<=20;

      let cue:"HOLD"|"WATCH"|"EXIT REVIEW"|"DATA CHECK"="DATA CHECK";
      let reason="Not enough fresh chart data.";
      if(signal.available&&fresh){
        if(signal.state==="AVOID"){
          cue="EXIT REVIEW";
          reason="Technical v0.1 has weakened into AVOID conditions.";
        }else if(signal.state==="BUY"){
          cue="HOLD";
          reason="Trend/setup conditions remain constructive.";
        }else{
          cue="WATCH";
          reason="Position remains open, but setup is not currently a fresh BUY.";
        }
      }else if(signal.available&&!fresh){
        cue="DATA CHECK";
        reason="Intraday candle is stale; no exit instruction is issued from stale data.";
      }

      return {
        symbol:position.symbol,
        quantity:position.quantity,
        costPrice:position.costPrice,
        marketValue:position.marketValue,
        unrealizedPnl:position.unrealizedPnl,
        lastPrice:latest?.close??null,
        cue,
        cueScore:signal.available?signal.score:null,
        fresh,
        stop:signal.available&&fresh?signal.plan?.stop??null:null,
        target:signal.available&&fresh?signal.plan?.target2??null:null,
        reason,
      };
    });

    return apiJson({generatedAt:new Date(),positions});
  }catch(error){
    return apiFailure(error);
  }
}

