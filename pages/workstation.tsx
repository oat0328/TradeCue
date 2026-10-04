import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  BriefcaseBusiness,
  CandlestickChart,
  Clock3,
  Gauge,
  LayoutDashboard,
  Link2,
  LockKeyhole,
  LogOut,
  Newspaper,
  Radar,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from "lucide-react";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/Tabs";
import CueVisionChart from "../components/CueVisionChart";
import { WebullPanel } from "../components/WebullPanel";
import { PaperOrderPanel } from "../components/PaperOrderPanel";
import { TradePlanner } from "../components/TradePlanner";
import { WatchlistPanel } from "../components/WatchlistPanel";
import { OpportunityCommandStrip } from "../components/OpportunityCommandStrip";
import { MarketPulsePanel } from "../components/MarketPulsePanel";
import { PositionMonitorPanel } from "../components/PositionMonitorPanel";
import { CueCheatSheet } from "../components/CueCheatSheet";
import { useAuth } from "../helpers/useAuth";
import { useEntitlements } from "../helpers/useEntitlements";
import { useFundamentalBrief } from "../helpers/useFundamentalBrief";
import { useWebullAccount } from "../helpers/useWebullAccount";
import { useMarketIntelligence } from "../helpers/useMarketIntelligence";
import { useWebullFundamentals } from "../helpers/useWebullFundamentals";
import { useWatchlist } from "../helpers/useWatchlist";
import { calculateCueSignal } from "../helpers/cueSignal";
import { buildTradeDecision } from "../helpers/tradeDecision";
import styles from "./workstation.module.css";

const plans = {
  scout: { name: "Scout Workstation", price: "$39" },
  copilot: { name: "Copilot Command Center", price: "$129" },
  autopilot: { name: "Autopilot Pro Desk", price: "$249" },
} as const;

const timeframes = ["1m","3m","5m","15m","30m","1H","4H","1D","1W"] as const;

function money(value: string | null | undefined) {
  if (value == null || value === "" || !Number.isFinite(Number(value))) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value));
}

function formatPrice(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: value >= 100 ? 2 : 4,
  }).format(value);
}

function compactMoney(value:number|null|undefined){
  if(value==null||!Number.isFinite(value))return "—";
  return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",notation:"compact",maximumFractionDigits:1}).format(value);
}

function metricPercent(value:number|null|undefined){
  return value==null||!Number.isFinite(value)?"—":(value*100).toFixed(1)+"%";
}

function percentChange(current?: number, previous?: number) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || !previous) return null;
  return ((current! - previous!) / previous!) * 100;
}

function marketSession(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type:string) => parts.find(part => part.type === type)?.value ?? "";
  const weekday = get("weekday");
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));
  const total = hour * 60 + minute;
  const weekend = weekday === "Sat" || weekday === "Sun";
  if (weekday === "Sun" && total >= 20 * 60) return {label:"OVERNIGHT", detail:"Eligible Webull 24/5 symbols", active:true};
  if (weekend) return {label:"WEEKEND PREP", detail:"Stocks closed · build Monday watchlist", active:false};
  if (weekday === "Fri" && total >= 20 * 60) return {label:"WEEKEND PREP", detail:"Stocks closed · build Monday watchlist", active:false};
  if (total < 4 * 60) return {label:"OVERNIGHT", detail:"Eligible Webull 24/5 symbols", active:true};
  if (total < 9 * 60 + 30) return {label:"PREMARKET", detail:"4:00–9:30 AM ET", active:true};
  if (total < 16 * 60) return {label:"MARKET OPEN", detail:"Regular session", active:true};
  if (total < 20 * 60) return {label:"AFTER HOURS", detail:"4:00–8:00 PM ET", active:true};
  return {label:"OVERNIGHT", detail:"Eligible Webull 24/5 symbols", active:true};
}

function ptClock(date:Date){
  return {
    date:new Intl.DateTimeFormat("en-US",{timeZone:"America/Los_Angeles",weekday:"short",month:"short",day:"numeric"}).format(date),
    time:new Intl.DateTimeFormat("en-US",{timeZone:"America/Los_Angeles",hour:"numeric",minute:"2-digit",second:"2-digit"}).format(date)+" PT",
  };
}

function cutoffCountdown(date:Date,cutoff="12:30"){
  const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/Los_Angeles",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).formatToParts(date);
  const get=(type:string)=>Number(parts.find(part=>part.type===type)?.value??0);
  const current=get("hour")*3600+get("minute")*60+get("second");
  const [h,m]=cutoff.split(":").map(Number);
  const target=h*3600+m*60;
  const remaining=Math.max(0,target-current);
  const hh=Math.floor(remaining/3600);
  const mm=Math.floor((remaining%3600)/60);
  const ss=remaining%60;
  return {seconds:remaining,label:String(hh).padStart(2,"0")+"h "+String(mm).padStart(2,"0")+"m "+String(ss).padStart(2,"0")+"s"};
}

