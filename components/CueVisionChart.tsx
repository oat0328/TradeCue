import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "./Button";
import {
  heikinAshi,
  visibleVwap,
  easternMinute,
  chartZones,
  emaSeries,
  smaSeries,
  rsiSeries,
  atrSeries,
  bollingerSeries,
  macdSeries,
  type Candle,
} from "../helpers/chartMath";
import { calculateMarketStructure } from "../helpers/marketStructure";
import styles from "./CueVisionChart.module.css";

export type { Candle } from "../helpers/chartMath";

export type CueChartLevels = {
  entryLow: number;
  entryHigh: number;
  stop: number;
  target1: number;
  target2: number;
  target3: number;
};

export type CueCoachContext = {
  score:number;
  fresh:boolean;
  componentScores:{trend:number;momentum:number;volume:number;setup:number;risk:number};
  relativeVolume:number;
  rsi14:number;
  ema9:number;
  ema20:number;
  atrPercent:number;
  support20:number;
  resistance20:number;
};

const lessons = {
  candles: {
    title: "Read a candle",
    text: "Each candle summarizes one time interval. The body connects the opening and closing prices. The wick shows the highest and lowest traded prices. Green means the close was above the open; red means it was below. A green candle alone is not a buy signal.",
  },
  vwap: {
    title: "Understand VWAP",
    text: "VWAP weights prices by traded volume. This chart shows visible-range VWAP: it changes when you zoom or pan because the included bars change. It is not an exchange session VWAP. Price above it only means price is above that range’s weighted average.",
  },
  volume: {
    title: "Understand volume",
    text: "Volume counts shares traded during a candle. A large bar means more activity, not necessarily buying pressure—every trade has both a buyer and a seller. Compare similar times of day and completed bars; the newest candle may still be forming.",
  },
  sessions: {
    title: "Understand session zones",
    text: "Shaded areas use each candle’s timestamp in New York time, including daylight saving time. These are study presets for periods of market activity, not orders or buy signals. Daily and weekly candles do not show intraday zones.",
  },
  heikin: {
    title: "Heikin-Ashi versus real prices",
    text: "Heikin-Ashi smooths candles using calculated averages and the preceding Heikin-Ashi candle. Its open and close are synthetic, so they are not executable market prices. The inspector below always shows the original Webull OHLC values.",
  },
};

