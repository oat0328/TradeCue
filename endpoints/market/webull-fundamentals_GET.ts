import { apiUser,apiJson,apiFailure } from "../../helpers/apiAccess";
import { userKeys,webullRead } from "../../helpers/webullClient";
import { schema } from "./webull-fundamentals_GET.schema";

function number(value:unknown):number|null{
  const n=Number(value);
  return value!==null&&value!==""&&Number.isFinite(n)?n:null;
}
function object(value:unknown):Record<string,any>|null{
  return value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,any>:null;
}
function array(value:unknown):Record<string,any>[]{
  return Array.isArray(value)?value.filter(x=>x&&typeof x==="object") as Record<string,any>[]:[];
}

export async function handle(request:Request){
  try{
    const user=await apiUser(request);
    const {symbol}=schema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const keys=await userKeys(user);
    const q={symbol,category:"US_STOCK"};

    const [profileR,ratingR,targetR,epsR,filingsR,earningsR,capitalR,alertsR,indicatorsR]=await Promise.allSettled([
      webullRead(keys,"/market-data/fundamentals/company-profiles/get",q),
      webullRead(keys,"/market-data/fundamentals/analysis/ratings/get",q),
      webullRead(keys,"/market-data/fundamentals/analysis/target-prices/get",q),
      webullRead(keys,"/market-data/fundamentals/forecast-eps/get",q),
      webullRead(keys,"/market-data/fundamentals/filings/list",q),
      webullRead(keys,"/market-data/fundamentals/earnings-calendars/list",q),
      webullRead(keys,"/market-data/fundamentals/capital-flows/get",q),
      webullRead(keys,"/market-data/fundamentals/financial-alerts/get",q),
      webullRead(keys,"/market-data/fundamentals/indicators/get",q),
    ]);

    const profileRaw=profileR.status==="fulfilled"?object(profileR.value):null;
    const ratingRaw=ratingR.status==="fulfilled"?object(ratingR.value):null;
    const targetRaw=targetR.status==="fulfilled"?object(targetR.value):null;
    const epsRaw=epsR.status==="fulfilled"?array(epsR.value):[];
    const filingsObj=filingsR.status==="fulfilled"?object(filingsR.value):null;
    const earningsRaw=earningsR.status==="fulfilled"?array(earningsR.value):[];
    const capitalRaw=capitalR.status==="fulfilled"?array(capitalR.value):[];
    const alertsRaw=alertsR.status==="fulfilled"?object(alertsR.value):null;
    const indicatorsRaw=indicatorsR.status==="fulfilled"?object(indicatorsR.value):null;

    const analyst=ratingRaw?{
      total:number(ratingRaw.number)??0,
      strongBuy:number(ratingRaw.strong_buy)??0,
      buy:number(ratingRaw.buy)??0,
      hold:number(ratingRaw.hold)??0,
      underPerform:number(ratingRaw.under_perform)??0,
      sell:number(ratingRaw.sell)??0,
      effectiveDate:typeof ratingRaw.effective_start_date==="string"?ratingRaw.effective_start_date:null,
    }:null;

    const eps=epsRaw.map(row=>({
      fiscalYear:number(row.fiscal_year),
      fiscalPeriod:number(row.fiscal_period),
      actual:number(row.actual),
      estimate:number(row.est),
      reported:Boolean(row.reported),
    }));

    const earnings=earningsRaw.map(row=>({
      fiscalYear:number(row.fiscal_year),
      fiscalPeriod:number(row.fiscal_period),
      date:typeof row.expected_publish_date==="string"?row.expected_publish_date:null,
      epsActual:number(row.eps_actual),
      epsEstimate:number(row.eps_est),
      revenueActual:number(row.rev_actual),
      revenueEstimate:number(row.rev_est),
    }));

    const latestCapital=capitalRaw.at(-1)??null;
    const capitalFlow=latestCapital?{
      date:typeof latestCapital.date==="string"?latestCapital.date:null,
      largeNet:(number(latestCapital.large_in)!=null&&number(latestCapital.large_out)!=null)?(number(latestCapital.large_in)!-number(latestCapital.large_out)!):null,
      mediumNet:(number(latestCapital.medium_in)!=null&&number(latestCapital.medium_out)!=null)?(number(latestCapital.medium_in)!-number(latestCapital.medium_out)!):null,
      smallNet:(number(latestCapital.small_in)!=null&&number(latestCapital.small_out)!=null)?(number(latestCapital.small_in)!-number(latestCapital.small_out)!):null,
    }:null;

    const nextEarnings=alertsRaw?{
      startDate:typeof alertsRaw.start_date==="string"?alertsRaw.start_date:null,
      endDate:typeof alertsRaw.end_date==="string"?alertsRaw.end_date:null,
      fiscalYear:number(alertsRaw.fiscal_year),
      fiscalPeriod:number(alertsRaw.fiscal_period),
      epsEstimate:number(alertsRaw.eps_est),
      revenueEstimate:number(alertsRaw.rev_est),
    }:null;

    const latestMetric=(key:string)=>{
      const values=object(indicatorsRaw?.values);
      const rows=array(values?.[key]);
      return rows.length?number(rows[0]?.value):null;
    };
    const indicators=indicatorsRaw?{
      netMargin:latestMetric("net_margin"),
      roe:latestMetric("roe"),
      roa:latestMetric("roa"),
      debtToAssets:latestMetric("debt_to_assets"),
      operatingCashFlowPerShare:latestMetric("ocf_ps"),
    }:null;

    const reported=eps.filter(row=>row.reported&&row.actual!=null&&row.estimate!=null).slice(-4);
    const beats=reported.filter(row=>(row.actual??0)>=(row.estimate??0)).length;
    const positiveAnalysts=analyst?(analyst.strongBuy+analyst.buy):0;
    const negativeAnalysts=analyst?(analyst.underPerform+analyst.sell):0;
    const ratingScore=analyst&&analyst.total>0?Math.round((positiveAnalysts+analyst.hold*.5)/analyst.total*100):null;
    const epsScore=reported.length?Math.round(beats/reported.length*100):null;
    const inputs=[ratingScore,epsScore].filter((v):v is number=>v!=null);
    const score=inputs.length?Math.round(inputs.reduce((a,b)=>a+b,0)/inputs.length):null;
    const bias=score==null?"UNAVAILABLE":score>=70?"POSITIVE":score>=45?"MIXED":"WEAK";
    const reasons:string[]=[];
    const feeds=[["Company profile",profileR],["Analyst ratings",ratingR],["Price targets",targetR],["EPS",epsR],["Filings",filingsR],["Earnings",earningsR],["Capital flow",capitalR],["Financial alerts",alertsR],["Indicators",indicatorsR]] as const;
    for(const [name,result] of feeds)if(result.status==="rejected"){
      const message=result.reason instanceof Error?result.reason.message:"Provider request failed";
      reasons.push(name+": "+message.slice(0,180));
    }
    if(analyst)reasons.push(positiveAnalysts+" positive / "+analyst.hold+" hold / "+negativeAnalysts+" negative analyst ratings");
    if(reported.length)reasons.push(beats+"/"+reported.length+" recent reported EPS periods met or beat estimate");
    if(targetRaw?.mean!=null)reasons.push("Analyst mean target "+String(targetRaw.mean)+" "+String(targetRaw.currency??""));

    return apiJson({
      symbol,
      generatedAt:new Date(),
      source:"webull" as const,
      profile:profileRaw?{
        companyName:typeof profileRaw.company_name==="string"?profileRaw.company_name:null,
        sector:Array.isArray(profileRaw.industries)&&profileRaw.industries.length?String(profileRaw.industries[0]):null,
        industries:Array.isArray(profileRaw.industries)?profileRaw.industries.map(String):[],
        ceo:typeof profileRaw.ceo==="string"?profileRaw.ceo:null,
        employees:profileRaw.employees!=null?String(profileRaw.employees):null,
        description:typeof profileRaw.profile==="string"?profileRaw.profile:null,
      }:null,
      analyst,
      target:targetRaw?{
        mean:number(targetRaw.mean),
        median:number(targetRaw.median),
        high:number(targetRaw.high),
        low:number(targetRaw.low),
        currency:typeof targetRaw.currency==="string"?targetRaw.currency:null,
        effectiveDate:typeof targetRaw.effective_start_date==="string"?targetRaw.effective_start_date:null,
      }:null,
      eps,
      earnings,
      filings:array(filingsObj?.filings).slice(0,6).map(row=>({
        title:String(row.title??"Filing"),
        url:typeof row.url==="string"?row.url:null,
        publishDate:typeof row.publish_date==="string"?row.publish_date:null,
      })),
      capitalFlow,
      nextEarnings,
      indicators,
      score,
      bias,
      reasons,
    });
  }catch(error){
    return apiFailure(error);
  }
}
