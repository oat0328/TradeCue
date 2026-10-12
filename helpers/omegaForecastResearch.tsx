import type { WebullBar } from "./webullBars";

/**
 * Transparent, non-AI research baseline. Forecasts are hypothetical price levels,
 * NOT execution signals or real-time market quotes.
 * All evaluation windows use only bars available before each target bar.
 */
export type OmegaHorizon = 1 | 3 | 12;
export type BaselineMethod = "last_close" | "shrunk_momentum";
export type BaselineScore = {
  method:BaselineMethod; testSamples:number; mae:number|null;
  directionalAccuracy:number|null; // sample-based hit rate, NOT a win rate
};
export type OmegaForecastRow = {
  horizonBars:OmegaHorizon;
  median:number; lower:number; upper:number;
  horizonLabel:string;
  testSamples:number; intervalCoverage:number|null;
};
export type OmegaForecastResearch = {
  status:"RESEARCH_ONLY" | "INSUFFICIENT_DATA";
  model:"transparent_baseline";
  symbol:string;
  source:string; lastBarTime:string|null;
  generatedAt:string;
  methodology:string;
  barsUsed:number;
  selectedBaseline:BaselineMethod|null;
  backtest:BaselineScore[];
  forecasts:OmegaForecastRow[];
  cautions:string[];
};

const HORIZONS:[OmegaHorizon,OmegaHorizon,OmegaHorizon]=[1,3,12];
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const average=(arr:number[])=>arr.reduce((s,x)=>s+x,0)/Math.max(1,arr.length);
function percentile(values:number[],p:number){
  if(!values.length)return NaN;
  const rows=values.slice().sort((a,b)=>a-b);
  const position=(rows.length-1)*p,lo=Math.floor(position),hi=Math.ceil(position);
  return rows[lo]*(1-(position-lo))+rows[hi]*(position-lo);
}
function validBars(input:WebullBar[]):WebullBar[]{
  const data=input.filter(b=>Number.isFinite(Date.parse(b.time))&&
    [b.open,b.high,b.low,b.close,b.volume].every(Number.isFinite)&&
    b.low>0&&b.high>=Math.max(b.open,b.close)&&b.low<=Math.min(b.open,b.close)&&b.volume>=0)
    .slice().sort((a,b)=>Date.parse(a.time)-Date.parse(b.time));
  return data.filter((b,i)=>i===0||b.time!==data[i-1].time);
}
export function forecastPrice(history:number[],horizon:OmegaHorizon,method:BaselineMethod):number{
  const last=history.at(-1);
  if(last==null||!Number.isFinite(last)||last<=0)throw new Error("No valid close price");
  if(method==="last_close"||history.length<8)return last;
  const change:number[]=[];
  const window=history.slice(-7);
  for(let i=1;i<window.length;i++)change.push(clamp(Math.log(window[i]/window[i-1]),-0.06,0.06));
  // Temper recent momentum heavily to avoid extrapolating a single anomalous candle.
  const returnPerBar=clamp(average(change)*0.25,-0.003,0.003);
  return last*Math.exp(returnPerBar*horizon);
}
type Trial={last:number;actual:number;predictions:Record<BaselineMethod,number>;reference:number};
function trials(closes:number[],horizon:OmegaHorizon):Trial[]{
  const output:Trial[]=[];
  const end=closes.length-horizon;
  // Latest 120 eligible holdout origins, each consuming ONLY earlier training data.
  const start=Math.max(60,end-120);
  for(let origin=start;origin<end;origin++){
    const past=closes.slice(0,origin+1),last=past.at(-1)!,actual=closes[origin+horizon];
    output.push({last,actual,reference:last,predictions:{
      last_close:forecastPrice(past,horizon,"last_close"),
      shrunk_momentum:forecastPrice(past,horizon,"shrunk_momentum"),
    }});
  }
  return output;
}
function assess(samples:Trial[],method:BaselineMethod):BaselineScore{
  if(!samples.length)return {method,testSamples:0,mae:null,directionalAccuracy:null};
  let errors=0,correct=0;
  for(const x of samples){
    errors+=Math.abs(x.predictions[method]-x.actual);
    // Zero predicted or realized return counts as miss unless both are flat.
    if(Math.sign(x.predictions[method]-x.last)===Math.sign(x.actual-x.last))correct++;
  }
  return {method,testSamples:samples.length,mae:errors/samples.length,
    directionalAccuracy:correct/samples.length*100};
}
/**
 * Holdout baselines are compared on a disjoint earlier validation interval;
 * final test metrics and coverage are computed on later unseen origins.
 * Forecast interval is empirical and conservative but not guaranteed calibrated.
 */
