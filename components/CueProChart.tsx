import React,{useEffect,useMemo,useRef,useState} from "react";
import {
  CandlestickSeries,ColorType,CrosshairMode,HistogramSeries,LineSeries,LineStyle,createChart,
  createSeriesMarkers,type UTCTimestamp,
} from "lightweight-charts";
import { emaSeries,type Candle } from "../helpers/chartMath";
import {cleanChartBars} from "../helpers/chartContext";
import { calculateMarketStructure } from "../helpers/marketStructure";
import {chartAnnotations,chartMarkFib,restoreChartMarks,type ChartMark} from "../helpers/chartAnnotations";
import {useAuth} from "../helpers/useAuth";
import {Input} from "./Input";
import styles from "./CueProChart.module.css";
import { CandleEducation } from "./CandleEducation";
import { Button } from "./Button";
import type {ChartTrade} from "../endpoints/journal/chart-trades_GET.schema";
import {chartFillBar,chartTradeResult} from "../helpers/chartTradeFills";
const emptyTrades:ChartTrade[]=[];
const pnlMoney=(value:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",signDisplay:"always"}).format(value);

type Levels={entryLow:number;entryHigh:number;stop:number;target1:number;target2:number;target3:number};
type CueAction="BUY"|"WAIT"|"HOLD"|"SELL"|"AVOID"|null;
type Coach={
  ema20:number;
  vwap:number|null;
  priceActionTrend:"BULLISH"|"BEARISH"|"RANGE";
  aboveEma20:boolean;
  aboveVwap:boolean;
  volumeIncreasing:boolean;
  pullback:boolean;
  greenConfirmation:boolean;
  stopReady:boolean;
  targetReady:boolean;
  stage:string;
};
const drawingTools=[
 {label:"Support",color:"#19d9a0",kind:"level"},
 {label:"Resistance",color:"#f5a742",kind:"level"},
 {label:"Breakout",color:"#66a3ff",kind:"level"},
 {label:"Entry",color:"#2f80ff",kind:"level"},
 {label:"Stop",color:"#ff435f",kind:"level"},
 {label:"Target",color:"#28d79a",kind:"level"},
 {label:"Short study",color:"#ff9cc6",kind:"level"},
 {label:"Trend line",color:"#f5c86a",kind:"trend"},
 {label:"Fib retracement",color:"#b9a7ff",kind:"fib"},
] as const;
type DrawingTool=typeof drawingTools[number];
type ChartStyle="candles"|"heikin"|"line";

function timeOf(value:string):UTCTimestamp{return Math.floor(Date.parse(value)/1000) as UTCTimestamp;}
function fmt(value:number|null|undefined){return value==null||!Number.isFinite(value)?"—":"$"+value.toFixed(value>=100?2:4);}
function axisClock(time:any){
  const unix=typeof time==="number"?time:null;
  if(unix==null)return "";
  const d=new Date(unix*1000);
  const date=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",month:"numeric",day:"numeric"}).format(d);
  const clock=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",hour:"numeric",minute:"2-digit",hour12:true}).format(d).replace(" ","");
  return date+" "+clock;
}
function fullClock(value:string|null|undefined){
  if(!value||!Number.isFinite(Date.parse(value)))return "—";
  return new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit",hour12:true}).format(new Date(value))+" ET";
}
function sessionVwapSeries(bars:Candle[]){
  let dateKey="";
  let cumulativeVolume=0;
  let cumulativeValue=0;
  const points:{time:UTCTimestamp;value:number}[]=[];
  for(const bar of bars){
    if(!bar.time||!Number.isFinite(Date.parse(bar.time)))continue;
    const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(new Date(bar.time));
    const get=(type:string)=>parts.find(part=>part.type===type)?.value??"";
    const key=get("year")+"-"+get("month")+"-"+get("day");
    const minutes=Number(get("hour"))*60+Number(get("minute"));
    if(key!==dateKey){dateKey=key;cumulativeVolume=0;cumulativeValue=0;}
    if(minutes<570||minutes>=960||!bar.volume||bar.volume<=0)continue;
    const typical=(bar.high+bar.low+bar.close)/3;
    cumulativeVolume+=bar.volume;
    cumulativeValue+=typical*bar.volume;
    points.push({time:timeOf(bar.time),value:cumulativeValue/cumulativeVolume});
  }
  return points;
}

function heikin(bars:Candle[]):Candle[]{
  let previousOpen=bars[0]?.open??0;
  let previousClose=bars[0]?.close??0;
  return bars.map((bar,index)=>{
    const close=(bar.open+bar.high+bar.low+bar.close)/4;
    const open=index===0?(bar.open+bar.close)/2:(previousOpen+previousClose)/2;
    const high=Math.max(bar.high,open,close);
    const low=Math.min(bar.low,open,close);
    previousOpen=open;previousClose=close;
    return {...bar,open,high,low,close};
  });
}

export function CueProChart({
  symbol,timeframe,bars,levels,action,teachingMode=false,score=null,coach,contextOnly=false,trades=emptyTrades,tradesLoading=false,tradesError,tradesTruncated=false,
}:{
  symbol:string;
  timeframe:string;
  bars:Candle[];
  levels?:Levels|null;
  action:CueAction;
  teachingMode?:boolean;
  score?:number|null;
  coach?:Coach|null;
  contextOnly?:boolean;
  trades?:ChartTrade[];tradesLoading?:boolean;tradesError?:string;tradesTruncated?:boolean;
}){
  const {authState}=useAuth();
  const userScope=authState.type==="authenticated"?String(authState.user.id):"preview";
  const storageKey="tradecue:chart-marks:v1:"+userScope+":"+symbol.toUpperCase()+":"+timeframe;
  const [stored,setStored]=useState<{key:string;marks:ChartMark[]}>({key:"",marks:[]});
  const marks=useMemo(()=>stored.key===storageKey?stored.marks:[],[stored,storageKey]);
  const [tool,setTool]=useState<DrawingTool|null>(null);
  const pending=useRef<{time:number;price:number}|null>(null);
  const [drawingMessage,setDrawingMessage]=useState("");
  const [showSessions,setShowSessions]=useState(true);
  const [showSwings,setShowSwings]=useState(true);
  const [showFib,setShowFib]=useState(false);
  const [expanded,setExpanded]=useState(false);
  const chartApi=useRef<any>(null);
  const zoom=(factor:number)=>{const scale=chartApi.current?.timeScale();const range=scale?.getVisibleLogicalRange();if(range){const width=(range.to-range.from)*factor;scale.setVisibleLogicalRange({from:range.to-width,to:range.to});}};
  const [fitLevels,setFitLevels]=useState(false);
  useEffect(()=>{
    pending.current=null;setTool(null);setDrawingMessage("");
    try{setStored({key:storageKey,marks:restoreChartMarks(localStorage.getItem(storageKey))});}
    catch{setStored({key:storageKey,marks:[]});setDrawingMessage("Drawing storage unavailable; drawings last only until you leave this chart.");}
  },[storageKey]);
  const saveMarks=(items:ChartMark[])=>{
    const next=items.slice(-50);
    setStored({key:storageKey,marks:next});
    try{localStorage.setItem(storageKey,JSON.stringify(next));}
    catch{setDrawingMessage("Drawing saved for this view only; browser storage is unavailable.");}
  };
  const drawRef=useRef({tool,marks,saveMarks});drawRef.current={tool,marks,saveMarks};
  useEffect(()=>{
    const escape=(event:KeyboardEvent)=>{if(event.key==="Escape"){pending.current=null;setTool(null);setDrawingMessage("");}};
    window.addEventListener("keydown",escape);return ()=>window.removeEventListener("keydown",escape);
  },[]);
  const host=useRef<HTMLDivElement|null>(null);
  const [hover,setHover]=useState<Candle|null>(null);
  const [pinnedTime,setPinnedTime]=useState<string|null>(null);
  const [chartStyle,setChartStyle]=useState<ChartStyle>("candles");
  useEffect(()=>{setPinnedTime(null);setHover(null);},[symbol,timeframe]);
  const clean=useMemo(()=>cleanChartBars(bars),[bars]);
  const [showFills,setShowFills]=useState(true);
  const [selectedTradeId,setSelectedTradeId]=useState<string|null>(null);
  const fillTimes=useMemo(()=>clean.map(bar=>bar.time!),[clean]);
  const visibleTrades=useMemo(()=>trades.filter(trade=>trade.symbol.toUpperCase()===symbol.toUpperCase()&&(chartFillBar(trade.entryTime,fillTimes,timeframe)!=null||trade.exits.some(exit=>chartFillBar(exit.time,fillTimes,timeframe)!=null))),[trades,symbol,fillTimes,timeframe]);
  const selectedTrade=visibleTrades.find(trade=>trade.id===selectedTradeId)??visibleTrades[0]??null;
  const selectedResult=selectedTrade?chartTradeResult(selectedTrade):null;
  const focusTrade=()=>{
    if(!selectedTrade)return;
    const times=[selectedTrade.entryTime,...selectedTrade.exits.map(exit=>exit.time)].flatMap(time=>{const bar=chartFillBar(time,fillTimes,timeframe);return bar==null?[]:[bar];});
    const indexes=times.map(time=>clean.findIndex(bar=>timeOf(bar.time!)===time)).filter(index=>index>=0);
    if(indexes.length)chartApi.current?.timeScale().setVisibleLogicalRange({from:Math.max(-2,Math.min(...indexes)-4),to:Math.max(...indexes)+5});
  };
  const displayBars=useMemo(()=>chartStyle==="heikin"?heikin(clean):clean,[clean,chartStyle]);
  const savedView=useRef<{key:string;from:number;to:number;count:number}|null>(null);
  const structure=useMemo(()=>calculateMarketStructure(clean),[clean]);
  const latest=clean.at(-1)??null;
  const annotations=useMemo(()=>chartAnnotations(clean),[clean]);

  useEffect(()=>{
    if(!host.current)return;
    const container=host.current;
    const chart=createChart(container,{
      width:container.clientWidth,
      height:container.clientHeight,
      layout:{background:{type:ColorType.Solid,color:"#071421"},textColor:"#e7f0f7",fontSize:16},
      localization:{timeFormatter:axisClock},
      grid:{vertLines:{color:"rgba(77,113,139,.08)"},horzLines:{color:"rgba(77,113,139,.08)"}},
      crosshair:{
        mode:CrosshairMode.Normal,
        vertLine:{color:"rgba(47,128,255,.50)",labelBackgroundColor:"#1762c9"},
        horzLine:{color:"rgba(47,128,255,.40)",labelBackgroundColor:"#1762c9"},
      },
      rightPriceScale:{borderColor:"rgba(89,126,153,.28)",scaleMargins:{top:.08,bottom:.18}},
      timeScale:{
        borderColor:"rgba(89,126,153,.28)",
        timeVisible:true,
        secondsVisible:false,
        rightOffset:8,
        barSpacing:11,
        minBarSpacing:3,
        tickMarkFormatter:axisClock,
      },
      handleScroll:{mouseWheel:true,pressedMouseMove:!tool,horzTouchDrag:true,vertTouchDrag:false},
      handleScale:{axisPressedMouseMove:true,mouseWheel:true,pinch:true},
      kineticScroll:{mouse:true,touch:true},
    });

    chartApi.current=chart;
    let primary:any;
    if(chartStyle==="line"){
      primary=chart.addSeries(LineSeries,{color:"#dbe8f2",lineWidth:2,priceLineVisible:true,lastValueVisible:true,crosshairMarkerVisible:true});
      primary.setData(clean.map(bar=>({time:timeOf(bar.time!),value:bar.close})));
    }else{
      primary=chart.addSeries(CandlestickSeries,{
        upColor:"#19d9a0",downColor:"#ff6178",wickUpColor:"#19d9a0",wickDownColor:"#ff6178",
        borderVisible:false,priceLineVisible:true,lastValueVisible:true,
      });
      primary.setData(displayBars.map(bar=>({time:timeOf(bar.time!),open:bar.open,high:bar.high,low:bar.low,close:bar.close})));
    }

    const volume=chart.addSeries(HistogramSeries,{priceScaleId:"",priceFormat:{type:"volume"},lastValueVisible:false,priceLineVisible:false});
    chart.priceScale("").applyOptions({scaleMargins:{top:.82,bottom:0}});
    volume.setData(clean.map(bar=>({time:timeOf(bar.time!),value:bar.volume,color:bar.close>=bar.open?"rgba(248,251,253,.82)":"rgba(190,202,212,.62)"})));

    const ema20Line=chart.addSeries(LineSeries,{title:"EMA 20",color:"#2f80ff",lineWidth:3,priceLineVisible:false,lastValueVisible:true,crosshairMarkerVisible:false});
    const e20=emaSeries(clean.map(bar=>bar.close),20);
    ema20Line.setData(clean.flatMap((bar,index)=>e20[index]==null?[]:[{time:timeOf(bar.time!),value:e20[index] as number}]));
    const vwapLine=chart.addSeries(LineSeries,{title:"VWAP",color:"#b9a7ff",lineWidth:2,lineStyle:LineStyle.Dashed,priceLineVisible:false,lastValueVisible:true,crosshairMarkerVisible:false});
    vwapLine.setData(sessionVwapSeries(clean));
    if(showFills&&selectedTrade){
      const entryTime=chartFillBar(selectedTrade.entryTime,fillTimes,timeframe);
      const spot=(time:number,price:number,text:string,color:string,shape:"arrowUp"|"arrowDown")=>{
        const series=chart.addSeries(LineSeries,{color,lineVisible:false,pointMarkersVisible:true,pointMarkersRadius:5,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:true});
        series.setData([{time:time as UTCTimestamp,value:price}]);
        createSeriesMarkers(series,[{time:time as UTCTimestamp,position:"inBar",color,shape,text}]);
      };
      if(entryTime!=null)spot(entryTime,selectedTrade.entryPrice,"FILLED ENTRY "+fmt(selectedTrade.entryPrice),"#64d8ff","arrowUp");
      for(const exit of chartTradeResult(selectedTrade).exits){
        const exitTime=chartFillBar(exit.time,fillTimes,timeframe);
        if(exitTime==null)continue;
        const pnl=(exit.price-selectedTrade.entryPrice)*exit.quantity;
        const color=pnl>=0?"#19d9a0":"#ff6178";
        spot(exitTime,exit.price,"FILLED EXIT "+fmt(exit.price)+" · "+pnlMoney(pnl),color,"arrowDown");
        if(entryTime!=null&&entryTime<exitTime){
          const path=chart.addSeries(LineSeries,{color,lineWidth:3,lineStyle:LineStyle.Dashed,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false});
          path.setData([{time:entryTime as UTCTimestamp,value:selectedTrade.entryPrice},{time:exitTime as UTCTimestamp,value:exit.price}]);
        }
      }
    }

    const plottedPrices:number[]=[];
    const recent=clean.slice(-120);
    if(recent.length){
      const lo=Math.min(...recent.map(b=>b.low));
      const hi=Math.max(...recent.map(b=>b.high));
      const range=Math.max(hi-lo,.01);
      const near=(price:number)=>price>=lo-range*.28&&price<=hi+range*.28;
      const line=(price:number,title:string,color:string,style=LineStyle.Dashed,width:1|2|3|4=1)=>{
        if(!Number.isFinite(price)||price<=0)return;
        plottedPrices.push(price);
        primary.createPriceLine({price,title,color,lineWidth:width,lineStyle:style,axisLabelVisible:true,lineVisible:true});
      };
      if(showSessions)annotations.levels.forEach(level=>line(level.price,level.label,level.color,LineStyle.Dotted));
      if(showFib)annotations.fib.forEach(level=>line(level.price,level.label,level.color,LineStyle.Dotted));
      for(const mark of marks){
        if(mark.kind==="level")line(mark.start.price,"MY "+mark.label.toUpperCase(),mark.color,LineStyle.Solid,2);
        else if(mark.kind==="fib")chartMarkFib(mark).forEach(level=>line(level.price,"MY "+level.label,level.color,LineStyle.Dotted));
        else if(mark.end&&clean.some(b=>timeOf(b.time!)===mark.start.time)&&clean.some(b=>timeOf(b.time!)===mark.end!.time)){
          const trend=chart.addSeries(LineSeries,{color:mark.color,lineWidth:2,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false});
          trend.setData([mark.start,mark.end].sort((a,b)=>a.time-b.time).map(point=>({time:point.time as UTCTimestamp,value:point.price})));
          plottedPrices.push(mark.start.price,mark.end.price);
        }
      }
      if(structure.resistance)line(structure.resistance.price,"RESISTANCE","#f5a742",LineStyle.Dashed,2);
      if(structure.support)line(structure.support.price,"SUPPORT","#19d9a0",LineStyle.Dashed,1);
      if(levels){
        line(levels.entryLow,contextOnly?"STUDY ENTRY":"PLANNED ENTRY","#2f80ff",LineStyle.Solid,2);
        line(levels.entryHigh,contextOnly?"STUDY TRIGGER":"ENTRY ZONE TOP","#66a3ff",LineStyle.Solid,2);
        const entrySpot=chart.addSeries(LineSeries,{color:"#66a3ff",lineVisible:false,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false});
        entrySpot.setData([{time:timeOf(clean.at(-1)!.time!),value:levels.entryLow}]);
        createSeriesMarkers(entrySpot,[{time:timeOf(clean.at(-1)!.time!),position:"inBar",color:"#b8d6ff",shape:"arrowUp",text:contextOnly?"Study entry":"Planned entry · not filled"}]);
        line(levels.stop,"STOP","#ff435f",LineStyle.Dashed,3);
        line(levels.target1,"1R REFERENCE","#28d79a",LineStyle.Dashed,1);
        line(levels.target2,"TAKE PROFIT · 2R","#28d79a",LineStyle.Dashed,1);
        line(levels.target3,"EXTENDED TARGET · 3R","#28d79a",LineStyle.Dotted,1);
      }
    }

    const visiblePrices=fitLevels?plottedPrices:levels?[levels.entryLow,levels.entryHigh,levels.stop,levels.target2,levels.target3]:[];
    if(visiblePrices.length){
      primary.applyOptions({autoscaleInfoProvider:(original:()=>any)=>{
        const base=original();
        if(!base)return base;
        return {...base,priceRange:{minValue:Math.min(base.priceRange.minValue,...visiblePrices),maxValue:Math.max(base.priceRange.maxValue,...visiblePrices)}};
      }});
    }
    if(showSwings){
      const names:Record<string,string>={HH:"Higher high",HL:"Higher low",LH:"Lower high",LL:"Lower low",SH:"Swing high",SL:"Swing low",EH:"Equal high",EL:"Equal low"};
      const markers:any[]=annotations.pivots.slice(-6).map(p=>({time:p.time as UTCTimestamp,position:p.kind==="high"?"aboveBar":"belowBar",color:p.kind==="high"?"#f5a742":"#19d9a0",shape:"circle",text:names[p.label]??p.label}));
      const offset=Math.max(0,clean.length-240);
      let lastEventIndex=-10;
      for(const event of structure.events.slice(-6)){
        if(!["BOS_UP","BOS_DOWN","SWEEP_HIGH","SWEEP_LOW"].includes(event.kind))continue;
        const bar=clean[offset+event.index];
        if(!bar?.time||event.index-lastEventIndex<6)continue;
        lastEventIndex=event.index;
        const up=event.kind==="BOS_UP"||event.kind==="SWEEP_LOW";
        markers.push({time:timeOf(bar.time),position:up?"belowBar":"aboveBar",color:up?"#66a3ff":"#ff9cc6",shape:up?"arrowUp":"arrowDown",text:({BOS_UP:"Broke prior high",BOS_DOWN:"Broke prior low",SWEEP_HIGH:"High tested + rejected",SWEEP_LOW:"Low tested + recovered"} as Record<string,string>)[event.kind]});
      }
      createSeriesMarkers(primary,markers.sort((a,b)=>Number(a.time)-Number(b.time)));
    }

    if(clean.length){
      const saved=savedView.current;
      if(saved?.key===symbol+":"+timeframe+":"+chartStyle){
        const shift=saved.to>=saved.count-1?Math.max(0,clean.length-saved.count):0;
        chart.timeScale().setVisibleLogicalRange({from:saved.from+shift,to:saved.to+shift});
      }else{
        chart.timeScale().setVisibleLogicalRange({from:Math.max(0,clean.length-55),to:clean.length+5});
      }
    }

    chart.subscribeClick(param=>{
      const active=drawRef.current.tool;
      if(active&&param.point&&typeof param.time==="number"){
        const price=primary.coordinateToPrice(param.point.y);
        if(!Number.isFinite(price)||price<=0)return;
        const point={time:Number(param.time),price:Number(price)};
        if(active.kind!=="level"&&!pending.current){pending.current=point;setDrawingMessage("First anchor set. Click the second candle and price; Escape cancels.");return;}
        if(active.kind!=="level"&&pending.current?.time===point.time){setDrawingMessage("Choose a different candle for the second anchor.");return;}
        const mark:ChartMark={id:crypto.randomUUID(),kind:active.kind,label:active.label,color:active.color,start:pending.current??point,...(active.kind!=="level"?{end:point}:{})};
        drawRef.current.saveMarks([...drawRef.current.marks,mark]);
        pending.current=null;setTool(null);setDrawingMessage("Drawing added. Prices are editable below the chart.");
        return;
      }
      if(typeof param.time==="number"){
        const bar=clean.find(item=>timeOf(item.time!)===param.time);
        if(bar?.time)setPinnedTime(bar.time);
      }
    });
    chart.subscribeCrosshairMove(param=>{
      if(!param.time){setHover(null);return;}
      const unix=typeof param.time==="number"?param.time:null;
      if(unix==null){setHover(null);return;}
      const bar=clean.find(item=>timeOf(item.time!)===unix);
      setHover(bar??null);
    });

    const resize=new ResizeObserver(entries=>{
      const box=entries[0]?.contentRect;
      if(box)chart.applyOptions({width:Math.floor(box.width),height:Math.floor(box.height)});
    });
    resize.observe(container);
    return ()=>{
      const range=chart.timeScale().getVisibleLogicalRange();
      if(range)savedView.current={key:symbol+":"+timeframe+":"+chartStyle,from:Number(range.from),to:Number(range.to),count:clean.length};
      resize.disconnect();chartApi.current=null;chart.remove();
    };
  },[symbol,timeframe,clean,displayBars,levels,chartStyle,contextOnly,structure.resistance?.price,structure.support?.price,annotations,marks,showSessions,showSwings,showFib,fitLevels,tool,selectedTrade,showFills,fillTimes]);

  const pinnedIndex=pinnedTime?clean.findIndex(b=>b.time===pinnedTime):-1;
  const hoverIndex=hover?clean.indexOf(hover):-1;
  const lessonIndex=pinnedIndex>=0?pinnedIndex:hoverIndex>=0?hoverIndex:clean.length-1;
  const read=clean[lessonIndex]??latest;
  const actionClass=action==="BUY"||action==="HOLD"?styles.good:action==="SELL"||action==="AVOID"?styles.bad:styles.wait;
  const coachDecision=!coach?"DATA":
    coach.stage==="ENTRY_READY"?"ENTER ZONE":
    ["PRICE_ACTION_BEARISH","BELOW_EMA20","BELOW_VWAP","TOO_EXTENDED","TARGET_UNREALISTIC"].includes(coach.stage)?"DO NOT ENTER":"WAIT";
  const coachReason=!coach?"Waiting for enough candles.":
    coach.stage==="PRICE_ACTION_BEARISH"?"Lower highs + lower lows. No long entry.":
    coach.stage==="PRICE_ACTION_NOT_BULLISH"?"Wait for a clean higher-high + higher-low structure.":
    coach.stage==="BELOW_EMA20"?"Price is below EMA20.":
    coach.stage==="EMA20_NOT_RISING"?"EMA20 is not rising.":
    coach.stage==="VWAP_UNAVAILABLE"?"Regular-session VWAP is not ready yet.":
    coach.stage==="BELOW_VWAP"?"Price is below VWAP.":
    coach.stage==="VOLUME_NOT_RISING"?"Wait for confirmation volume to expand.":
    coach.stage==="TOO_EXTENDED"?"Price already ran too far above EMA20. Do not chase.":
    coach.stage==="TARGET_UNREALISTIC"?"The 2R target is too far for current ATR. Skip it.":
    coach.stage==="WAIT_PULLBACK"?"Buy team is in control, but wait for the pullback toward EMA20.":
    coach.stage==="WAIT_GREEN"?"Pullback happened. Wait for a completed green confirmation candle.":
    contextOnly?"Pattern is visible here for learning; Omega still executes only from the 5-minute chart.":
    "Pullback + completed green confirmation + stop + targets are defined.";

  return <div className={expanded?styles.shell+" "+styles.expanded:styles.shell}>
    <div className={styles.head}>
      <div className={styles.symbol}>
        <strong>{symbol}</strong><span>{timeframe}</span><em>{clean.length.toLocaleString()} real bars</em>
        {contextOnly?<i>CONTEXT ONLY</i>:<i>5m EXECUTION</i>}
        {teachingMode&&<i>PROFESSOR CUE ON</i>}
      </div>
      <div className={styles.ohlc}>
        <span>O <b>{fmt(read?.open)}</b></span><span>H <b>{fmt(read?.high)}</b></span><span>L <b>{fmt(read?.low)}</b></span><span>C <b>{fmt(read?.close)}</b></span>
        <span>DATE <b>{fullClock(read?.time)}</b></span>
      </div>
      <div className={styles.structure}><span className={actionClass}>{action??"DATA"}{score!=null?" · "+score:""}</span><small>{structure.trend} · {structure.pattern}</small></div>
    </div>

    <div className={styles.chartTools}>
      <span>Chart view</span>
      <button type="button" onClick={()=>zoom(.7)}>Zoom in +</button>
      <button type="button" onClick={()=>zoom(1.4)}>Zoom out −</button>
      <button type="button" onClick={()=>{savedView.current=null;chartApi.current?.timeScale().setVisibleLogicalRange({from:Math.max(0,clean.length-55),to:clean.length+5});}}>Latest 55 candles</button>
      <button type="button" aria-pressed={expanded} onClick={()=>setExpanded(v=>!v)}>{expanded?"Close large chart":"Open large chart"}</button>
      {(["candles","heikin","line"] as ChartStyle[]).map(style=><button key={style} className={chartStyle===style?styles.toolActive:undefined} onClick={()=>setChartStyle(style)}>{style==="heikin"?"Heikin-Ashi":style[0].toUpperCase()+style.slice(1)}</button>)}
      <em>{contextOnly?"Study timeframe — no autonomous orders from this chart":"Omega execution chart"}</em>
    </div>

    <div className={styles.chartTools} role="group" aria-label="Chart drawing tools">
      <span>Draw a line → choose a tool, then click the chart</span>
      {drawingTools.map(item=><button type="button" key={item.label} disabled={!clean.length} aria-pressed={tool?.label===item.label} className={tool?.label===item.label?styles.toolActive:undefined} onClick={()=>{pending.current=null;setTool(item);setDrawingMessage(item.kind==="level"?"Click the chart at your chosen price.":"Click two candles at your chosen anchor prices.");}}>{item.label}</button>)}
      {tool&&<button type="button" onClick={()=>{pending.current=null;setTool(null);setDrawingMessage("");}}>Cancel drawing</button>}
    </div>
    <div className={styles.chartTools} role="group" aria-label="Automatic chart levels">
      <span>Auto marks</span>
      <button type="button" aria-pressed={showSessions} onClick={()=>setShowSessions(v=>!v)}>Day / premarket / prior highs & lows {showSessions?"ON":"OFF"}</button>
      <button type="button" aria-pressed={showSwings} onClick={()=>setShowSwings(v=>!v)}>Swings / breaks {showSwings?"ON":"OFF"}</button>
      <button type="button" aria-pressed={showFib} onClick={()=>setShowFib(v=>!v)}>Auto retracement {showFib?"ON":"OFF"}</button>
      <button type="button" aria-pressed={fitLevels} onClick={()=>setFitLevels(v=>!v)}>{fitLevels?"Fit candles":"Fit all levels"}</button>
    </div>
    {drawingMessage&&<p className={styles.drawNotice} role="status">{drawingMessage}</p>}
    <div className={styles.chartGuide}>
      <strong>{levels?(contextOnly?"Study plan — no entry order":action==="BUY"?"Entry plan — Omega must approve all gates":"WAIT — planned entry zone, not an order"):"WAIT — no valid entry plan"}</strong>
      {levels?<p>Entry zone <b>{fmt(levels.entryLow)}–{fmt(levels.entryHigh)}</b> · Stop <b>{fmt(levels.stop)}</b> · Take profit <b>{fmt(levels.target2)} (2R)</b> · Extended target <b>{fmt(levels.target3)} (3R)</b>. These prices are marked on the chart; a plan is not a fill.</p>:<p>No entry arrow or stop/target prices until a plan exists. A break above a high alone is not an entry.</p>}
      <p><b>Support</b> = floor · <b>Resistance</b> = ceiling · <b>Broke prior high (BOS up)</b> = price broke a previous swing high · <b>Retracement / Fib</b> = how far price pulled back from a swing move. Study levels do not approve a trade.</p>
    </div>
    <div className={styles.chartWrap}><div ref={host} className={styles.chart}/></div>
    <section className={styles.fillDesk} aria-label="Your confirmed entry and exit fills">
      <div className={styles.fillHead}><div><strong>YOUR FILLED TRADES</strong><span>Cyan ↑ entry · green ↓ profitable exit · red ↓ losing exit</span></div><button type="button" aria-pressed={showFills} onClick={()=>setShowFills(value=>!value)}>Filled trade markers {showFills?"ON":"OFF"}</button></div>
      {tradesError?<p role="status">Trade markers unavailable — {tradesError}</p>:tradesLoading?<p role="status">Updating confirmed fills…</p>:!visibleTrades.length?<p>No confirmed fills in the loaded candles for this symbol and selected paper account.</p>:null}
      {visibleTrades.length>0&&<label>Choose a trade<select value={selectedTrade?.id??""} onChange={event=>setSelectedTradeId(event.target.value)}>{visibleTrades.map(trade=><option value={trade.id} key={trade.id}>{fullClock(trade.entryTime)} · {chartTradeResult(trade).grossPnl==null?"No confirmed exits":pnlMoney(chartTradeResult(trade).grossPnl!)}</option>)}</select></label>}
      {selectedTrade&&selectedResult&&<>
        <div className={styles.fillResult}><strong className={selectedResult.grossPnl==null?styles.wait:selectedResult.grossPnl>=0?styles.good:styles.bad}>{selectedResult.grossPnl==null?"No confirmed realized result":pnlMoney(selectedResult.grossPnl)+" realized gross"}</strong><button type="button" onClick={focusTrade}>Show entry & exits</button></div>
        <div className={styles.fillRows}><div><b>↑ Filled entry average</b><span>{fmt(selectedTrade.entryPrice)} · {selectedTrade.quantity??"—"} shares</span><time>{fullClock(selectedTrade.entryTime)}</time></div>
          {selectedResult.exits.map(exit=><div key={exit.id}><b>↓ Filled sale</b><span>{fmt(exit.price)} · {exit.quantity} shares · <em className={exit.price>=selectedTrade.entryPrice?styles.good:styles.bad}>{pnlMoney((exit.price-selectedTrade.entryPrice)*exit.quantity)}</em></span><time>{fullClock(exit.time)}</time></div>)}
        </div>
        <p>{selectedTrade.status==="closed"&&(selectedResult.remaining==null||selectedResult.remaining>0)?"Closed journal trade; confirmed exit details are incomplete.":selectedResult.remaining==null?"Remaining quantity unconfirmed.":selectedResult.remaining>0?selectedResult.remaining+" shares remain open; their unrealized P/L is excluded.":"All recorded shares sold."} {chartFillBar(selectedTrade.entryTime,fillTimes,timeframe)==null?"Entry lies outside the loaded candles; only loaded exit locations are plotted.":""}</p>
      </>}
      {tradesTruncated&&<p>The latest 200 overlapping journal trades are available; older trades may be omitted.</p>}
      <p>Markers use confirmed paper fills. Arrows sit on the containing candle; prices and times above are the recorded fill values. Dashed connections show entry-to-exit movement. Gross P/L excludes fees. Planned levels remain separate from actual fills.</p>
    </section>

    <details className={styles.levelDetails}>
      <summary>Price map · highs, lows, retracement and my drawings ({marks.length})</summary>
      <p>Levels use loaded bars for {annotations.sessionDate??"the selected session"}; gaps or missing earlier bars can make session ranges incomplete. Swing marks confirm after two later candles. Fib uses the latest confirmed swing leg; it is a study, not an entry signal.</p>
      {annotations.anchors&&<p>Retracement anchors: {annotations.anchors.start.label} {fmt(annotations.anchors.start.price)} → {annotations.anchors.end.label} {fmt(annotations.anchors.end.price)}</p>}
      <div className={styles.levelGrid}>
        {annotations.levels.map(l=><span key={l.label}><b>{l.label}</b>{fmt(l.price)}</span>)}
        {annotations.fib.map(l=><span key={l.label}><b>{l.label}</b>{fmt(l.price)}</span>)}
        {levels&&[["Plan entry",levels.entryLow],["Plan trigger",levels.entryHigh],["Plan stop",levels.stop],["1R reference",levels.target1],["Primary TP · 2R",levels.target2],["Extended TP · 3R",levels.target3]].map(([label,price])=><span key={String(label)}><b>{label}</b>{fmt(Number(price))}</span>)}
      </div>
      <p>Plan and drawing lines do not place orders or change Omega's rules. A drawn stop is not broker-confirmed protection. Short lines are study-only. My drawings are saved on this browser by account, symbol and timeframe.</p>
      {marks.map(mark=><div className={styles.markRow} key={mark.id}>
        <strong>{mark.label}</strong>
        <label>{mark.end?"First price":"Price"}<Input type="number" step="any" min="0" aria-label={mark.label+" first price"} defaultValue={mark.start.price.toFixed(4)} onBlur={e=>{const price=Number(e.target.value);if(Number.isFinite(price)&&price>0)saveMarks(marks.map(m=>m.id===mark.id?{...m,start:{...m.start,price}}:m));else e.target.value=String(mark.start.price);}}/></label>
        {mark.end&&<label>Second price<Input type="number" step="any" min="0" aria-label={mark.label+" second price"} defaultValue={mark.end.price.toFixed(4)} onBlur={e=>{const price=Number(e.target.value);if(Number.isFinite(price)&&price>0)saveMarks(marks.map(m=>m.id===mark.id?{...m,end:{...m.end!,price}}:m));else e.target.value=String(mark.end!.price);}}/></label>}
        <Button type="button" size="sm" variant="ghost" onClick={()=>saveMarks(marks.filter(m=>m.id!==mark.id))}>Delete {mark.label}</Button>
      </div>)}
      {marks.length>0&&<Button type="button" size="sm" variant="outline" onClick={()=>saveMarks(marks.slice(0,-1))}>Undo last drawing</Button>}
    </details>

    <div className={styles.decisionBanner}>
      <div><small>PROFESSOR CUE CHART CALL</small><strong className={coachDecision==="ENTER ZONE"?styles.good:coachDecision==="DO NOT ENTER"?styles.bad:styles.wait}>{coachDecision}</strong></div>
      <p>{coachReason}</p>
      {levels&&<span>Entry {fmt(levels.entryLow)}–{fmt(levels.entryHigh)} · Stop {fmt(levels.stop)} · Resistance {fmt(structure.resistance?.price)}</span>}
    </div>

    {coach&&<div className={styles.coach}>
      <div className={styles.coachHead}><span>{timeframe} EMA20 PLAYBOOK</span><strong>{coach.stage.replaceAll("_"," ")}</strong><em>EMA20 {fmt(coach.ema20)}</em></div>
      <div className={styles.coachChecks}>
        <span className={coach.priceActionTrend==="BULLISH"?styles.pass:styles.waiting}><b>1</b>Higher highs + higher lows</span>
        <span className={coach.aboveEma20?styles.pass:styles.waiting}><b>2</b>Above EMA20</span>
        <span className={coach.aboveVwap?styles.pass:styles.waiting}><b>3</b>Above VWAP</span>
        <span className={coach.volumeIncreasing?styles.pass:styles.waiting}><b>4</b>Volume</span>
        <span className={coach.pullback&&coach.greenConfirmation?styles.pass:styles.waiting}><b>5</b>Pullback + green</span>
      </div>
    </div>}

    <div className={styles.foot}>
      <span><b>EMA 20</b> blue · {fmt(emaSeries(clean.map(bar=>bar.close),20).at(-1))}</span>
      <span><b>VWAP</b> purple · {fmt(coach?.vwap)}</span>
      <span><b>Resistance</b> amber</span><span><b>Support</b> green</span><span><b>STOP</b> red</span>
      <span><b>Clock</b> Eastern · AM/PM + date</span><span><b>White bars</b> volume</span>
    </div>

    {teachingMode&&clean.length>0&&<>
      <div className={styles.foot} role="group" aria-label="Select candle lesson">
        <Button type="button" size="sm" variant="outline" disabled={lessonIndex<=0} onClick={()=>setPinnedTime(clean[lessonIndex-1].time??null)}>Previous candle</Button>
        <Button type="button" size="sm" variant="outline" disabled={lessonIndex>=clean.length-1} onClick={()=>setPinnedTime(clean[lessonIndex+1].time??null)}>Next candle</Button>
        <Button type="button" size="sm" variant="ghost" onClick={()=>{setPinnedTime(null);setHover(null);}}>Latest candle</Button>
        <span>{pinnedIndex>=0?"Pinned lesson":"Hover to inspect · tap to pin"}</span>
      </div>
      <CandleEducation bars={clean} index={lessonIndex} symbol={symbol} timeframe={timeframe} replay={false}/>
    </>}
  </div>;
}