export default function WorkstationPage() {
  const { authState, logout } = useAuth();
  const isMember = authState.type === "authenticated";
  const isOwner = isMember && authState.user.role === "admin";
  const entitlements = useEntitlements(isMember);

  const [symbol, setSymbol] = useState("NVDA");
  const [symbolDraft, setSymbolDraft] = useState("NVDA");
  const [timeframe, setTimeframe] = useState<(typeof timeframes)[number]>("5m");
  const [accountId, setAccountId] = useState<string>();
  const [deskMode, setDeskMode] = useState<"teach"|"pro">("teach");
  const [clockNow,setClockNow]=useState(()=>new Date());

  const webull = useWebullAccount(isMember, symbol, timeframe, accountId);
  const watchlist = useWatchlist(isMember);
  const intelligence = useMarketIntelligence(Boolean(isMember && webull.account.data), symbol);
  const webullFundamentals = useWebullFundamentals(Boolean(isMember && webull.account.data), symbol);
  const fundamental = useFundamentalBrief(symbol, isMember);

  const tier = entitlements.data?.membership.tier ?? "copilot";
  const plan = plans[tier];
  const bars = webull.bars.data?.bars ?? [];
  const latest = bars[bars.length - 1];
  const previous = bars[bars.length - 2];
  const change = percentChange(latest?.close, previous?.close);
  const chartReady = bars.length > 0;
  const cueSignal = useMemo(() => calculateCueSignal(bars), [bars]);
  const freshnessMinutes: Record<(typeof timeframes)[number], number> = {
    "1m": 10,
    "3m": 15,
    "5m": 20,
    "15m": 45,
    "30m": 90,
    "1H": 180,
    "4H": 720,
    "1D": 4320,
    "1W": 14400,
  };
  const latestAgeMinutes =
    latest?.time && Number.isFinite(Date.parse(latest.time))
      ? Math.max(0, (Date.now() - Date.parse(latest.time)) / 60000)
      : null;
  const dataFresh =
    latestAgeMinutes != null && latestAgeMinutes <= freshnessMinutes[timeframe];

  const risk = entitlements.data?.risk;
  const session = marketSession(clockNow);
  const account = webull.account.data;
  const pt = ptClock(clockNow);
  const exitClock = cutoffCountdown(clockNow,risk?.dayTradeFlatTimePt ?? "12:30");
  const dayPnlNumber=Number(account?.balance.dayPnl ?? 0);
  const maxDailyLoss=Number(risk?.maxDailyLoss ?? 0);
  const dailyRiskUsed=Math.max(0,-Math.min(0,Number.isFinite(dayPnlNumber)?dayPnlNumber:0));
  const dailyRiskPercent=maxDailyLoss>0?Math.min(100,Math.round(dailyRiskUsed/maxDailyLoss*100)):0;
  const signedOut = authState.type === "unauthenticated";
  const position = account?.positions.find(
    (item) => item.symbol.toUpperCase() === symbol.toUpperCase() && Number(item.quantity ?? 0) > 0,
  );
  const displayedCue = cueSignal.available
    ? !dataFresh && !["1D", "1W"].includes(timeframe)
      ? "WAIT"
      : position
        ? (cueSignal.state === "AVOID" || intelligence.data?.action === "AVOID") ? "SELL" : "HOLD"
        : (cueSignal.state === "AVOID" || intelligence.data?.action === "AVOID")
          ? "AVOID"
          : cueSignal.state === "BUY" && (intelligence.data ? intelligence.data.action === "ENTRY_READY" : true)
            ? "BUY"
            : "WAIT"
    : null;
  const cueBadgeVariant = displayedCue === "BUY" || displayedCue === "HOLD"
    ? "success"
    : displayedCue === "SELL" || displayedCue === "AVOID"
      ? "error"
      : "warning";
  const actionHeadline = displayedCue === "BUY"
    ? "ENTRY READY"
    : displayedCue === "SELL"
      ? "EXIT REVIEW"
      : displayedCue === "HOLD"
        ? "HOLD"
        : displayedCue === "AVOID"
          ? "STAY AWAY"
          : displayedCue === "WAIT"
            ? "WAIT"
            : "DATA REQUIRED";
  const actionClass = displayedCue === "BUY"
    ? styles.actionBuy
    : displayedCue === "SELL"
      ? styles.actionSell
      : displayedCue === "HOLD"
        ? styles.actionHold
        : displayedCue === "AVOID"
          ? styles.actionSell
          : styles.actionWait;

  const tradeDecision=buildTradeDecision({
    signal:cueSignal,
    intelligenceAction:intelligence.data?.action ?? null,
    currentPrice:latest?.close,
    fresh:dataFresh,
    hasPosition:Boolean(position),
    marketActive:session.active,
    marketLabel:session.label,
  });

  const decisionActionClass=["ENTER_NOW","HOLD","TAKE_PARTIAL","TAKE_PROFIT"].includes(tradeDecision.state)
    ? styles.actionBuy
    : ["EXIT_NOW","EXIT_REVIEW","STAY_AWAY"].includes(tradeDecision.state)
      ? styles.actionSell
      : styles.actionWait;

  const sizing=useMemo(()=>{
    if(!cueSignal.available||!cueSignal.plan)return null;
    const entry=(cueSignal.plan.entryLow+cueSignal.plan.entryHigh)/2;
    const stop=cueSignal.plan.stop;
    const perShareRisk=Math.max(0,entry-stop);
    const maxRisk=Number(risk?.maxRiskPerTrade);
    const cash=Number(account?.balance.buyingPower);
    if(!Number.isFinite(entry)||entry<=0||perShareRisk<=0)return null;
    const riskQty=Number.isFinite(maxRisk)&&maxRisk>0?Math.floor(maxRisk/perShareRisk):0;
    const cashQty=Number.isFinite(cash)&&cash>0?Math.floor(cash/entry):0;
    const shares=Math.max(0,Math.min(riskQty||cashQty,cashQty||riskQty));
    const plannedLoss=shares*perShareRisk;
    const potentialTp1=shares*Math.max(0,cueSignal.plan.target1-entry);
    const potentialTp2=shares*Math.max(0,cueSignal.plan.target2-entry);
    return {entry,stop,shares,plannedLoss,potentialTp1,potentialTp2,maxRisk,cash};
  },[cueSignal,risk?.maxRiskPerTrade,account?.balance.buyingPower]);

  useEffect(() => {
    if (webull.account.data?.selectedAccountId && !accountId) {
      setAccountId(webull.account.data.selectedAccountId);
    }
  }, [webull.account.data?.selectedAccountId, accountId]);

  useEffect(()=>{
    const timer=window.setInterval(()=>setClockNow(new Date()),1000);
    return ()=>window.clearInterval(timer);
  },[]);

  const submitSymbol = (event: React.FormEvent) => {
    event.preventDefault();
    const next = symbolDraft.trim().toUpperCase();
    if (/^[A-Z0-9.-]{1,15}$/.test(next)) setSymbol(next);
  };

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const latestBarLabel = latest?.time && Number.isFinite(Date.parse(latest.time))
    ? new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(latest.time)) + " ET"
    : "—";

  const delayMinutes = webull.bars.data?.delayMinutes;
  const dataBadge = webull.bars.isFetching
    ? <Badge variant="outline">SYNCING WEBULL</Badge>
    : chartReady && !session.active
      ? <Badge variant="warning">{session.label}</Badge>
      : chartReady && delayMinutes != null && delayMinutes > 0
        ? <Badge variant="warning">WEBULL • DELAYED {delayMinutes} MIN</Badge>
        : chartReady
          ? <Badge variant="success">WEBULL SANDBOX • AUTO REFRESH</Badge>
          : <Badge variant="warning">CONNECTION REQUIRED</Badge>;

  const watchingCurrent=Boolean(watchlist.list.data?.items.some(item=>item.symbol.toUpperCase()===symbol.toUpperCase()));

  const latestEarnings = fundamental.data?.earnings?.[0];
  const epsRead = latestEarnings?.epsActual != null && latestEarnings?.epsEstimated != null
    ? latestEarnings.epsActual >= latestEarnings.epsEstimated ? "Beat" : "Miss"
    : "Unavailable";
  const revenueRead = latestEarnings?.revenueActual != null && latestEarnings?.revenueEstimated != null
    ? latestEarnings.revenueActual >= latestEarnings.revenueEstimated ? "Beat" : "Miss"
    : "Unavailable";

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link to="/" className={styles.brand}>
          <span className={styles.logoMark}>///</span>
          <span>Trade<strong>CUE</strong></span>
          <small>AI TRADING COPILOT</small>
        </Link>

        <div className={styles.marketHeader}>
          <div className={session.active?styles.marketOpen:styles.marketClosed}><span/>{session.label}</div>
          <div className={styles.clockBlock}><small>{pt.date}</small><strong>{pt.time}</strong></div>
          <div className={styles.exitTimer}>
            <Clock3 size={18}/>
            <div><small>Exit by {risk?.dayTradeFlatTimePt ?? "12:30"} PM PT</small><strong>{exitClock.seconds>0?exitClock.label:"CUT-OFF REACHED"}</strong></div>
          </div>
          <div className={styles.dailyRisk}>
            <div><small>Daily Risk</small><strong>{money(String(dailyRiskUsed))} / {money(String(maxDailyLoss || 0))}</strong></div>
            <div className={styles.riskTrack}><span style={{width:dailyRiskPercent+"%"}}/></div>
            <em>{dailyRiskPercent}%</em>
          </div>
        </div>

        <div className={styles.topActions}>
          <div className={styles.accountMini}>
            <small>Buying Power</small><strong>{money(account?.balance.buyingPower)}</strong>
          </div>
          <Link to="/membership" className={styles.membershipLink}>{plan.name}</Link>
          {isMember && (
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await logout();
                window.location.assign("/login");
              }}
            >
              <LogOut size={15} />
            </Button>
          )}
        </div>
      </header>

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <nav>
            <button onClick={() => scrollTo("command-center")} className={styles.activeNav}><LayoutDashboard size={17} /><span>Command Center</span></button>
            <button onClick={() => scrollTo("hunter")}><Radar size={17} /><span>Money Hunter</span></button>
            <button onClick={() => scrollTo("watchlist")}><WalletCards size={17} /><span>Watchlists</span></button>
            <button onClick={() => scrollTo("position-monitor")}><Gauge size={17} /><span>Portfolio</span></button>
            <button onClick={() => scrollTo("vision")}><CandlestickChart size={17} /><span>Cue Vision</span></button>
            <button onClick={() => scrollTo("fundamentals")}><Newspaper size={17} /><span>Fundamental Intelligence</span></button>
            <button onClick={() => scrollTo("portfolio")}><WalletCards size={17} /><span>Portfolio & Webull</span></button>
            <button onClick={() => scrollTo("risk")}><ShieldCheck size={17} /><span>Risk Firewall</span></button>
          </nav>

          <div className={styles.trimCard}>
            <small>{isMember ? "YOUR MEMBERSHIP" : "MEMBER ACCESS"}</small>
            <strong>{isMember ? plan.name : "Sign in to use TradeCUE"}</strong>
            {isMember ? (
              <>
                <span className={styles.trimMeta}>{plan.price}/mo standard price</span>
                <Link to="/membership">Manage access →</Link>
              </>
            ) : (
              <Link to="/login?tier=copilot">Create account / log in →</Link>
            )}
          </div>

          {isOwner && <Link to="/admin" className={styles.adminLink}><BriefcaseBusiness size={15} />Owner/Admin</Link>}
        </aside>

        <main className={styles.main} id="command-center">
          <div className={styles.pageHead}>
            <div>
              <span>COMMAND CENTER</span>
              <h1>{isMember ? plan.name : "TradeCUE Market Workstation"}</h1>
              <p>Scan → understand → plan → paper trade. Every CUE shows its data source.</p>
            </div>
            <div className={styles.headControls}>
              <div className={styles.modeSwitch} aria-label="Workstation mode">
                <button className={deskMode==="teach"?styles.modeActive:undefined} onClick={()=>setDeskMode("teach")}><BookOpen size={13}/>Teach</button>
                <button className={deskMode==="pro"?styles.modeActive:undefined} onClick={()=>setDeskMode("pro")}><CandlestickChart size={13}/>Pro</button>
              </div>
              {dataBadge}
            </div>
          </div>

          {signedOut && (
            <section className={styles.connectionNotice}>
              <LockKeyhole size={20} />
              <div>
                <strong>Sign in to load brokerage data.</strong>
                <p>TradeCUE does not display fake balances, positions, live prices, or signals.</p>
              </div>
              <Button asChild><Link to="/login?tier=copilot">Sign in</Link></Button>
            </section>
          )}

          <section className={styles.statusGrid} aria-label="TradeCUE live status">
            <article>
              <small>Market</small>
              <strong className={session.active?styles.positive:styles.actionWait}>{session.label}</strong>
              <span>{session.detail}</span>
            </article>
            <article>
              <small>{symbol} price</small>
              <strong>{formatPrice(latest?.close)}</strong>
              <span className={change == null ? undefined : change >= 0 ? styles.positive : styles.negative}>
                {change == null ? latestBarLabel : (change >= 0 ? "+" : "") + change.toFixed(2) + "% · " + timeframe}
              </span>
            </article>
            <article className={styles.actionTile}>
              <small>TradeCUE now</small>
              <strong className={decisionActionClass}>{tradeDecision.headline}</strong>
              <span>{cueSignal.available ? "CUE " + cueSignal.score + " · MTF " + (intelligence.data?.alignment ?? "—") : "Waiting for Webull candles"}</span>
            </article>
            <article>
              <small>Webull feed</small>
              <strong>
                {chartReady
                  ? !session.active
                    ? "LAST CLOSE"
                    : !dataFresh && !["1D", "1W"].includes(timeframe)
                      ? "STALE"
                      : delayMinutes != null && delayMinutes > 0
                        ? "DELAYED"
                        : "LIVE"
                  : "OFFLINE"}
              </strong>
              <span>
                {chartReady
                  ? !session.active
                    ? "Last bar " + latestBarLabel
                    : delayMinutes != null && delayMinutes > 0
                      ? delayMinutes + " min delay"
                      : "Auto-refreshing"
                  : "Connect Webull PaperTrade"}
              </span>
            </article>
          </section>

          <MarketPulsePanel
            enabled={Boolean(webull.account.data)}
            onOpenSymbol={(nextSymbol) => {
              setSymbol(nextSymbol);
              setSymbolDraft(nextSymbol);
              setTimeout(() => scrollTo("vision"), 0);
            }}
          />

          {isMember && (
            <>
              <WatchlistPanel
                enabled={isMember}
                onOpenSymbol={(nextSymbol) => {
                  setSymbol(nextSymbol);
                  setSymbolDraft(nextSymbol);
                  setTimeout(() => scrollTo("vision"), 0);
                }}
              />
              <WebullPanel
                webull={webull}
                isOwner={isOwner}
                onAccount={(id) => setAccountId(id)}
                className={styles.webullPanel}
              />
              <OpportunityCommandStrip
                enabled={Boolean(webull.account.data)}
                buyingPower={Number(account?.balance.buyingPower ?? 0)}
                maxRiskPerTrade={risk?.maxRiskPerTrade}
                onOpenSymbol={(nextSymbol) => {
                  setSymbol(nextSymbol);
                  setSymbolDraft(nextSymbol);
                  setTimeout(() => scrollTo("vision"), 0);
                }}
              />
              <PositionMonitorPanel
                enabled={Boolean(webull.account.data)}
                accountId={accountId || webull.account.data?.selectedAccountId}
                onOpenSymbol={(nextSymbol) => {
                  setSymbol(nextSymbol);
                  setSymbolDraft(nextSymbol);
                  setTimeout(() => scrollTo("vision"), 0);
                }}
              />
              <PaperOrderPanel
                enabled={Boolean(webull.account.data)}
                accountId={accountId || webull.account.data?.selectedAccountId}
                symbol={symbol}
                latestPrice={latest?.close}
                positionQuantity={Number(position?.quantity ?? 0)}
                longOnly={risk?.longOnly ?? true}
                suggestedSide={displayedCue==="BUY"?"BUY":displayedCue==="SELL"?"SELL":null}
              />
            </>
          )}

          {deskMode==="pro" && <section className={styles.radar} id="radar">
            <div className={styles.sectionTitle}>
              <div><span>CUE RADAR</span><h2>Current-symbol rule engine</h2></div>
              <Badge variant={cueSignal.available ? "success" : "warning"}>
                {cueSignal.available ? "CUE INTELLIGENCE ACTIVE" : "DATA REQUIRED"}
              </Badge>
            </div>
            {cueSignal.available ? (
              <div className={styles.currentSignalStrip}>
                <div><small>Symbol</small><strong>{symbol}</strong></div>
                <div><small>Action</small><strong className={actionClass}>{actionHeadline}</strong></div>
                <div><small>Chart score</small><strong>{cueSignal.score}/100</strong></div>
                <div><small>MTF alignment</small><strong>{intelligence.data?.alignment ?? "—"}</strong></div>
                <div><small>Composite</small><strong>{intelligence.data?.compositeScore != null ? intelligence.data.compositeScore + "/100" : "—"}</strong></div>
                <div><small>SPY</small><strong>{intelligence.data?.marketChangePercent == null ? "—" : (intelligence.data.marketChangePercent >= 0 ? "+" : "") + intelligence.data.marketChangePercent.toFixed(2) + "%"}</strong></div>
              </div>
            ) : (
              <div className={styles.unavailablePanel}>
                <Radar size={22} />
                <div>
                  <strong>No fabricated opportunities or scores.</strong>
                  <p>{"reason" in cueSignal ? cueSignal.reason : "Signal inputs are unavailable."} Cue Hunter scans the broader Webull market; this section evaluates the symbol currently loaded in Cue Vision.</p>
                </div>
              </div>
            )}
          </section>}

          <section className={styles.workGrid} id="vision">
            <div className={styles.visionCard}>
              <div className={styles.visionHead}>
                <div>
                  <small>CUE VISION • REAL MARKET DATA WHEN CONNECTED</small>
                  <strong>{symbol} <span>{formatPrice(latest?.close)}</span></strong>
                </div>
                {dataBadge}
              </div>

              <form className={styles.symbolForm} onSubmit={submitSymbol}>
                <Input
                  aria-label="Ticker symbol"
                  value={symbolDraft}
                  onChange={(event) => setSymbolDraft(event.target.value.toUpperCase())}
                  placeholder="Ticker e.g. NVDA"
                />
                <Button type="submit">Open chart</Button>
              </form>

              <div className={styles.timeframes}>
                {timeframes.map((tf) => (
                  <button
                    key={tf}
                    className={timeframe === tf ? styles.activeTimeframe : undefined}
                    onClick={() => setTimeframe(tf)}
                  >
                    {tf}
                  </button>
                ))}
              </div>

              {webull.bars.error && <p className={styles.brokerError} role="alert">{webull.bars.error.message}</p>}

              <CueVisionChart
                symbol={symbol}
                timeframe={timeframe}
                bars={webull.bars.data?.bars}
                dataSource={chartReady ? "webull-paper" : "unavailable"}
                levels={cueSignal.available && dataFresh && ["BUY","HOLD","SELL"].includes(displayedCue ?? "") ? cueSignal.plan : null}
                signalLabel={displayedCue}
                coachContext={cueSignal.available ? {
                  score: cueSignal.score,
                  fresh: dataFresh,
                  componentScores: cueSignal.componentScores,
                  relativeVolume: cueSignal.metrics.relativeVolume,
                  rsi14: cueSignal.metrics.rsi14,
                  ema9: cueSignal.metrics.ema9,
                  ema20: cueSignal.metrics.ema20,
                  atrPercent: cueSignal.metrics.atrPercent,
                  support20: cueSignal.metrics.support20,
                  resistance20: cueSignal.metrics.resistance20,
                } : null}
                teachingMode={deskMode==="teach"}
              />
            </div>

            <div className={styles.decisionCard}>
              <div className={styles.copilotLabel}><Sparkles size={15}/><span>CUE DECISION</span><small>AI MARKET COPILOT</small></div>
              <div className={styles.decisionHead}>
                <div>
                  <small>{symbol} · {timeframe} · {session.label}</small>
                  <h2 className={decisionActionClass}>{tradeDecision.headline}</h2>
                  <span className={styles.actionSub}>{tradeDecision.instruction}</span>
                </div>
                <div className={styles.score}><span>Score</span>{cueSignal.available ? cueSignal.score : "—"}</div>
              </div>

              <div className={styles.truthRail}>
                <span><b>WEBULL</b>{chartReady ? "CONNECTED" : "OFFLINE"}</span>
                <span><b>TECH</b>{cueSignal.available ? cueSignal.score + "/100" : "—"}</span>
                <span><b>MTF</b>{intelligence.data?.alignment ?? "—"}</span>
                <span><b>FUND</b>{webullFundamentals.data?.score != null ? webullFundamentals.data.bias + " " + webullFundamentals.data.score : webullFundamentals.isFetching ? "LOADING" : "—"}</span>
                <span><b>NEWS</b>{fundamental.data ? "FMP" : "OFFLINE"}</span>
              </div>

              {sizing&&cueSignal.available&&cueSignal.plan&&<div className={styles.positionSizing}>
                <div className={styles.positionSizingHead}><span>Position Sizing</span><small>Based on your Risk Plan</small></div>
                <div className={styles.sizingFacts}>
                  <span><b>Available capital</b><strong>{money(account?.balance.buyingPower)}</strong></span>
                  <span><b>Max risk / trade</b><strong>{money(risk?.maxRiskPerTrade)}</strong></span>
                  <span><b>Suggested shares</b><strong>{sizing.shares || "—"}</strong></span>
                </div>
                <div className={styles.tradePlan}>
                  <span><b>Entry range</b><strong>{formatPrice(cueSignal.plan.entryLow)} – {formatPrice(cueSignal.plan.entryHigh)}</strong></span>
                  <span><b>Stop / exit</b><strong className={styles.negative}>{formatPrice(cueSignal.plan.stop)} ({money(String(-sizing.plannedLoss))})</strong></span>
                  <span><b>Target 1</b><strong className={styles.positive}>{formatPrice(cueSignal.plan.target1)} (+{money(String(sizing.potentialTp1))})</strong></span>
                  <span><b>Target 2</b><strong className={styles.positive}>{formatPrice(cueSignal.plan.target2)} (+{money(String(sizing.potentialTp2))})</strong></span>
                </div>
                <p className={styles.sizingNote}>Potential outcomes only · TradeCUE does not guarantee profit.</p>
              </div>}

              {cueSignal.available ? (
                <>
                  <CueCheatSheet
                    symbol={symbol}
                    timeframe={timeframe}
                    signal={cueSignal}
                    action={displayedCue}
                    fresh={dataFresh}
                    hasPosition={Boolean(position)}
                    intelligence={intelligence.data ? {
                      compositeScore: intelligence.data.compositeScore,
                      alignment: intelligence.data.alignment,
                      marketChangePercent: intelligence.data.marketChangePercent,
                      action: intelligence.data.action,
                    } : null}
                    marketActive={session.active}
                    marketLabel={session.label}
                  />

                  <details className={styles.advancedDetails}>
                    <summary>Technical breakdown</summary>
                    <div className={styles.scoreBreakdown}>
                      {Object.entries(cueSignal.componentScores).map(([name, value]) => (
                        <div key={name}>
                          <small>{name}</small>
                          <strong>{value}/100</strong>
                        </div>
                      ))}
                    </div>
                    <ul>
                      {cueSignal.flags.slice(0, 4).map((flag) => <li key={flag}>{flag}</li>)}
                    </ul>
                  </details>

                  <div className={styles.tradeButtons}>
                    <Button
                      onClick={() => scrollTo("paper-trading")}
                      disabled={!account || !dataFresh || ["WAIT","AVOID"].includes(displayedCue ?? "")}
                    >
                      {tradeDecision.state==="ENTER_NOW"?"Approve Paper Trade":tradeDecision.state==="EXIT_NOW"||tradeDecision.state==="EXIT_REVIEW"?"Review Exit":position?"Manage Position":"Review Paper Plan"}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={watchingCurrent||watchlist.mutate.isPending}
                      onClick={()=>!watchingCurrent&&watchlist.mutate.mutate({action:"add",symbol,assetType:"stocks"})}
                    >
                      {watchingCurrent?"Watching":"Watch This"}
                    </Button>
                  </div>
                  <div className={styles.professorBrief}>
                    <BookOpen size={17}/>
                    <p><strong>Professor Cue:</strong> {tradeDecision.instruction}</p>
                  </div>
                </>
              ) : (
                <>
                  <h3>Signal engine waiting for data</h3>
                  <p className={styles.decisionCopy}>{"reason" in cueSignal ? cueSignal.reason : "Signal inputs are unavailable."}</p>
                  <div className={styles.professor}>
                    <BookOpen size={19} />
                    <p><strong>Professor Cue:</strong> Connect Webull PaperTrade and load enough candles. TradeCUE will not invent a signal when the required inputs are unavailable.</p>
                  </div>
                  <div className={styles.tradeButtons}>
                    <Button disabled>Signal unavailable</Button>
                    <Button variant="outline" onClick={() => scrollTo("chart-coach")}>Open chart coach</Button>
                  </div>
                </>
              )}
            </div>
          </section>

          <Tabs defaultValue="fundamentals" className={styles.lowerTabs}>
            <TabsList>
              <TabsTrigger value="fundamentals">Fundamental Intelligence</TabsTrigger>
              <TabsTrigger value="crypto">CueCrypto</TabsTrigger>
              <TabsTrigger value="futures">CueFutures</TabsTrigger>
              <TabsTrigger value="risk">Risk Firewall</TabsTrigger>
            </TabsList>

            <TabsContent value="fundamentals">
              <div id="fundamentals">
                {!isMember ? (
                  <div className={styles.marketDesk}><p>Sign in to load Webull fundamentals and connected news.</p></div>
                ) : webullFundamentals.isFetching ? (
                  <div className={styles.marketDesk}><p>Loading Webull fundamentals for {symbol}…</p></div>
                ) : webullFundamentals.error ? (
                  <div className={styles.marketDesk}>
                    <div><Newspaper size={25}/><span><small>WEBULL FUNDAMENTALS</small><strong>DATA UNAVAILABLE</strong></span><Badge variant="warning">CHECK CONNECTION</Badge></div>
                    <p>{webullFundamentals.error.message}</p>
                  </div>
                ) : webullFundamentals.data ? (
                  <div className={styles.intelligenceGrid}>
                    <article className={styles.bigPanel}>
                      <div className={styles.panelHead}>
                        <div><small>WEBULL FUNDAMENTAL INTELLIGENCE</small><h3>{webullFundamentals.data.profile?.companyName || symbol}</h3></div>
                        <Badge variant={webullFundamentals.data.bias==="POSITIVE"?"success":webullFundamentals.data.bias==="WEAK"?"destructive":"warning"}>
                          {webullFundamentals.data.bias} {webullFundamentals.data.score ?? "—"}
                        </Badge>
                      </div>
                      <div className={styles.fundamentalFacts}>
                        <div><small>Analyst positive</small><strong>{webullFundamentals.data.analyst ? (webullFundamentals.data.analyst.strongBuy + webullFundamentals.data.analyst.buy) + "/" + webullFundamentals.data.analyst.total : "—"}</strong></div>
                        <div><small>Analyst hold</small><strong>{webullFundamentals.data.analyst?.hold ?? "—"}</strong></div>
                        <div><small>Mean target</small><strong>{webullFundamentals.data.target?.mean != null ? formatPrice(webullFundamentals.data.target.mean) : "—"}</strong></div>
                        <div><small>Recent filings</small><strong>{webullFundamentals.data.filings.length}</strong></div>
                      </div>
                      <div className={styles.fundamentalReasons}>
                        {webullFundamentals.data.reasons.map(reason=><span key={reason}>{reason}</span>)}
                      </div>
                      {webullFundamentals.data.earnings[0] && (
                        <div className={styles.earningsStrip}>
                          <span><b>Latest reported EPS</b>{webullFundamentals.data.earnings[0].epsActual ?? "—"} vs {webullFundamentals.data.earnings[0].epsEstimate ?? "—"} est.</span>
                          <span><b>Revenue</b>{webullFundamentals.data.earnings[0].revenueActual != null ? compactMoney(webullFundamentals.data.earnings[0].revenueActual) : "—"}</span>
                          <span><b>Sector / industry</b>{webullFundamentals.data.profile?.sector ?? "—"}</span>
                        </div>
                      )}
                      <div className={styles.deepFundamentals}>
                        <span><b>Large-order flow</b><strong className={(webullFundamentals.data.capitalFlow?.largeNet??0)>=0?styles.positive:styles.negative}>{compactMoney(webullFundamentals.data.capitalFlow?.largeNet)}</strong><small>{webullFundamentals.data.capitalFlow?.date ?? "—"}</small></span>
                        <span><b>Net margin</b><strong>{metricPercent(webullFundamentals.data.indicators?.netMargin)}</strong><small>Latest Webull indicator</small></span>
                        <span><b>ROE</b><strong>{metricPercent(webullFundamentals.data.indicators?.roe)}</strong><small>Return on equity</small></span>
                        <span><b>Debt / assets</b><strong>{metricPercent(webullFundamentals.data.indicators?.debtToAssets)}</strong><small>Latest reported period</small></span>
                        <span><b>Next earnings</b><strong>{webullFundamentals.data.nextEarnings?.startDate ?? "—"}</strong><small>EPS est. {webullFundamentals.data.nextEarnings?.epsEstimate ?? "—"}</small></span>
                        <span><b>OCF / share</b><strong>{webullFundamentals.data.indicators?.operatingCashFlowPerShare?.toFixed(2) ?? "—"}</strong><small>Operating cash flow</small></span>
                      </div>
                      <p><strong>Professor Cue:</strong> Fundamentals are context, not an automatic entry. A strong company can still be a bad buy if price is extended or the technical setup is weak.</p>
                    </article>

                    <article className={styles.newsList}>
                      <div className={styles.newsHead}><h3>Fundamental news</h3><Badge variant={fundamental.data?"success":"warning"}>{fundamental.data?"FMP LIVE":"NEWS OFFLINE"}</Badge></div>
                      {fundamental.data ? (
                        <>
                          {fundamental.data.news.slice(0,4).map((item,index)=>(
                            <div key={(item.url||item.title)+index}>
                              <span>{item.site||"Market"}</span>
                              <strong>{item.title}</strong>
                              <em>{item.publishedDate?new Date(item.publishedDate).toLocaleDateString():"Update"}</em>
                            </div>
                          ))}
                          <p><strong>AI catalyst read:</strong> {fundamental.data.cueSummary}</p>
                        </>
                      ) : (
                        <p>Webull fundamentals are live. The external headline/catalyst feed is not connected yet, so TradeCUE will not invent news. Connect the FMP API key to turn this panel on.</p>
                      )}
                      {webullFundamentals.data.filings.slice(0,3).map((filing,index)=>(
                        <div key={filing.title+index}>
                          <span>SEC</span><strong>{filing.title}</strong><em>{filing.publishDate??"Filing"}</em>
                        </div>
                      ))}
                    </article>
                  </div>
                ) : null}
              </div>
            </TabsContent>

            <TabsContent value="crypto">
              <div className={styles.marketDesk}>
                <div><Link2 size={25} /><span><small>CUECRYPTO</small><strong>CONNECTION REQUIRED</strong></span><Badge variant="warning">NOT ACTIVE</Badge></div>
                <p>No crypto price, signal, or portfolio data is being simulated. A supported crypto data/broker connection must be added first.</p>
              </div>
            </TabsContent>

            <TabsContent value="futures">
              <div className={styles.marketDesk}>
                <div><Link2 size={25} /><span><small>CUEFUTURES</small><strong>TRADOVATE CONNECTION REQUIRED</strong></span><Badge variant="warning">NOT ACTIVE</Badge></div>
                <p>Futures market data, DOM, margin, and order controls remain disabled until Tradovate credentials and permissions are connected.</p>
              </div>
            </TabsContent>

            <TabsContent value="risk">
              <div id="risk">
                <div className={styles.riskDesk}>
                  <div><small>Max risk / trade</small><strong>{risk ? money(risk.maxRiskPerTrade) : "—"}</strong></div>
                  <div><small>Max daily loss</small><strong>{risk ? money(risk.maxDailyLoss) : "—"}</strong></div>
                  <div><small>Max trades</small><strong>{risk?.maxTradesPerDay ?? "—"}</strong></div>
                  <div><small>Long only</small><strong className={risk?.longOnly ? styles.positive : undefined}>{risk ? risk.longOnly ? "ON" : "OFF" : "—"}</strong></div>
                  <div><small>No chase</small><strong className={risk?.noChaseEnabled ? styles.positive : undefined}>{risk ? risk.noChaseEnabled ? "ON" : "OFF" : "—"}</strong></div>
                  <div><small>Day-trade flat time</small><strong>{risk?.dayTradeFlatTimePt ?? "—"}</strong></div>
                </div>
                <TradePlanner
                  accountEquity={account?.balance.equity}
                  entry={latest?.close}
                  suggestedStop={cueSignal.available && dataFresh && ["BUY","HOLD"].includes(displayedCue ?? "") ? cueSignal.plan?.stop : undefined}
                  suggestedTarget={cueSignal.available && dataFresh && ["BUY","HOLD"].includes(displayedCue ?? "") ? cueSignal.plan?.target2 : undefined}
                  maxRiskPerTrade={risk?.maxRiskPerTrade}
                />
              </div>
            </TabsContent>
          </Tabs>

          <section className={styles.automationCard}>
            <div><Gauge size={20} /><span><small>CUE AUTOPILOT</small><strong>MANUAL PAPER MODE ACTIVE</strong></span></div>
            <div className={styles.automationStats}><span>Webull paper orders enabled</span><span>No autonomous live trading</span><span>Risk review required</span></div>
            <Button variant="outline" disabled>Autopilot strategy runner coming later</Button>
          </section>
        </main>
      </div>
    </div>
  );
}