export function researchOmegaForecast(input:{symbol:string;bars:WebullBar[];source:string;now?:Date}):OmegaForecastResearch{
  const now=input.now??new Date();
  const candles=validBars(input.bars);
  const closes=candles.map(b=>b.close);
  const base={symbol:input.symbol,source:input.source,
    lastBarTime:candles.at(-1)?.time??null,generatedAt:now.toISOString(),
    methodology:"Next 1/3/12 five-minute bars; compare last close vs damped momentum. Historical holdout uses only past candles. Intervals use observed historical absolute errors, not a guaranteed probability.",
    barsUsed:closes.length};
  if(closes.length<180){
    return {...base,status:"INSUFFICIENT_DATA",model:"transparent_baseline",selectedBaseline:null,
      backtest:[],forecasts:[],cautions:["At least 180 validated OHLCV candles are required.","No price projections or trade instructions produced."]};
  }
  // A fixed 5-minute bar horizon does not equal a specific wall-clock time across market closures.
  const split=Math.max(110,Math.floor(closes.length*0.70));
  const horizon1=trials(closes,1);
  const training=horizon1.filter(t=>t.reference<=0?false:true).slice(0,Math.max(0,horizon1.length-40));
  const validation=training.length>=25?training:horizon1.slice(0,Math.floor(horizon1.length/2));
  const candidates:["last_close","shrunk_momentum"]=["last_close","shrunk_momentum"];
  const best=candidates.map(method=>assess(validation,method)).sort((a,b)=>(a.mae??Infinity)-(b.mae??Infinity))[0]?.method??"last_close";
  const outOfSample=horizon1.slice(-Math.min(40,Math.floor(horizon1.length/2)));
  const backtest=candidates.map(method=>assess(outOfSample,method));
  const forecasts:OmegaForecastRow[]=[];
  for(const horizon of HORIZONS){
    const all=trials(closes,horizon);
    // Relative errors preserve scale across changing price levels.
    const residuals=all.slice(0,-Math.min(40,Math.floor(all.length/2))).map(row=>
      Math.abs(Math.log(row.actual/row.predictions[best]))).filter(Number.isFinite);
    const holdout=all.slice(-Math.min(40,Math.floor(all.length/2)));
    const projected=forecastPrice(closes,horizon,best);
    if(residuals.length<25||holdout.length<20)continue;
    // Conservative symmetric empirical 80th percentile absolute-error range.
    const errorBand=percentile(residuals,0.8);
    const lower=projected*Math.exp(-errorBand),upper=projected*Math.exp(errorBand);
    const coverage=holdout.filter(row=>
      Math.abs(Math.log(row.actual/row.predictions[best]))<=errorBand).length/holdout.length*100;
    forecasts.push({horizonBars:horizon,median:projected,lower,upper,
      horizonLabel:horizon+" future completed 5-minute bar"+(horizon===1?"":"s"),
      testSamples:holdout.length,intervalCoverage:coverage});
  }
  return {...base,status:forecasts.length?"RESEARCH_ONLY":"INSUFFICIENT_DATA",
    model:"transparent_baseline",selectedBaseline:best,
    backtest,forecasts,
    cautions:[
      "These are historical-data estimates, not market predictions with verified profitable performance.",
      "Forecast horizons count 5-minute bars, not calendar minutes across trading sessions.",
      "Historical range coverage can break during volatility spikes, gaps or major news.",
      "No forecast can override Omega's independent market, news and risk gates.",
      "Service-based Chronos-2, Kronos, and NeuralForecast require separate model hosting and validation.",
    ]};
}