export default function CueVisionChart({
  symbol,
  timeframe,
  bars,
  dataSource = "unavailable",
  levels,
  signalLabel,
  coachContext,
  teachingMode = true,
}: {
  symbol: string;
  timeframe: string;
  bars?: Candle[];
  dataSource?: "webull-paper" | "unavailable";
  levels?: CueChartLevels | null;
  signalLabel?: "BUY" | "WAIT" | "HOLD" | "SELL" | "AVOID" | null;
  coachContext?: CueCoachContext | null;
  teachingMode?: boolean;
}) {
  const [style, setStyle] = useState<"candles" | "heikin" | "ohlc">("candles");
  const [count, setCount] = useState(42);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [lesson, setLesson] = useState<keyof typeof lessons>("candles");
  const [showZones, setShowZones] = useState(false);
  const [showLevels, setShowLevels] = useState(true);
  const [advancedOverlays,setAdvancedOverlays]=useState(false);
  const [replayMode,setReplayMode]=useState(false);
  const [replayCutoff,setReplayCutoff]=useState<number|null>(null);
  const [indicators, setIndicators] = useState(
    () => new Set(["VWAP", "VOLUME", "EMA9", "EMA20"]),
  );
  const [zones, setZones] = useState(() => new Set(chartZones.map((zone) => zone.key)));
  const drag = useRef<{ x: number; offset: number } | null>(null);

  useEffect(() => {
    setOffset(0);
    setSelected(null);
    setReplayMode(false);
    setReplayCutoff(null);
  }, [symbol, timeframe]);

  const sourceAll = useMemo(
    () =>
      dataSource === "webull-paper"
        ? (bars || []).filter((candle) =>
            [candle.open, candle.high, candle.low, candle.close].every(Number.isFinite),
          )
        : [],
    [bars, dataSource],
  );
  const all=useMemo(()=>{
    if(!replayMode||replayCutoff==null)return sourceAll;
    return sourceAll.slice(0,Math.max(8,Math.min(sourceAll.length,replayCutoff)));
  },[sourceAll,replayMode,replayCutoff]);

  const size = Math.min(count, all.length);
  const maxVisible = Math.min(1200,Math.max(12,all.length));
  const maxOffset = Math.max(0, all.length - size);
  const safeOffset = Math.min(offset, maxOffset);
  const start = Math.max(0, all.length - safeOffset - size);
  const raw = all.slice(start, start + size);
  const heikin = useMemo(() => heikinAshi(all), [all]);
  const transformed = useMemo(
    () => (style === "heikin" ? heikin : all),
    [style, heikin, all],
  );
  const rendered = transformed.slice(start, start + size);
  const visibleHeikin = heikin.slice(start, start + size);

  const indicatorSeries = useMemo(() => {
    const closes = all.map((candle) => candle.close);
    return {
      ema9: emaSeries(closes, 9),
      ema20: emaSeries(closes, 20),
      ema50: emaSeries(closes, 50),
      ema200: emaSeries(closes, 200),
      sma50: smaSeries(closes, 50),
      sma200: smaSeries(closes, 200),
      rsi14: rsiSeries(closes, 14),
      atr14: atrSeries(all, 14),
      bollinger: bollingerSeries(closes, 20, 2),
      macd: macdSeries(closes),
    };
  }, [all]);

  const sliceSeries = (series: (number | null)[]) => series.slice(start, start + size);
  const visibleSeries = {
    ema9: sliceSeries(indicatorSeries.ema9),
    ema20: sliceSeries(indicatorSeries.ema20),
    ema50: sliceSeries(indicatorSeries.ema50),
    ema200: sliceSeries(indicatorSeries.ema200),
    sma50: sliceSeries(indicatorSeries.sma50),
    sma200: sliceSeries(indicatorSeries.sma200),
    bollUpper: sliceSeries(indicatorSeries.bollinger.upper),
    bollLower: sliceSeries(indicatorSeries.bollinger.lower),
    rsi14: sliceSeries(indicatorSeries.rsi14),
    atr14: sliceSeries(indicatorSeries.atr14),
    macd: sliceSeries(indicatorSeries.macd.line),
    macdSignal: sliceSeries(indicatorSeries.macd.signal),
  };

  const index =
    selected === null
      ? Math.max(0, raw.length - 1)
      : Math.min(selected, raw.length - 1);
  const candle = raw[index];
  const haCandle = visibleHeikin[index];
  const vwap = visibleVwap(raw);
  const intraday = !["1D", "1W"].includes(timeframe);
  const structure = useMemo(()=>calculateMarketStructure(all),[all]);

  const etDayKey = (value:string) => new Intl.DateTimeFormat("en-CA", {
    timeZone:"America/New_York", year:"numeric", month:"2-digit", day:"2-digit",
  }).format(new Date(value));
  const latestBar = all[all.length-1];
  const visibleLastPrice = raw.at(-1)?.close ?? null;
  const latestDay = latestBar?.time ? etDayKey(latestBar.time) : null;
  const sameDay = latestDay ? all.filter(bar=>bar.time ? etDayKey(bar.time)===latestDay : false) : [];
  const rangeFor = (from:number,to:number) => {
    const rows=sameDay.filter(bar=>{
      const minute=easternMinute(bar.time);
      return minute!=null&&minute>=from&&minute<to;
    });
    return rows.length ? {
      high:Math.max(...rows.map(bar=>bar.high)),
      low:Math.min(...rows.map(bar=>bar.low)),
    } : null;
  };
  const premarketRange = intraday ? rangeFor(4*60,9*60+30) : null;
  const openingRange = intraday ? rangeFor(9*60+30,10*60) : null;

  const width = 1600;
  const height = 940;
  const left = 30;
  const right = 205;
  const top = 42;
  const bottom = 100;
  const plotHeight = 735;
  const plotWidth = width - left - right;

  const indicatorPriceValues = [
    indicators.has("EMA9") ? visibleSeries.ema9 : [],
    indicators.has("EMA20") ? visibleSeries.ema20 : [],
    indicators.has("EMA50") ? visibleSeries.ema50 : [],
    indicators.has("EMA200") ? visibleSeries.ema200 : [],
    indicators.has("SMA50") ? visibleSeries.sma50 : [],
    indicators.has("SMA200") ? visibleSeries.sma200 : [],
    indicators.has("BOLL") ? visibleSeries.bollUpper : [],
    indicators.has("BOLL") ? visibleSeries.bollLower : [],
  ].flat().filter((value): value is number => value != null && Number.isFinite(value));
  const visiblePriceHigh=raw.length?Math.max(...raw.map(candle=>candle.high)):null;
  const visiblePriceLow=raw.length?Math.min(...raw.map(candle=>candle.low)):null;
  const candleLow = rendered.length ? Math.min(...rendered.map((candle) => candle.low)) : 0;
  const candleHigh = rendered.length ? Math.max(...rendered.map((candle) => candle.high)) : 1;
  const candleRange = Math.max(candleHigh - candleLow, Math.max(Math.abs(candleHigh) * 0.0025, 0.01));
  const nearbyFloor = candleLow - candleRange * 0.35;
  const nearbyCeiling = candleHigh + candleRange * 0.35;
  const nearbyIndicators = indicatorPriceValues.filter((value)=>value>=nearbyFloor&&value<=nearbyCeiling);
  const rawLow = Math.min(candleLow,...nearbyIndicators);
  const rawHigh = Math.max(candleHigh,...nearbyIndicators);
  const range = Math.max(rawHigh - rawLow, 0.01);
  const min = rawLow - range * 0.12;
  const max = rawHigh + range * 0.12;

  const y = (value: number) =>
    top + ((max - value) / Math.max(max - min, 0.000001)) * plotHeight;
  const step = plotWidth / Math.max(1, raw.length);
  const x = (i: number) => left + (i + 0.5) * step;
  const bodyWidth = Math.max(4, Math.min(24, step * 0.72));
  const maxVolume = Math.max(1, ...raw.map((item) => item.volume || 0));
  const haRange = haCandle ? Math.max(haCandle.high-haCandle.low,0.000001) : 0;
  const haBody = haCandle ? Math.abs(haCandle.close-haCandle.open) : 0;
  const haUpperWick = haCandle ? haCandle.high-Math.max(haCandle.open,haCandle.close) : 0;
  const haLowerWick = haCandle ? Math.min(haCandle.open,haCandle.close)-haCandle.low : 0;
  const haBullish = Boolean(haCandle && haCandle.close>haCandle.open);
  const haBearish = Boolean(haCandle && haCandle.close<haCandle.open);
  const haIndecision = Boolean(haCandle && haBody/haRange<=.28 && haUpperWick/haRange>=.22 && haLowerWick/haRange>=.22);
  const haConviction = haBullish && haLowerWick/haRange<=.06
    ? "BULLISH CONTROL"
    : haBearish && haUpperWick/haRange<=.06
      ? "BEARISH CONTROL"
      : haIndecision
        ? "INDECISION / REVERSAL WATCH"
        : haBullish
          ? "BULLISH, MIXED WICKS"
          : haBearish
            ? "BEARISH, MIXED WICKS"
            : "NEUTRAL";
  const haBodyRead = !haCandle ? "—" : haBody/haRange>=.60 ? "LARGE / STRONG" : haBody/haRange<=.28 ? "SMALL / LOSING STEAM" : "MEDIUM";
  const haWickRead = !haCandle ? "—" : haIndecision ? "BOTH SIDES PUSHING" : haUpperWick>haLowerWick ? "UPPER REJECTION" : haLowerWick>haUpperWick ? "LOWER REJECTION" : "BALANCED";

  const zoneRuns: { key: string; label: string; from: number; to: number }[] = [];
  if (showZones && intraday) {
    for (const zone of chartZones.filter((item) => zones.has(item.key))) {
      let first = -1;
      for (let i = 0; i <= raw.length; i++) {
        const minute = i < raw.length ? easternMinute(raw[i].time) : null;
        const inside =
          minute !== null && minute >= zone.start && minute < zone.end;
        if (inside && first < 0) first = i;
        if (!inside && first >= 0) {
          zoneRuns.push({
            key: zone.key + "-" + first,
            label: zone.label,
            from: first,
            to: i,
          });
          first = -1;
        }
      }
    }
  }

  const format = (value?: number) =>
    value != null && Number.isFinite(value) ? value.toFixed(2) : "—";
  const formatTime = (value?: string) =>
    value && Number.isFinite(Date.parse(value))
      ? new Intl.DateTimeFormat("en-US", {
          timeZone: "America/New_York",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }).format(new Date(value)) + " ET"
      : "—";

  const zoom = (factor: number) => {
    setCount((value) =>
      Math.max(12, Math.min(maxVisible, Math.round(value * factor))),
    );
    setSelected(null);
  };

  const selectAt = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!raw.length) return;
    const box = event.currentTarget.getBoundingClientRect();
    const sx = ((event.clientX - box.left) / box.width) * width;
    setSelected(
      Math.max(0, Math.min(raw.length - 1, Math.floor((sx - left) / step))),
    );
    if (drag.current) {
      const delta = Math.round(
        ((event.clientX - drag.current.x) / (box.width * (plotWidth / width))) * size,
      );
      setOffset(Math.max(0, Math.min(maxOffset, drag.current.offset + delta)));
    }
  };

  const linePath = (values: (number | null)[]) => {
    let path = "";
    let drawing = false;
    values.forEach((value, i) => {
      if (value == null || !Number.isFinite(value)) {
        drawing = false;
        return;
      }
      path += (drawing ? " L " : " M ") + x(i) + " " + y(value);
      drawing = true;
    });
    return path;
  };

  const latestIndicatorValue = (values: (number | null)[]) => {
    for (let i = values.length - 1; i >= 0; i--) {
      if (values[i] != null && Number.isFinite(values[i])) return values[i] as number;
    }
    return null;
  };

  const toggleIndicator = (name: string) => {
    setIndicators((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const levelLine = (
    value: number,
    label: string,
    className: string,
    key: string,
  ) => {
    if(value<min||value>max)return null;
    return (
    <g key={key}>
      <line
        x1={left}
        x2={left + plotWidth}
        y1={y(value)}
        y2={y(value)}
        className={className}
      />
      <text
        x={left + plotWidth - 4}
        y={y(value) - 5}
        textAnchor="end"
        className={styles.levelText}
      >
        {label} {format(value)}
      </text>
    </g>
  );};

  return (
    <div className={styles.wrap} id="chart-coach">
      <div className={styles.toolbar}>
        <div className={styles.group}>
          {(["candles", "heikin", "ohlc"] as const).map((chartStyle) => (
            <Button
              key={chartStyle}
              size="sm"
              variant={style === chartStyle ? "secondary" : "ghost"}
              onClick={() => {
                setStyle(chartStyle);
                setLesson(chartStyle === "heikin" ? "heikin" : "candles");
              }}
              disabled={all.length === 0}
            >
              {chartStyle === "candles"
                ? "Candles"
                : chartStyle === "heikin"
                  ? "Heikin-Ashi"
                  : "OHLC bars"}
            </Button>
          ))}
        </div>
        <span className={styles.source}>
          {dataSource === "webull-paper" ? "WEBULL • "+sourceAll.length.toLocaleString()+" BARS" : "DATA UNAVAILABLE"}
        </span>
      </div>

      {teachingMode&&<div className={styles.replayBar}>
        <div>
          <strong>{replayMode?"CUE REPLAY ACTIVE":"CUE REPLAY"}</strong>
          <span>{replayMode?"Future candles are hidden. Structure and indicators use only revealed bars.":"Practice chart reading without seeing what happens next."}</span>
        </div>
        {!replayMode?<Button size="sm" variant="outline" disabled={sourceAll.length<20} onClick={()=>{
          setReplayMode(true);
          setReplayCutoff(Math.max(12,Math.floor(sourceAll.length*.6)));
          setOffset(0);setSelected(null);
        }}>Start replay</Button>:<div className={styles.group}>
          <Button size="sm" variant="ghost" disabled={(replayCutoff??0)<=12} onClick={()=>setReplayCutoff(value=>Math.max(12,(value??12)-1))}>← 1</Button>
          <Button size="sm" variant="secondary" disabled={(replayCutoff??0)>=sourceAll.length} onClick={()=>setReplayCutoff(value=>Math.min(sourceAll.length,(value??12)+1))}>Reveal candle →</Button>
          <Button size="sm" variant="ghost" disabled={(replayCutoff??0)>=sourceAll.length} onClick={()=>setReplayCutoff(value=>Math.min(sourceAll.length,(value??12)+5))}>+5</Button>
          <Button size="sm" variant="outline" onClick={()=>{setReplayMode(false);setReplayCutoff(null);setOffset(0);setSelected(null);}}>Exit replay</Button>
        </div>}
      </div>}

      <div className={styles.toolbar}>
        <div className={styles.group}>
          <Button
            size="sm"
            variant="outline"
            onClick={() => zoom(0.7)}
            disabled={all.length === 0 || count <= 12}
          >
            Zoom +
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => zoom(1.4)}
            disabled={all.length === 0 || count >= maxVisible}
          >
            Zoom −
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setCount(maxVisible);
              setOffset(0);
            }}
            disabled={all.length === 0}
          >
            Fit viewport
          </Button>
        </div>
        <div className={styles.group}>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setOffset(
                Math.min(maxOffset, safeOffset + Math.max(1, Math.floor(size / 3))),
              );
              setSelected(null);
            }}
            disabled={safeOffset >= maxOffset}
          >
            ← Older
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setOffset(
                Math.max(0, safeOffset - Math.max(1, Math.floor(size / 3))),
              );
              setSelected(null);
            }}
            disabled={safeOffset === 0}
          >
            Newer →
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setOffset(0);
              setSelected(null);
            }}
            disabled={all.length === 0}
          >
            Latest
          </Button>
        </div>
      </div>

      <div className={styles.zones}>
        <Button
          size="sm"
          variant={advancedOverlays ? "secondary" : "outline"}
          onClick={() => setAdvancedOverlays(!advancedOverlays)}
          disabled={all.length === 0}
        >
          {teachingMode ? "Advanced overlays" : "Indicators"} {advancedOverlays ? "on" : "off"}
        </Button>
        {teachingMode&&<Button
          size="sm"
          variant={showZones ? "secondary" : "ghost"}
          onClick={() => setShowZones(!showZones)}
          disabled={all.length === 0}
        >
          Session zones {showZones ? "on" : "off"}
        </Button>}
        {advancedOverlays && showZones &&
          chartZones.map((zone) => (
            <Button
              key={zone.key}
              size="sm"
              variant={zones.has(zone.key) ? "secondary" : "ghost"}
              title={zone.time}
              disabled={all.length === 0}
              onClick={() =>
                setZones((old) => {
                  const next = new Set(old);
                  if (next.has(zone.key)) next.delete(zone.key);
                  else next.add(zone.key);
                  return next;
                })
              }
            >
              {zone.label}
            </Button>
          ))}
        <Button
          size="sm"
          variant={showLevels ? "secondary" : "ghost"}
          onClick={() => setShowLevels(!showLevels)}
          disabled={!levels || all.length === 0}
        >
          CUE levels {showLevels ? "on" : "off"}
        </Button>
      </div>

      {(teachingMode||advancedOverlays)&&<div className={styles.indicators}>
        {teachingMode&&<span>Indicators</span>}
        {[
          "VWAP","VOLUME","EMA9","EMA20","EMA50","EMA200",
          "SMA50","SMA200","BOLL","RSI","MACD","ATR",
        ].filter((name)=>advancedOverlays||["VWAP","VOLUME","EMA9","EMA20"].includes(name)).map((name) => (
          <Button
            key={name}
            size="sm"
            variant={indicators.has(name) ? "secondary" : "ghost"}
            disabled={all.length === 0}
            onClick={() => toggleIndicator(name)}
          >
            {name === "BOLL" ? "Bollinger" : name}
          </Button>
        ))}
      </div>}

      {teachingMode&&all.length>0&&<div className={styles.smartStrip}>
        <span><b>STRUCTURE</b><strong>{structure.trend}</strong><small>{structure.pattern}</small></span>
        <span><b>SMART SUPPORT</b><strong>{structure.support?format(structure.support.price):"—"}</strong><small>{structure.support?structure.support.strength+"/100 · "+structure.support.touches+" touches":"Not confirmed"}</small></span>
        <span><b>SMART RESISTANCE</b><strong>{structure.resistance?format(structure.resistance.price):"—"}</strong><small>{structure.resistance?structure.resistance.strength+"/100 · "+structure.resistance.touches+" touches":"Not confirmed"}</small></span>
        <span><b>LATEST STRUCTURE</b><strong>{structure.latestEvent?structure.latestEvent.kind.replaceAll("_"," "):"WAIT"}</strong><small>{structure.latestEvent?"Rule-detected from confirmed candles":"No structural trigger"}</small></span>
      </div>}
      {replayMode&&<div className={styles.replayStatus}>
        <span><b>REVEALED</b>{all.length}/{sourceAll.length} candles</span>
        <span><b>CUE READ</b>{structure.summary}</span>
        <span><b>RULE</b>Make your decision before revealing the next candle.</span>
      </div>}

      {teachingMode && haCandle && (
        <div className={styles.liveLesson}>
          <span><b>LIVE CANDLE</b>{haConviction}</span>
          <span><b>BODY</b>{haBodyRead}</span>
          <span><b>WICKS</b>{haWickRead}</span>
          <span><b>RULE</b>{haIndecision ? "Pause—wait for confirmation" : haBullish ? "Buyers have control; still require CUE confirmation" : haBearish ? "Sellers have control; avoid chasing longs" : "No clear control"}</span>
        </div>
      )}

      {raw.length === 0 ? (
        <p className={styles.empty}>
          No chart bars available. Connect Webull PaperTrade or refresh the chart.
        </p>
      ) : (
        <>
          <svg
            className={styles.svg}
            viewBox={"0 0 " + width + " " + height}
            role="img"
            aria-label={
              symbol +
              " " +
              timeframe +
              " chart. Drag to pan; use controls or arrow keys to inspect."
            }
            tabIndex={0}
            onPointerDown={(event) => {
              drag.current = { x: event.clientX, offset: safeOffset };
              event.currentTarget.setPointerCapture(event.pointerId);
              selectAt(event);
            }}
            onPointerMove={selectAt}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                event.preventDefault();
                setSelected(
                  Math.max(
                    0,
                    Math.min(
                      raw.length - 1,
                      index + (event.key === "ArrowLeft" ? -1 : 1),
                    ),
                  ),
                );
              }
            }}
          >
            <rect x={left} y={top} width={plotWidth} height={plotHeight} fill="transparent" />
            {visibleLastPrice!=null&&levelLine(visibleLastPrice,"LAST",styles.currentPriceLine,"last-price")}

            {zoneRuns.map((zone) => (
              <g key={zone.key}>
                <rect
                  x={left + zone.from * step}
                  y={top}
                  width={(zone.to - zone.from) * step}
                  height={plotHeight}
                  fill="var(--primary)"
                  opacity=".065"
                />
                {(zone.to - zone.from) * step > 65 && (
                  <text
                    x={left + zone.from * step + 3}
                    y={top + 12}
                    className={styles.zoneText}
                  >
                    {zone.label}
                  </text>
                )}
              </g>
            ))}

            {advancedOverlays && visiblePriceHigh!=null && levelLine(visiblePriceHigh,"VISIBLE HIGH",styles.extremeLine,"visible-high")}
            {advancedOverlays && visiblePriceLow!=null && levelLine(visiblePriceLow,"VISIBLE LOW",styles.extremeLine,"visible-low")}
            {advancedOverlays && coachContext && (
              <>
                {levelLine(coachContext.resistance20,"RESISTANCE",styles.resistanceLine,"resistance20")}
                {levelLine(coachContext.support20,"SUPPORT",styles.supportLine,"support20")}
              </>
            )}
            {structure.resistance && levelLine(structure.resistance.price,`R ${structure.resistance.strength}`,styles.smartResistanceLine,"smart-resistance")}
            {structure.support && levelLine(structure.support.price,`S ${structure.support.strength}`,styles.smartSupportLine,"smart-support")}
            {advancedOverlays && showZones && premarketRange && (
              <>
                {levelLine(premarketRange.high,"PRE HIGH",styles.sessionHighLine,"pre-high")}
                {levelLine(premarketRange.low,"PRE LOW",styles.sessionLowLine,"pre-low")}
              </>
            )}
            {advancedOverlays && showZones && openingRange && (
              <>
                {levelLine(openingRange.high,"OR30 HIGH",styles.openingLine,"or-high")}
                {levelLine(openingRange.low,"OR30 LOW",styles.openingLine,"or-low")}
              </>
            )}

            {showLevels && levels && (
              <>
                <rect
                  x={left+plotWidth*.72}
                  y={Math.min(y(levels.target2),y(levels.entryHigh))}
                  width={plotWidth*.26}
                  height={Math.max(2,Math.abs(y(levels.entryHigh)-y(levels.target2)))}
                  className={styles.rewardBox}
                />
                <rect
                  x={left+plotWidth*.72}
                  y={Math.min(y(levels.entryLow),y(levels.stop))}
                  width={plotWidth*.26}
                  height={Math.max(2,Math.abs(y(levels.stop)-y(levels.entryLow)))}
                  className={styles.riskBox}
                />
                <text x={left+plotWidth*.975} y={y(levels.target2)+14} textAnchor="end" className={styles.rewardText}>2R TARGET</text>
                <text x={left+plotWidth*.975} y={y(levels.stop)-7} textAnchor="end" className={styles.riskText}>STOP</text>
                <rect
                  x={left}
                  y={Math.min(y(levels.entryHigh), y(levels.entryLow))}
                  width={plotWidth}
                  height={Math.max(2, Math.abs(y(levels.entryLow) - y(levels.entryHigh)))}
                  className={styles.entryBand}
                />
                {levelLine(levels.stop, "STOP", styles.stopLine, "stop")}
                {levelLine(levels.target1, "TP1", styles.targetLine, "tp1")}
                {levelLine(levels.target2, "TP2", styles.targetLine, "tp2")}
                {levelLine(levels.target3, "TP3", styles.targetLine, "tp3")}
                <text
                  x={left + 6}
                  y={Math.min(y(levels.entryHigh), y(levels.entryLow)) - 6}
                  className={styles.entryText}
                >
                  ENTRY {format(levels.entryLow)}–{format(levels.entryHigh)}
                </text>
              </>
            )}

            {Array.from({ length: 5 }, (_, i) => {
              const price = min + ((max - min) * i) / 4;
              return (
                <g key={i}>
                  <line
                    x1={left}
                    x2={left + plotWidth}
                    y1={y(price)}
                    y2={y(price)}
                    stroke="var(--border)"
                    strokeDasharray="3 6"
                  />
                  <text
                    x={left + plotWidth + 9}
                    y={y(price) + 4}
                    className={styles.axis}
                  >
                    {format(price)}
                  </text>
                </g>
              );
            })}

            {indicators.has("VWAP") && vwap !== null && (
              <g>
                <line
                  x1={left}
                  x2={left + plotWidth}
                  y1={y(vwap)}
                  y2={y(vwap)}
                  stroke="var(--warning)"
                  strokeDasharray="6 4"
                />
                <text x={left + 5} y={y(vwap) - 5} className={styles.vwapText}>
                  Visible-range VWAP {format(vwap)}
                </text>
              </g>
            )}

            {indicators.has("EMA9") && <path d={linePath(visibleSeries.ema9)} className={styles.ema9}/>}
            {indicators.has("EMA20") && <path d={linePath(visibleSeries.ema20)} className={styles.ema20}/>}
            {indicators.has("EMA50") && <path d={linePath(visibleSeries.ema50)} className={styles.ema50}/>}
            {indicators.has("EMA200") && <path d={linePath(visibleSeries.ema200)} className={styles.ema200}/>}
            {indicators.has("SMA50") && <path d={linePath(visibleSeries.sma50)} className={styles.sma50}/>}
            {indicators.has("SMA200") && <path d={linePath(visibleSeries.sma200)} className={styles.sma200}/>}
            {indicators.has("BOLL") && (
              <>
                <path d={linePath(visibleSeries.bollUpper)} className={styles.bollinger}/>
                <path d={linePath(visibleSeries.bollLower)} className={styles.bollinger}/>
              </>
            )}

            {rendered.map((item, i) => {
              const color =
                item.close >= item.open ? "var(--success)" : "var(--error)";
              return (
                <g key={i}>
                  <title>
                    {formatTime(raw[i].time) +
                      " · O " +
                      format(raw[i].open) +
                      " H " +
                      format(raw[i].high) +
                      " L " +
                      format(raw[i].low) +
                      " C " +
                      format(raw[i].close)}
                  </title>
                  <line
                    x1={x(i)}
                    x2={x(i)}
                    y1={y(item.high)}
                    y2={y(item.low)}
                    stroke={color}
                    strokeWidth="1.3"
                  />
                  {style === "ohlc" ? (
                    <path
                      d={
                        "M" +
                        (x(i) - bodyWidth / 2) +
                        "," +
                        y(item.open) +
                        "H" +
                        x(i) +
                        "M" +
                        x(i) +
                        "," +
                        y(item.close) +
                        "H" +
                        (x(i) + bodyWidth / 2)
                      }
                      stroke={color}
                      strokeWidth="2"
                      fill="none"
                    />
                  ) : (
                    <rect
                      x={x(i) - bodyWidth / 2}
                      y={Math.min(y(item.open), y(item.close))}
                      width={bodyWidth}
                      height={Math.max(1, Math.abs(y(item.open) - y(item.close)))}
                      fill={color}
                    />
                  )}
                  {indicators.has("VOLUME") && (
                    <rect
                      x={x(i) - bodyWidth / 2}
                      y={
                        height -
                        bottom -
                        ((raw[i].volume || 0) / maxVolume) * 35
                      }
                      width={bodyWidth}
                      height={((raw[i].volume || 0) / maxVolume) * 35}
                      fill={color}
                      opacity=".5"
                    />
                  )}
                </g>
              );
            })}

            {structure.events.filter(event=>event.index>=start&&event.index<start+size).slice(advancedOverlays?-12:-5).map((event,eventIndex)=>{
              const localIndex=event.index-start;
              const bullish=event.kind==="BOS_UP"||event.kind==="SWEEP_LOW"||event.kind==="FVG_BULL";
              const short=event.kind==="BOS_UP"?"BOS↑":event.kind==="BOS_DOWN"?"BOS↓":event.kind==="SWEEP_HIGH"?"SWEEP H":event.kind==="SWEEP_LOW"?"SWEEP L":event.kind==="FVG_BULL"?"FVG↑":"FVG↓";
              return <g key={event.kind+"-"+event.index+"-"+eventIndex}>
                <circle cx={x(localIndex)} cy={y(event.price)} r="6" className={bullish?styles.structureBull:styles.structureBear}/>
                <text x={x(localIndex)} y={y(event.price)-8} textAnchor="middle" className={styles.structureText}>{short}</text>
              </g>;
            })}

            {candle && (
              <line
                x1={x(index)}
                x2={x(index)}
                y1={top}
                y2={height - bottom}
                stroke="var(--muted-foreground)"
                strokeDasharray="3 4"
              />
            )}

            {signalLabel && (
              <g>
                <rect
                  x={left + 8}
                  y={top + 22}
                  width={92}
                  height={28}
                  rx={5}
                  className={
                    signalLabel === "BUY" || signalLabel === "HOLD"
                      ? styles.signalPositive
                      : signalLabel === "SELL" || signalLabel === "AVOID"
                        ? styles.signalNegative
                        : styles.signalWait
                  }
                />
                <text
                  x={left + 54}
                  y={top + 41}
                  textAnchor="middle"
                  className={styles.signalText}
                >
                  CUE {signalLabel}
                </text>
              </g>
            )}

            <text x={left} y={height - 15} className={styles.axis}>
              {formatTime(raw[0].time)}
            </text>
            <text
              x={left + plotWidth}
              y={height - 15}
 
... (output capped at 40000 chars — re-read with offset/limit)