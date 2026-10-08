import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  BriefcaseBusiness,
  CandlestickChart,
  LayoutDashboard,
  Link2,
  LockKeyhole,
  LogOut,
  Newspaper,
  Radar,
  ShieldCheck,
  WalletCards,
  Beaker,
  Maximize2,
  Minimize2,
  Star,
  Bot,
} from "lucide-react";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Sheet,SheetContent,SheetDescription,SheetHeader,SheetTitle } from "../components/Sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/Tabs";
import { CueProChart } from "../components/CueProChart";
import { WebullPanel } from "../components/WebullPanel";
import { WebullLivePanel } from "../components/WebullLivePanel";
import { PaperOrderPanel } from "../components/PaperOrderPanel";
import { TradePlanner } from "../components/TradePlanner";
import { WatchlistPanel } from "../components/WatchlistPanel";
import { CueHunterPanel } from "../components/CueHunterPanel";
import { CueOpportunityStrip } from "../components/CueOpportunityStrip";
import { CueOperatorPanel } from "../components/CueOperatorPanel";
import { CueAutoPaperTrader } from "../components/CueAutoPaperTrader";
import { CueJournalPanel } from "../components/CueJournalPanel";
import { MacroRiskGuard } from "../components/MacroRiskGuard";
import { CueLabPanel } from "../components/CueLabPanel";
import { CueFuturesPanel } from "../components/CueFuturesPanel";
import { FundedRiskPanel } from "../components/FundedRiskPanel";
import { MarketPulsePanel } from "../components/MarketPulsePanel";
import { PositionMonitorPanel } from "../components/PositionMonitorPanel";
import { CueCheatSheet } from "../components/CueCheatSheet";
import { ProfessorCueLive } from "../components/ProfessorCueLive";
import {OmegaProofPanel} from "../components/OmegaProofPanel";
import { BuildUpdateGuard } from "../components/BuildUpdateGuard";
import { PortfolioBrainPanel } from "../components/PortfolioBrainPanel";
import { CueLearningPanel } from "../components/CueLearningPanel";
import { ReliabilityCenter } from "../components/ReliabilityCenter";
import { CueNewsCommandCenter } from "../components/CueNewsCommandCenter";
import { useAuth } from "../helpers/useAuth";
import { useEntitlements } from "../helpers/useEntitlements";
import { useFundamentalBrief } from "../helpers/useFundamentalBrief";
import { useWebullAccount } from "../helpers/useWebullAccount";
import { useWebullHistory } from "../helpers/useWebullHistory";
import { useMarketIntelligence } from "../helpers/useMarketIntelligence";
import { useWebullFundamentals } from "../helpers/useWebullFundamentals";
import { useWatchlist } from "../helpers/useWatchlist";
import { useSymbolSearch } from "../helpers/useSymbolSearch";
import { useCueJournal } from "../helpers/useCueJournal";
import {useChartTrades} from "../helpers/useChartTrades";
import {chartFrameSeconds} from "../helpers/chartTradeFills";
import { useMacroRisk } from "../helpers/useMacroRisk";
import { calculateCueSignal } from "../helpers/cueSignal";
import { calculateMarketStructure } from "../helpers/marketStructure";
import { TRADECUE_BUILD_ID } from "../helpers/buildVersion";
import { useAutomationControl } from "../helpers/useAutomationControl";
import styles from "./workstation.module.css";

const plans = {
  scout: { name: "Scout Workstation", price: "$39" },
  copilot: { name: "Copilot Command Center", price: "$129" },
  autopilot: { name: "Autopilot Pro Desk", price: "$249" },
} as const;

const timeframes = ["5m","15m","1H","4H"] as const;

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

