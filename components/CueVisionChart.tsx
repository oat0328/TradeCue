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
  const [style, setStyle] = useState<"candles" | "heikin" | "ohlc">("heikin");
  const [count, setCount] = useState(90);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [lesson, setLesson] = useState<keyof typeof lessons>("candles");
  const [showZones, setShowZones] = useState(true);
  const [showLevels, setShowLevels] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [indicators, setIndicators] = useState(
    () => new Set(["VWAP", "VOLUME", "EMA9", "EMA20", "BOLL", "RSI"]),
  );
  const [zones, setZones] = useState(() => new Set(chartZones.map((zone) => zone.key)));
  const drag = useRef<{ x: number; offset: number } | null>(null);

  useEffect(() => {
    setOffset(0);
    setSelected(null);
  }, [symbol, timeframe]);

  useEffect(() => {
    if (!expanded) return;
    const onKey=(event:KeyboardEvent)=>{ if(event.key==="Escape") setExpanded(false); };
    document.body.style.overflow="hidden";
    window.addEventListener("keydown",onKey);
    return ()=>{ document.body.style.overflow=""; window.removeEventListener("keydown",onKey); };
  }, [expanded]);

  const all = useMemo(
    () =>
      dataSource === "webull-paper"
        ? (bars || []).filter((candle) =>
            [candle.open, candle.high, candle.low, candle.close].every(Number.isFinite),
          )
        : [],
    [bars, dataSource],
  );

  const size = Math.min(count, all.length);
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

  const etDayKey = (value:string) => new Intl.DateTimeFormat("en-CA", {
    timeZone:"America/New_York", year:"numeric", month:"2-digit", day:"2-digit",
  }).format(new Date(value));
  const latestBar = all[all.length-1];
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

  const width = 1400;
  const height = 780;
  const left = 22;
  const right = 126;
  const top = 32;
  const bottom = 82;
  const plotHeight = 600;
  const plotWidth = width - left - right;

  const referenceValues = [
    coachContext?.support20, coachContext?.resistance20,
    premarketRange?.high, premarketRange?.low,
    openingRange?.high, openingRange?.low,
  ].filter((value):value is number=>value!=null&&Number.isFinite(value));
  const levelValues =
    showLevels && levels
      ? [levels.entryLow, levels.entryHigh, levels.stop, levels.target1, levels.target2, levels.target3, ...referenceValues]
      : referenceValues;
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
  const lows = rendered.map((candle) => candle.low).concat(levelValues, indicatorPriceValues);
  const highs = rendered.map((candle) => candle.high).concat(levelValues, indicatorPriceValues);
  const rawLow = lows.length ? Math.min(...lows) : 0;
  const rawHigh = highs.length ? Math.max(...highs) : 1;
  const range = Math.max(rawHigh - rawLow, 0.01);
  const min = rawLow - range * 0.08;
  const max = rawHigh + range * 0.08;

  const y = (value: number) =>
    top + ((max - value) / Math.max(max - min, 0.000001)) * plotHeight;
  const step = plotWidth / Math.max(1, raw.length);
  const x = (i: number) => left + (i + 0.5) * step;
  const bodyWidth = Math.max(2, Math.min(16, step * 0.68));
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
      Math.max(12, Math.min(Math.max(12, all.length), Math.round(value * factor))),
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
  ) => (
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
  );

  return (
    <div className={expanded ? styles.wrap+" "+styles.expanded : styles.wrap} id="chart-coach">
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
          {dataSource === "webull-paper" ? "WEBULL SANDBOX DATA" : "DATA UNAVAILABLE"}
        </span>
      </div>

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
            disabled={all.length === 0 || count >= all.length}
          >
            Zoom −
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setCount(Math.max(12, all.length));
              setOffset(0);
            }}
            disabled={all.length === 0}
          >
            Fit all
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
          variant={showZones ? "secondary" : "ghost"}
          onClick={() => setShowZones(!showZones)}
          disabled={all.length === 0}
        >
          Session zones {showZones ? "on" : "off"}
        </Button>
        {showZones &&
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

      <div className={styles.indicators}>
        <span>Indicators</span>
        {[
          "VWAP","VOLUME","EMA9","EMA20","EMA50","EMA200",
          "SMA50","SMA200","BOLL","RSI","MACD","ATR",
        ].map((name) => (
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
      </div>

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
            onDoubleClick={()=>setExpanded(value=>!value)}
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

            {visiblePriceHigh!=null && levelLine(visiblePriceHigh,"VISIBLE HIGH",styles.extremeLine,"visible-high")}
            {visiblePriceLow!=null && levelLine(visiblePriceLow,"VISIBLE LOW",styles.extremeLine,"visible-low")}
            {coachContext && (
              <>
                {levelLine(coachContext.resistance20,"RESISTANCE",styles.resistanceLine,"resistance20")}
                {levelLine(coachContext.support20,"SUPPORT",styles.supportLine,"support20")}
              </>
            )}
            {showZones && premarketRange && (
              <>
                {levelLine(premarketRange.high,"PRE HIGH",styles.sessionHighLine,"pre-high")}
                {levelLine(premarketRange.low,"PRE LOW",styles.sessionLowLine,"pre-low")}
              </>
            )}
            {showZones && openingRange && (
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
              textAnchor="end"
              className={styles.axis}
            >
              {formatTime(raw[raw.length - 1].time)}
            </text>
          </svg>

          <div className={styles.inspect} aria-live="polite">
            <strong>{formatTime(candle?.time)}</strong>
            <span>Open {format(candle?.open)}</span>
            <span>High {format(candle?.high)}</span>
            <span>Low {format(candle?.low)}</span>
            <span>Close {format(candle?.close)}</span>
            <span>Volume {(candle?.volume || 0).toLocaleString()}</span>
          </div>
          <div className={styles.indicatorReadouts}>
            {indicators.has("RSI") && <span>RSI(14) <strong>{format(latestIndicatorValue(visibleSeries.rsi14) ?? undefined)}</strong></span>}
            {indicators.has("MACD") && <span>MACD <strong>{format(latestIndicatorValue(visibleSeries.macd) ?? undefined)}</strong> / Signal <strong>{format(latestIndicatorValue(visibleSeries.macdSignal) ?? undefined)}</strong></span>}
            {indicators.has("ATR") && <span>ATR(14) <strong>{format(latestIndicatorValue(visibleSeries.atr14) ?? undefined)}</strong></span>}
          </div>
          <p className={styles.hint}>
            {raw.length} of {all.length} candles · Drag to pan. Point at a candle
            or use arrow keys to inspect. Latest loaded bar:{" "}
            {formatTime(all[all.length - 1]?.time)}.{" "}
            {style === "heikin" ? "Heikin-Ashi prices are synthetic." : ""}
          </p>
        </>
      )}

      <section className={styles.coach}>
        <div className={styles.coachHead}>
          <div>
            <small>PROFESSOR CUE • {teachingMode ? "TEACHING MODE" : "PRO MODE"} • CURRENT WEBULL CHART</small>
            <h3>{symbol} · {timeframe} · {signalLabel ?? "DATA CHECK"}</h3>
          </div>
          <span>{coachContext?.fresh ? "Fresh bars" : "Market/data not fresh"}</span>
        </div>

        <div className={styles.chartReadStrip}>
          <span><b>Heikin read</b><strong>{haConviction}</strong></span>
          <span><b>Body</b><strong>{haBodyRead}</strong></span>
          <span><b>Wicks</b><strong>{haWickRead}</strong></span>
          <span><b>Support</b><strong>{format(coachContext?.support20)}</strong></span>
          <span><b>Resistance</b><strong>{format(coachContext?.resistance20)}</strong></span>
          <span><b>Pre H/L</b><strong>{premarketRange ? format(premarketRange.high)+" / "+format(premarketRange.low) : "—"}</strong></span>
        </div>

        {coachContext ? (
          <>
            <div className={styles.coachChecks}>
              {[
                ["Trend", coachContext.componentScores.trend, coachContext.componentScores.trend >= 65],
                ["Momentum", coachContext.componentScores.momentum, coachContext.componentScores.momentum >= 60],
                ["Volume", coachContext.componentScores.volume, coachContext.componentScores.volume >= 50],
                ["Setup", coachContext.componentScores.setup, coachContext.componentScores.setup >= 65],
                ["Data", coachContext.fresh ? 100 : 0, coachContext.fresh],
              ].map(([label,value,pass]) => (
                <span key={String(label)} className={pass ? styles.coachPass : styles.coachFail}>
                  <b>{String(label)}</b>
                  <strong>{label === "Data" ? (pass ? "LIVE" : "STALE") : String(value)+"/100"}</strong>
                </span>
              ))}
            </div>

            <p className={styles.currentRead}>
              <strong>What TradeCUE sees:</strong>{" "}
              Price {format(candle?.close)} · EMA9 {format(coachContext.ema9)} · EMA20 {format(coachContext.ema20)} · RSI {coachContext.rsi14.toFixed(1)} · RVOL {coachContext.relativeVolume.toFixed(2)}× · ATR {coachContext.atrPercent.toFixed(2)}%.
            </p>

            <p className={styles.actionRead}>
              <strong>{signalLabel === "BUY" ? "BUY CHECK:" : signalLabel === "SELL" ? "EXIT CHECK:" : signalLabel === "AVOID" ? "STAY AWAY:" : signalLabel === "HOLD" ? "HOLD CHECK:" : "WAIT CHECK:"}</strong>{" "}
              {signalLabel === "BUY"
                ? "Fresh data and the core technical checks are aligned. Use the plotted entry zone, stop and target—not the Heikin-Ashi synthetic price—as the paper-trade plan."
                : signalLabel === "SELL"
                  ? "The open position has weakened into TradeCUE's exit-review conditions. Compare current price with the plotted stop and support before acting."
                  : signalLabel === "AVOID"
                    ? "Stay away for now. Trend or setup conditions are weak enough that TradeCUE does not want a new long entry."
                    : signalLabel === "HOLD"
                      ? "The setup is still constructive. Watch support, the stop line and whether Heikin-Ashi momentum starts losing body size."
                      : "No entry yet. The chart is missing confirmation, the data is stale, or one of the core checks is below threshold. Wait for the failed checks to improve instead of chasing."}
            </p>
          </>
        ) : (
          <p className={styles.currentRead}><strong>Data check:</strong> TradeCUE needs a valid CUE calculation before Professor Cue can grade this chart.</p>
        )}

        {teachingMode && (
          <>
            <div className={styles.candleTutor}>
              <div><b>GREEN BODY</b><span>Close above open. Buyers controlled that interval, but one green candle is not enough to enter.</span></div>
              <div><b>RED BODY</b><span>Close below open. Sellers controlled that interval. Watch whether support holds before assuming continuation.</span></div>
              <div><b>MISSING WICK</b><span>A Heikin-Ashi candle with little opposite wick can show strong directional control; still confirm with real Webull price and CUE checks.</span></div>
              <div><b>SMALL BODY + 2 WICKS</b><span>Indecision. Treat it as a pause/reversal watch and wait for the next confirmed move.</span></div>
            </div>

            <details className={styles.learnDetails}>
              <summary>Professor Cue chart lessons</summary>
              <div className={styles.group}>
                {(Object.keys(lessons) as Array<keyof typeof lessons>).map(key=>(
                  <Button key={key} size="sm" variant={lesson===key?"secondary":"ghost"} onClick={()=>setLesson(key)}>
                    {lessons[key].title}
                  </Button>
                ))}
              </div>
              <h4>{lessons[lesson].title}</h4>
              <p className={styles.reading}>{lessons[lesson].text}</p>
            </details>
          </>
        )}
      </section>
    </div>
  );
}
