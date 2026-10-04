import { apiUser,apiJson,apiFailure } from "../../helpers/apiAccess";
import { userKeys,webullRead,webullRows } from "../../helpers/webullClient";
import { schema } from "./webull-fundamentals_GET.schema";

function first(raw:unknown){return webullRows(raw)[0]??null;}
function n(row:any,...keys:string[]):number|null{
  if(!row)return null;
  for(const key of keys){
    const value=Number(row[key]);
    if(row[key]!==null&&row[key]!==""&&Number.isFinite(value))return value;
  }
  return null;
}
function s(row:any,...keys:string[]):string|null{
  if(!row)return null;
  for(const key of keys){
    const value=row[key];
    if(typeof value==="string"&&value.trim())return value.trim();
  }
  return null;
}
function rowDate(row:any){return s(row,"date","publish_date","publishDate","start_date","startDate","report_date","reportDate");}
function pctLike(value:number|null){
  if(value==null)return null;
  return Math.abs(value)>2?value/100:value;
}

export async function handle(request:Request){
  try{
    const user=await apiUser(request);
    const {symbol}=schema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const keys=await userKeys(user);
    const q={symbol,category:"US_STOCK"};

    const [profileRaw,ratingsRaw,targetRaw,filingsRaw,earningsRaw,capitalRaw,indicatorsRaw,snapshotRaw]=await Promise.all([
      webullRead(keys,"/market-data/fundamentals/company-profiles/get",q),
      webullRead(keys,"/market-data/fundamentals/analysis/ratings/get",q),
      webullRead(keys,"/market-data/fundamentals/analysis/target-prices/get",q),
      webullRead(keys,"/market-data/fundamentals/filings/list",q),
      webullRead(keys,"/market-data/fundamentals/earnings-calendars/list",q),
      webullRead(keys,"/market-data/fundamentals/capital-flows/get",q),
      webullRead(keys,"/market-data/fundamentals/indicators/get",q),
      webullRead(keys,"/market-data/stocks/snapshots/list",{symbols:symbol,category:"US_STOCK",extend_hour_required:"true"}),
    ]);

    const profileRow=first(profileRaw);
    const ratingRow=first(ratingsRaw);
    const targetRow=first(targetRaw);
    const capitalRow=first(capitalRaw);
    const indicatorRow=first(indicatorsRaw);
    const snapshot=first(snapshotRaw);

    const strongBuy=n(ratingRow,"strong_buy","strongBuy","strong_buy_count","strongBuyCount")??0;
    const buy=n(ratingRow,"buy","buy_count","buyCount")??0;
    const hold=n(ratingRow,"hold","hold_count","holdCount")??0;
    const sell=(n(ratingRow,"sell","sell_count","sellCount")??0)+(n(ratingRow,"strong_sell","strongSell","strong_sell_count","strongSellCount")??0);
    const total=strongBuy+buy+hold+sell;
    const analyst=total>0?{strongBuy,buy,hold,sell,total}:null;

    const target={
      mean:n(targetRow,"mean","mean_target_price","average_target_price","averageTargetPrice","target_price","targetPrice"),
      high:n(targetRow,"high","high_target_price","highTargetPrice"),
      low:n(targetRow,"low","low_target_price","lowTargetPrice"),
    };
    const targetAvailable=Object.values(target).some(value=>value!=null);

    const profile=profileRow?{
      companyName:s(profileRow,"company_name","companyName","name"),
      sector:s(profileRow,"sector","sector_name","sectorName"),
      industry:s(profileRow,"industry","industry_name","industryName"),
    }:null;

    const filings=webullRows(filingsRaw).slice(0,8).map(row=>({
      title:s(row,"title","filing_type","filingType","form_type","formType")??"SEC filing",
      publishDate:rowDate(row),
    }));

    const earnings=webullRows(earningsRaw).slice(0,8).map(row=>({
      date:rowDate(row),
      epsActual:n(row,"eps_actual","epsActual","actual_eps","actualEps"),
      epsEstimate:n(row,"eps_estimate","epsEstimate","estimated_eps","estimatedEps"),
      revenueActual:n(row,"revenue_actual","revenueActual","actual_revenue","actualRevenue"),
      revenueEstimate:n(row,"revenue_estimate","revenueEstimate","estimated_revenue","estimatedRevenue"),
    }));

    const futureEarnings=earnings.find(item=>item.date&&Date.parse(item.date)>=Date.now()-86400000);
    const nextEarnings=futureEarnings?{startDate:futureEarnings.date,epsEstimate:futureEarnings.epsEstimate}:null;

    const capitalFlow=capitalRow?{
      largeNet:n(capitalRow,"large_net","largeNet","large_net_inflow","largeNetInflow","large_order_net_inflow","largeOrderNetInflow"),
      date:rowDate(capitalRow),
    }:null;

    const indicators=indicatorRow?{
      netMargin:pctLike(n(indicatorRow,"net_margin","netMargin","net_profit_margin","netProfitMargin")),
      roe:pctLike(n(indicatorRow,"roe","return_on_equity","returnOnEquity")),
      debtToAssets:pctLike(n(indicatorRow,"debt_to_assets","debtToAssets","debt_asset_ratio","debtAssetRatio")),
      operatingCashFlowPerShare:n(indicatorRow,"operating_cash_flow_per_share","operatingCashFlowPerShare","ocf_per_share","ocfPerShare"),
    }:null;

    const current=n(snapshot,"latest_price","last_price","last","close","price");
    const reasons:string[]=[];
    const components:number[]=[];

    if(analyst){
      const positive=(analyst.strongBuy+analyst.buy)/analyst.total;
      const analystScore=Math.round(positive*100);
      components.push(analystScore);
      reasons.push("Analyst positive ratings "+Math.round(positive*100)+"%");
    }
    if(target.mean!=null&&current!=null&&current>0){
      const premium=(target.mean-current)/current;
      components.push(Math.max(0,Math.min(100,50+premium*200)));
      reasons.push("Mean target "+(premium>=0?"+":"")+Math.round(premium*100)+"% vs current price");
    }
    if(indicators?.netMargin!=null){
      components.push(Math.max(0,Math.min(100,50+indicators.netMargin*200)));
      reasons.push("Net margin "+(indicators.netMargin*100).toFixed(1)+"%");
    }
    if(indicators?.roe!=null){
      components.push(Math.max(0,Math.min(100,45+indicators.roe*180)));
      reasons.push("ROE "+(indicators.roe*100).toFixed(1)+"%");
    }

    const score=components.length?Math.round(components.reduce((a,b)=>a+b,0)/components.length):null;
    const bias=score==null?"NEUTRAL" as const:score>=65?"POSITIVE" as const:score<40?"WEAK" as const:"NEUTRAL" as const;

    return apiJson({
      symbol,
      generatedAt:new Date(),
      score,
      bias,
      reasons:reasons.slice(0,5),
      profile,
      analyst,
      target:targetAvailable?target:null,
      filings,
      earnings,
      nextEarnings,
      capitalFlow,
      indicators,
    });
  }catch(error){
    return apiFailure(error);
  }
}