export default function WorkstationPage() {
  const { authState, logout } = useAuth();
  const isMember = authState.type === "authenticated";
  const isOwner = isMember && authState.user.role === "admin";
  const entitlements = useEntitlements(isMember);

  const [symbol, setSymbol] = useState("NVDA");
  const [symbolDraft, setSymbolDraft] = useState("NVDA");
  const [timeframe, setTimeframe] = useState<(typeof timeframes)[number]>("5m");
  const [accountId, setAccountId] = useState<string>();
  const [deskMode, setDeskMode] = useState<"teach"|"pro">("pro");
  const [chartFocus, setChartFocus] = useState(false);
  const [tradeAmountText,setTradeAmountText]=useState("500");
  const [orderTicketOpen,setOrderTicketOpen]=useState(false);
  const [newsOpen,setNewsOpen]=useState(false);
  const [deskView,setDeskView]=useState<"stocks"|"markets"|"screener"|"advanced"|"axiom"|"orders"|"journal"|"news"|"account">("stocks");
  const [orderTicketSide,setOrderTicketSide]=useState<"BUY"|"SELL"|null>(null);
  const [lowerTab,setLowerTab]=useState<"fundamentals"|"crypto"|"futures"|"risk">("fundamentals");
  const [wakeState,setWakeState]=useState<"ON"|"OFF"|"UNAVAILABLE"|"BLOCKED">("OFF");
  const openOrderTicket=(side?:"BUY"|"SELL")=>{
    setOrderTicketSide(side??null);
    setOrderTicketOpen(true);
  };

  const webull = useWebullAccount(isMember, symbol, timeframe, accountId);
  const executionWebull = useWebullAccount(isMember, symbol, "5m", accountId);
  const history = useWebullHistory(Boolean(isMember&&webull.account.data),symbol,timeframe);
  const intelligence = useMarketIntelligence(Boolean(isMember && webull.account.data), symbol);
  const webullFundamentals = useWebullFundamentals(Boolean(isMember && webull.account.data), symbol);
  const fundamental = useFundamentalBrief(symbol, isMember);
  const currentWatchlist = useWatchlist(isMember);
  const symbolSearch=useSymbolSearch(symbolDraft,isMember&&symbolDraft.trim().length>=2&&symbolDraft.trim().toUpperCase()!==symbol);
  const journal=useCueJournal(isMember);
  const macroRisk=useMacroRisk(isMember);
  const automationControl=useAutomationControl(isMember);

  const tier = entitlements.data?.membership.tier ?? "copilot";
  const plan = plans[tier];
  const assistedLiveTrading=Boolean(entitlements.data?.features.includes("assisted_live_trading"));
  const bars = webull.bars.data?.bars ?? [];
  const executionBars = executionWebull.bars.data?.bars ?? [];
  const chartBars=useMemo(()=>{
    const byTime=new Map<string,(typeof bars)[number]>();
    for(const bar of history.data?.bars??[])byTime.set(bar.time,bar);
    for(const bar of bars)byTime.set(bar.time,bar);
    return [...byTime.values()].sort((a,b)=>Date.parse(a.time)-Date.parse(b.time)).slice(-1650);
  },[history.data?.bars,bars]);
  const chartTradeFrom=chartBars[0]?.time;
  const chartTradeLast=chartBars.at(-1)?.time;
  const chartTradeTo=chartTradeLast&&Number.isFinite(Date.parse(chartTradeLast))?new Date(Date.parse(chartTradeLast)+chartFrameSeconds(timeframe)*1000).toISOString():undefined;
  const chartTrades=useChartTrades(accountId||webull.account.data?.selectedAccountId,symbol,chartTradeFrom,chartTradeTo);
  const latest = bars[bars.length - 1];
  const previous = bars[bars.length - 2];
  const executionLatest = executionBars[executionBars.length - 1];
  const change = percentChange(latest?.close, previous?.close);
  const chartReady = bars.length > 0;
  const cueSignal = useMemo(() => calculateCueSignal(executionBars), [executionBars]);
  const chartSignal = useMemo(() => calculateCueSignal(bars), [bars]);
  const structure = useMemo(()=>calculateMarketStructure(bars),[bars]);
  const freshnessMinutes: Record<(typeof timeframes)[number], number> = {
    "5m": 20,
    "15m": 45,
    "1H": 180,
    "4H": 720,
  };
  const latestAgeMinutes =
    latest?.time && Number.isFinite(Date.parse(latest.time))
      ? Math.max(0, (Date.now() - Date.parse(latest.time)) / 60000)
      : null;
  const dataFresh =
    latestAgeMinutes != null && latestAgeMinutes <= freshnessMinutes[timeframe];
  const executionLatestAgeMinutes =
    executionLatest?.time && Number.isFinite(Date.parse(executionLatest.time))
      ? Math.max(0, (Date.now() - Date.parse(executionLatest.time)) / 60000)
      : null;
  const executionDataFresh =
    executionLatestAgeMinutes != null && executionLatestAgeMinutes <= freshnessMinutes["5m"];

  const risk = entitlements.data?.risk;
  const session = marketSession();
  const account = webull.account.data;
  const signedOut = authState.type === "unauthenticated";
  const position = account?.positions.find(
    (item) => item.symbol.toUpperCase() === symbol.toUpperCase() && Number(item.quantity ?? 0) > 0,
  );
  const displayedCue = cueSignal.available
    ? !executionDataFresh
      ? "WAIT"
      : position
        ? (cueSignal.state === "AVOID" || intelligence.data?.action === "AVOID") ? "SELL" : "HOLD"
        : (cueSignal.state === "AVOID" || intelligence.data?.action === "AVOID")
          ? "AVOID"
          : cueSignal.state === "BUY" && macroRisk.data?.state !== "BLOCKED" && (intelligence.data ? intelligence.data.action === "ENTRY_READY" : true)
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
    ? <Badge variant="outline">SYNCING WEBULL</Badge>
    : chartReady && !session.active
      ? <Badge variant="warning">{session.label}</Badge>
      : chartReady && delayMinutes != null && delayMinutes > 0
        ? <Badge variant="warning">WEBULL • DELAYED {delayMinutes} MIN</Badge>
        : chartReady
          ? <Badge variant="success">WEBULL SANDBOX • AUTO REFRESH</Badge>
          : <Badge variant="warning">CONNECTION REQUIRED</Badge>;

  const latestEarnings = fundamental.data?.earnings?.[0];
  const tradeAmount=Math.max(0,Number(tradeAmountText)||0);
  const activePlan=cueSignal.available?cueSignal.plan:null;
  const protectedTrade=journal.activity.data?.trades.find(row=>
    row.symbol.toUpperCase()===symbol.toUpperCase()&&
    row.exitTime==null&&
    row.entryPrice!=null&&row.stopPrice!=null&&row.target1!=null&&row.target2!=null&&row.target3!=null
  );
  const protectedLevels=protectedTrade?{
    entryLow:protectedTrade.entryPrice!,
    entryHigh:protectedTrade.entryPrice!,
    stop:protectedTrade.stopPrice!,
    target1:protectedTrade.target1!,
    target2:protectedTrade.target2!,
    target3:protectedTrade.target3!,
  }:null;
  const planEntry=activePlan?activePlan.entryHigh:null;
  const planShares=planEntry&&tradeAmount>0?Math.floor(tradeAmount/planEntry):0;
  const planRisk=activePlan&&planShares>0?(activePlan.entryHigh-activePlan.stop)*planShares:null;
  const planProfit1=activePlan&&planShares>0?(activePlan.target1-activePlan.entryHigh)*planShares:null;
  const planProfit2=activePlan&&planShares>0?(activePlan.target2-activePlan.entryHigh)*planShares:null;
  const planProfit3=activePlan&&planShares>0?(activePlan.target3-activePlan.entryHigh)*planShares:null;
  const watchedItem = currentWatchlist.list.data?.items.find(item=>item.symbol.toUpperCase()===symbol.toUpperCase());

  useEffect(()=>{
    if(!chartFocus)return;
    const close=(event:KeyboardEvent)=>{if(event.key==="Escape")setChartFocus(false);};
    window.addEventListener("keydown",close);
    return ()=>window.removeEventListener("keydown",close);
  },[chartFocus]);
  useEffect(()=>{
    let sentinel:any=null;
    let cancelled=false;
    const acquire=async()=>{
      if(!isMember||!automationControl.query.data?.autoPaperEnabled){setWakeState("OFF");return;}
      if(document.visibilityState!=="visible")return;
      const wake=(navigator as any).wakeLock;
      if(!wake?.request){setWakeState("UNAVAILABLE");return;}
      try{
        sentinel=await wake.request("screen");
        if(cancelled){await sentinel.release().catch(()=>{});return;}
        setWakeState("ON");
        sentinel.addEventListener("release",()=>{sentinel=null;if(!cancelled)setWakeState("OFF");});
      }catch{if(!cancelled)setWakeState("BLOCKED");}
    };
    const onVisibility=()=>{if(document.visibilityState==="visible"&&!sentinel)void acquire();};
    void acquire();
    document.addEventListener("visibilitychange",onVisibility);
    return ()=>{cancelled=true;document.removeEventListener("visibilitychange",onVisibility);if(sentinel)void sentinel.release().catch(()=>{});};
  },[isMember,automationControl.query.data?.autoPaperEnabled]);
  useEffect(()=>{
    if(!isMember||!cueSignal.available||!displayedCue||!executionDataFresh)return;
    journal.log.mutate({
      symbol,timeframe:"5m",action:displayedCue,score:cueSignal.score,price:executionLatest?.close??null,
      structure:structure.summary,plan:cueSignal.plan,
    });
  // only state/symbol/timeframe changes should journal; mutation identity is intentionally omitted
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[isMember,symbol,displayedCue,executionDataFresh,cueSignal.available,cueSignal.available?cueSignal.score:null,structure.summary]);
  const epsRead = latestEarnings?.epsActual != null && latestEarnings?.epsEstimated != null
    ? latestEarnings.epsActual >= latestEarnings.epsEstimated ? "Beat" : "Miss"
    : "Unavailable";
  const revenueRead = latestEarnings?.revenueActual != null && latestEarnings?.revenueEstimated != null
    ? latestEarnings.revenueActual >= latestEarnings.revenueEstimated ? "Beat" : "Miss"
    : "Unavailable";

  return (
    <div className={styles.shell}>
      <BuildUpdateGuard/>
      {isMember&&<Sheet open={orderTicketOpen} onOpenChange={(open)=>{setOrderTicketOpen(open);if(!open)setOrderTicketSide(null);}}>
        <SheetContent side="right" className={styles.orderSheet}>
          <SheetHeader>
            <SheetTitle>TradeCUE Full Order Ticket</SheetTitle>
            <SheetDescription>Webull PaperTrade only. Review the symbol, side, quantity and price before submitting.</SheetDescription>
          </SheetHeader>
          <div className={styles.orderSheetBody}>
            <PaperOrderPanel
              enabled={Boolean(webull.account.data)}
              accountId={accountId || webull.account.data?.selectedAccountId}
              symbol={symbol}
              latestPrice={executionLatest?.close}
              positionQuantity={Number(position?.quantity ?? 0)}
              longOnly={risk?.longOnly ?? true}
              suggestedSide={orderTicketSide??(displayedCue==="BUY"?"BUY":displayedCue==="SELL"?"SELL":null)}
            />
          </div>
        </SheetContent>
      </Sheet>}
      <Sheet open={newsOpen} onOpenChange={setNewsOpen}>
        <SheetContent side="left" className={styles.newsSheet}>
          <SheetHeader><SheetTitle>Market News · {symbol}</SheetTitle><SheetDescription>Headlines, available summaries, and links to the original reporting.</SheetDescription></SheetHeader>
          <CueNewsCommandCenter expanded symbol={symbol} source={fundamental.data?.source??null} news={fundamental.data?.news??[]} summary={fundamental.data?.cueSummary??null} macroState={macroRisk.data?.state} loading={fundamental.isFetching} error={fundamental.error instanceof Error?fundamental.error.message:null}/>
        </SheetContent>
      </Sheet>
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
          <span className={styles.buildBadge}>LIVE BUILD {TRADECUE_BUILD_ID}</span>
          <button className={styles.botJump} onClick={()=>setNewsOpen(true)}><Newspaper size={14}/>NEWS</button>
          <button className={styles.botJump} onClick={()=>setDeskView("axiom")}><Bot size={14}/>OMEGA</button>
          {isMember&&<button className={styles.orderJump} onClick={()=>openOrderTicket()}><WalletCards size={14}/>ORDER TICKET</button>}
          <div className={styles.modeSwitch} aria-label="Workstation mode">
            <button className={deskMode==="teach"?styles.modeActive:undefined} onClick={()=>setDeskMode("teach")}><BookOpen size={13}/>Teach</button>
            <button className={deskMode==="pro"?styles.modeActive:undefined} onClick={()=>setDeskMode("pro")}><CandlestickChart size={13}/>Pro</button>
          </div>
          {dataBadge}
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
          <nav aria-label="Workstation">
            <button aria-current={deskView==="stocks"?"page":undefined} onClick={()=>setDeskView("stocks")}><CandlestickChart size={20}/><span>Dashboard</span></button>
            <button onClick={()=>setDeskView("markets")}><LayoutDashboard size={17}/><span>Markets</span></button>
            <button onClick={()=>setDeskView("screener")}><Radar size={17}/><span>Screener</span></button>
            <button aria-current={deskView==="news"?"page":undefined} onClick={()=>setDeskView("news")}><Newspaper size={20}/><span>News</span></button>
            <button aria-current={deskView==="orders"?"page":undefined} onClick={()=>setDeskView("orders")}><WalletCards size={20}/><span>Orders</span></button>
            <button aria-current={deskView==="axiom"?"page":undefined} onClick={()=>setDeskView("axiom")}><Bot size={20}/><span>Omega</span></button>
            <button aria-current={deskView==="journal"?"page":undefined} onClick={()=>setDeskView("journal")}><BookOpen size={20}/><span>Journal</span></button>
            <button aria-current={deskView==="account"?"page":undefined} onClick={()=>setDeskView("account")}><WalletCards size={20}/><span>Account</span></button>
            <button onClick={()=>setDeskView("advanced")}><Beaker size={17}/><span>Advanced</span></button>
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

        <main className={styles.main} id="command-center" data-desk-view={deskView}>
          {deskMode==="teach"&&<div className={styles.pageHead}>
            <div>
              <span>COMMAND CENTER</span>
              <h1>{isMember ? plan.name : "TradeCUE Market Workstation"}</h1>
              <p>Scan → understand → plan → paper trade. Every CUE shows its data source.</p>
            </div>
          </div>}

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

          {deskMode==="teach"&&<section className={styles.statusGrid} aria-label="TradeCUE live status">
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
              <strong className={actionClass}>{actionHeadline}</strong>
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
          </section>}

          <div className={styles.deskAutomation}>
              <CueAutoPaperTrader
                enabled={Boolean(webull.account.data)}
                accountId={accountId || webull.account.data?.selectedAccountId}
                buyingPower={Number(account?.balance.buyingPower??0)}
                maxRiskPerTrade={Math.min(
                  Number(risk?.maxRiskPerTrade??0),
                  Math.max(0,Number(account?.balance.equity??account?.balance.buyingPower??0))*.01,
                )}
                onOpenSymbol={next=>{setDeskView("stocks");setSymbol(next);setSymbolDraft(next);setTimeout(()=>scrollTo("vision"),0);}}
              />
          </div>
          <div className={styles.feedStrip}><strong>PAPER ONLY · {symbol}</strong><span>{dataFresh?"Chart data current":"Chart data unavailable or stale"} · Last candle {latestBarLabel}</span><span>Signal: {actionHeadline} · Omega executes on 5m</span><span>Keep-awake: <strong>{wakeState}</strong></span></div>
          <CueOpportunityStrip
            enabled={Boolean(webull.account.data)&&deskView==="markets"}
            onOpenSymbol={(nextSymbol)=>{
              setDeskView("stocks");
              setSymbol(nextSymbol);
              setSymbolDraft(nextSymbol);
              setTimeout(()=>scrollTo("vision"),0);
            }}
          />

          <CueNewsCommandCenter
            expanded={deskView==="news"}
            symbol={symbol}
            source={fundamental.data?.source??null}
            news={fundamental.data?.news??[]}
            summary={fundamental.data?.cueSummary??null}
            macroState={macroRisk.data?.state}
            loading={fundamental.isFetching}
            error={fundamental.error instanceof Error?fundamental.error.message:null}
          />

          <MarketPulsePanel
            enabled={Boolean(webull.account.data)&&deskView==="markets"}
            onOpenSymbol={(nextSymbol) => {
              setDeskView("stocks");
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
                  setDeskView("stocks");
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
              <WebullLivePanel enabled={isMember&&assistedLiveTrading} symbol={symbol} latestPrice={executionLatest?.close}/>
              <CueHunterPanel
                enabled={Boolean(webull.account.data)}
                onOpenSymbol={(nextSymbol) => {
                  setDeskView("stocks");
              setSymbol(nextSymbol);
                  setSymbolDraft(nextSymbol);
                  setTimeout(() => scrollTo("vision"), 0);
                }}
              />
              <PositionMonitorPanel
                enabled={Boolean(webull.account.data)}
                accountId={accountId || webull.account.data?.selectedAccountId}
                onOpenSymbol={(nextSymbol) => {
                  setDeskView("stocks");
              setSymbol(nextSymbol);
                  setSymbolDraft(nextSymbol);
                  setTimeout(() => scrollTo("vision"), 0);
                }}
              />
            </>
          )}

          {deskMode==="pro" && <section className={styles.radar} id="radar">
            <div className={styles.sectionTitle}>
              <div><span>CURRENT SIGNAL</span><h2>Signal engine</h2></div>
              <Badge variant={cueSignal.available ? "success" : "warning"}>
                {cueSignal.available ? "SIGNAL ENGINE ACTIVE" : "DATA REQUIRED"}
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
                  <p>{cueSignal.reason} Market Scanner scans the broader Webull market; this section evaluates the symbol currently loaded on the chart.</p>
                </div>
              </div>
            )}
          </section>}

          <section className={chartFocus?`${styles.workGrid} ${styles.workGridFocus}`:styles.workGrid} id="vision">
            <div className={chartFocus?`${styles.visionCard} ${styles.visionCardFocus}`:styles.visionCard}>
              <div className={styles.visionHead}>
                <div>
                  <small>CUE VISION • REAL MARKET DATA WHEN CONNECTED</small>
                  <strong>{symbol} <span>{formatPrice(latest?.close)}</span></strong>
                </div>
                <div className={styles.visionActions}>
                  {isMember&&<Button
                    size="sm"
                    variant={watchedItem?"secondary":"outline"}
                    disabled={currentWatchlist.mutate.isPending}
                    onClick={async()=>{
                      if(watchedItem){
                        await currentWatchlist.mutate.mutateAsync({action:"remove",id:watchedItem.id});
                      }else{
                        await currentWatchlist.mutate.mutateAsync({action:"add",symbol,assetType:"stocks"});
                      }
                    }}
                  ><Star size={14}/>{watchedItem?"Watching":"Watch"}</Button>}
                  <Badge variant="outline">{history.isFetching?"LOADING PRO HISTORY…":history.data?history.data.loaded.toLocaleString()+" REAL BARS":"RECENT DATA"}</Badge>
                  <Button size="sm" variant="outline" onClick={()=>setChartFocus(value=>!value)}>
                    {chartFocus?<Minimize2 size={14}/>:<Maximize2 size={14}/>}
                    {chartFocus?"Exit focus":"Focus chart"}
                  </Button>
                  {dataBadge}
                </div>
              </div>

              <form className={styles.symbolForm} onSubmit={submitSymbol}>
                <div className={styles.symbolSearchWrap}>
                  <Input
                    aria-label="Stock ticker or company name"
                    value={symbolDraft}
                    onChange={(event) => setSymbolDraft(event.target.value)}
                    placeholder="Ticker or company, e.g. NVDA or Nvidia"
                    autoComplete="off"
                  />
                  {symbolDraft.trim().length>=2&&symbolDraft.trim().toUpperCase()!==symbol&&<div className={styles.symbolSuggestions}>
                    {symbolSearch.isFetching&&<span>Searching…</span>}
                    {symbolSearch.data?.items.map(item=><button type="button" key={item.symbol+"-"+item.exchange} onClick={()=>{setSymbol(item.symbol);setSymbolDraft(item.symbol);}}>
                      <strong>{item.symbol}</strong><span>{item.name}</span><em>{item.exchange??"US"}</em>
                    </button>)}
                    {!symbolSearch.isFetching&&symbolSearch.data&&!symbolSearch.data.items.length&&<span>{symbolSearch.data.note}</span>}
                  </div>}
                </div>
                <Button type="submit">Open chart</Button>
              </form>

              <div className={styles.timeframes}>
                {timeframes.map(tf=><button
                  key={tf}
                  className={timeframe===tf?styles.activeTimeframe:undefined}
                  onClick={()=>setTimeframe(tf)}
                  type="button"
                >{tf}</button>)}
                <span>{timeframe==="5m"?"OMEGA EXECUTION · EMA20 strategy":"LEARNING / CONTEXT ONLY · Omega still executes on 5m"}</span>
              </div>

              {isMember&&<div className={styles.quickTradeBar} aria-label="Webull trade controls">
                <div className={styles.quickTradeStatus}>
                  <small>WEBULL PAPERTRADE</small>
                  <strong>{account?"SYNCED":"CONNECT ACCOUNT"}</strong>
                  <span>{symbol} · {formatPrice(executionLatest?.close)}</span>
                </div>
                <button type="button" className={styles.quickBuy} disabled={!account} onClick={()=>openOrderTicket("BUY")}>BUY</button>
                <button type="button" className={styles.quickSell} disabled={!account||Number(position?.quantity??0)<=0} onClick={()=>openOrderTicket("SELL")}>SELL</button>
                {assistedLiveTrading&&<button type="button" className={styles.quickLive} onClick={()=>{setDeskView("orders");setTimeout(()=>document.getElementById("webull-live")?.scrollIntoView({behavior:"smooth",block:"start"}),0);}}>LIVE WEBULL</button>}
              </div>}

              {webull.bars.error && <p className={styles.brokerError} rol
... (output capped at 40000 chars — re-read with offset/limit)