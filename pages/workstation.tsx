import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  BriefcaseBusiness,
  CandlestickChart,
  Gauge,
  LayoutDashboard,
  Link2,
  LockKeyhole,
  LogOut,
  Newspaper,
  Radar,
  ShieldCheck,
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
import { CueHunterPanel } from "../components/CueHunterPanel";
import { MarketPulsePanel } from "../components/MarketPulsePanel";
import { PositionMonitorPanel } from "../components/PositionMonitorPanel";
import { CueCheatSheet } from "../components/CueCheatSheet";
import { useAuth } from "../helpers/useAuth";
import { useEntitlements } from "../helpers/useEntitlements";
import { useFundamentalBrief } from "../helpers/useFundamentalBrief";
import { useWebullAccount } from "../helpers/useWebullAccount";
import { useMarketIntelligence } from "../helpers/useMarketIntelligence";
import { calculateCueSignal } from "../helpers/cueSignal";
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

function percentChange(current?: number, previous?: number) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || !previous) return null;
  return ((current! - previous!) / previous!) * 100;
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

  const webull = useWebullAccount(isMember, symbol, timeframe, accountId);
  const intelligence = useMarketIntelligence(Boolean(isMember && webull.account.data), symbol);
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
  const account = webull.account.data;
  const signedOut = authState.type === "unauthenticated";
  const position = account?.positions.find(
    (item) => item.symbol.toUpperCase() === symbol.toUpperCase() && Number(item.quantity ?? 0) > 0,
  );
  const displayedCue = cueSignal.available
    ? !dataFresh && !["1D", "1W"].includes(timeframe)
      ? "WAIT"
      : position
        ? (cueSignal.state === "AVOID" || intelligence.data?.action === "AVOID") ? "SELL" : "HOLD"
        : cueSignal.state === "BUY" && (intelligence.data ? intelligence.data.action === "ENTRY_READY" : true)
          ? "BUY"
          : "WAIT"
    : null;
  const cueBadgeVariant = displayedCue === "BUY" || displayedCue === "HOLD"
    ? "success"
    : displayedCue === "SELL"
      ? "error"
      : "warning";
  const actionHeadline = displayedCue === "BUY"
    ? "ENTRY READY"
    : displayedCue === "SELL"
      ? "EXIT REVIEW"
      : displayedCue === "HOLD"
        ? "HOLD"
        : displayedCue === "WAIT"
          ? "WAIT"
          : "DATA REQUIRED";
  const actionClass = displayedCue === "BUY"
    ? styles.actionBuy
    : displayedCue === "SELL"
      ? styles.actionSell
      : displayedCue === "HOLD"
        ? styles.actionHold
        : styles.actionWait;

  useEffect(() => {
    if (webull.account.data?.selectedAccountId && !accountId) {
      setAccountId(webull.account.data.selectedAccountId);
    }
  }, [webull.account.data?.selectedAccountId, accountId]);

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
    ? <Badge variant="outline">SYNCING</Badge>
    : chartReady && delayMinutes != null && delayMinutes > 0
      ? <Badge variant="warning">DELAYED {delayMinutes} MIN</Badge>
      : chartReady
        ? <Badge variant="success">WEBULL DATA • 10s REFRESH</Badge>
        : <Badge variant="warning">CONNECTION REQUIRED</Badge>;

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
        </Link>

        <div className={styles.topStats}>
          <span>Buying Power <strong>{money(account?.balance.buyingPower)}</strong></span>
          <span>Account Equity <strong>{money(account?.balance.equity)}</strong></span>
          <span>Day P&L <strong className={Number(account?.balance.dayPnl ?? 0) >= 0 ? styles.positive : undefined}>{money(account?.balance.dayPnl)}</strong></span>
        </div>

        <div className={styles.topActions}>
          <Link to="/membership" className={styles.membershipLink}>Membership</Link>
          {isMember && (
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await logout();
                window.location.assign("/login");
              }}
            >
              <LogOut size={15} /> Log out
            </Button>
          )}
        </div>
      </header>

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <nav>
            <button onClick={() => scrollTo("command-center")} className={styles.activeNav}><LayoutDashboard size={17} /><span>Command Center</span></button>
            <button onClick={() => scrollTo("watchlist")}><WalletCards size={17} /><span>Watchlist</span></button>
            <button onClick={() => scrollTo("hunter")}><Radar size={17} /><span>Cue Hunter</span></button>
            <button onClick={() => scrollTo("radar")}><Radar size={17} /><span>Current Signal</span></button>
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
              <p>Real data where connected. Unavailable features are explicitly disabled instead of simulated.</p>
            </div>
            {dataBadge}
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

          <section className={styles.statusGrid} aria-label="Market data status">
            <article>
              <small>Symbol</small>
              <strong>{symbol}</strong>
              <span>Selected instrument</span>
            </article>
            <article>
              <small>Last loaded price</small>
              <strong>{formatPrice(latest?.close)}</strong>
              <span className={change == null ? undefined : change >= 0 ? styles.positive : styles.negative}>
                {change == null ? "No comparison available" : (change >= 0 ? "+" : "") + change.toFixed(2) + "% vs prior bar"}
              </span>
            </article>
            <article>
              <small>Latest candle</small>
              <strong>{latestBarLabel}</strong>
              <span>{timeframe} timeframe</span>
            </article>
            <article>
              <small>TradeCUE action</small>
              <strong className={actionClass}>{actionHeadline}</strong>
              <span>{cueSignal.available ? "Score " + cueSignal.score + "/100 • rules-based" : "Waiting for enough Webull candles"}</span>
            </article>
            <article>
              <small>Data state</small>
              <strong>
                {chartReady
                  ? !dataFresh && !["1D", "1W"].includes(timeframe)
                    ? "STALE / SESSION INACTIVE"
                    : delayMinutes != null && delayMinutes > 0
                      ? "DELAYED"
                      : "CONNECTED"
                  : "DATA UNAVAILABLE"}
              </strong>
              <span>
                {chartReady
                  ? !dataFresh && !["1D", "1W"].includes(timeframe)
                    ? "Latest intraday candle is " + Math.round(latestAgeMinutes ?? 0) + " minutes old"
                    : delayMinutes != null && delayMinutes > 0
                      ? "Webull reports " + delayMinutes + "-minute delay"
                      : "Webull PaperTrade OpenAPI • polling every 10s"
                  : "Connect Webull PaperTrade below"}
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
              <CueHunterPanel
                enabled={Boolean(webull.account.data)}
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
              />
            </>
          )}

          <section className={styles.radar} id="radar">
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
                  <p>{cueSignal.reason} Cue Hunter scans the broader Webull market; this section evaluates the symbol currently loaded in Cue Vision.</p>
                </div>
              </div>
            )}
          </section>

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
                levels={cueSignal.available && dataFresh ? cueSignal.plan : null}
                signalLabel={displayedCue}
                coachContext={cueSignal.available ? {
                  score: cueSignal.score,
                  fresh: dataFresh,
                  componentScores: cueSignal.componentScores,
                  relativeVolume: cueSignal.metrics.relativeVolume,
                  rsi14: cueSignal.metrics.rsi14,
                } : null}
              />
            </div>

            <div className={styles.decisionCard}>
              <div className={styles.decisionHead}>
                <div>
                  <small>TRADECUE ACTION • CUE INTELLIGENCE</small>
                  <h2 className={actionClass}>{actionHeadline}</h2>
                  <span className={styles.actionSub}>
                    {displayedCue ? "CUE " + displayedCue : "Waiting for Webull chart data"}
                  </span>
                </div>
                <div className={styles.score}>{cueSignal.available ? cueSignal.score : "—"}</div>
              </div>

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
                    <Button onClick={() => scrollTo("paper-trading")} disabled={!account || !dataFresh}>
                      Review paper setup
                    </Button>
                    <Button variant="outline" onClick={() => scrollTo("chart-coach")}>Professor Cue</Button>
                  </div>
                </>
              ) : (
                <>
                  <h3>Signal engine waiting for data</h3>
                  <p className={styles.decisionCopy}>{cueSignal.reason}</p>
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
                  <div className={styles.marketDesk}>
                    <p>Sign in to request Fundamental Intelligence. No research data is shown without a connected provider.</p>
                  </div>
                ) : fundamental.isFetching ? (
                  <div className={styles.marketDesk}><p>Loading Fundamental Intelligence for {symbol}…</p></div>
                ) : fundamental.error ? (
                  <div className={styles.marketDesk}>
                    <div><Newspaper size={25} /><span><small>FUNDAMENTAL INTELLIGENCE</small><strong>DATA UNAVAILABLE</strong></span><Badge variant="warning">PROVIDER REQUIRED</Badge></div>
                    <p>{fundamental.error.message}</p>
                  </div>
                ) : fundamental.data ? (
                  <div className={styles.intelligenceGrid}>
                    <article className={styles.bigPanel}>
                      <div className={styles.panelHead}><div><small>FUNDAMENTAL INTELLIGENCE</small><h3>{fundamental.data.symbol} data brief</h3></div><Badge variant="success">PROVIDER DATA</Badge></div>
                      <div className={styles.fundamentalFacts}>
                        <div><small>Revenue</small><strong>{revenueRead}</strong></div>
                        <div><small>EPS</small><strong>{epsRead}</strong></div>
                        <div><small>News items</small><strong>{fundamental.data.news.length}</strong></div>
                        <div><small>Generated</small><strong>{new Date(fundamental.data.generatedAt).toLocaleTimeString()}</strong></div>
                      </div>
                      <p><strong>Professor Cue:</strong> {fundamental.data.cueSummary}</p>
                    </article>
                    <article className={styles.newsList}>
                      <h3>Latest fundamental news</h3>
                      {fundamental.data.news.slice(0, 4).map((item, index) => (
                        <div key={(item.url || item.title) + index}>
                          <span>{item.site || "Market"}</span>
                          <strong>{item.title}</strong>
                          <em>{item.publishedDate ? new Date(item.publishedDate).toLocaleDateString() : "Update"}</em>
                        </div>
                      ))}
                      {fundamental.data.news.length === 0 && <p>No recent company news returned by the provider.</p>}
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
                  suggestedStop={cueSignal.available && dataFresh ? cueSignal.plan?.stop : undefined}
                  suggestedTarget={cueSignal.available && dataFresh ? cueSignal.plan?.target2 : undefined}
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

