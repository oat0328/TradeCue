import React from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  BarChart3,
  BookOpen,
  Bot,
  BrainCircuit,
  CandlestickChart,
  CheckCircle2,
  Crosshair,
  Gauge,
  Newspaper,
  Radar,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { useScrollReveal } from "../helpers/useScrollReveal";
import styles from "./_index.module.css";

const plans = [
  {
    key: "scout",
    name: "Scout",
    price: "$39",
    line: "Learn the chart. Build discipline.",
    features: ["Professional chart", "Professor Cue", "Paper trading", "Trade Journal", "Risk basics"],
  },
  {
    key: "copilot",
    name: "Command",
    price: "$129",
    line: "Analyze the market with Omega beside you.",
    features: ["Market Scanner", "Omega outlook", "News & Catalysts", "Portfolio Brain", "Full Order Ticket"],
    featured: true,
  },
  {
    key: "autopilot",
    name: "Omega Pro",
    price: "$249",
    line: "Train the autonomous PaperTrade operator.",
    features: ["Everything in Command", "Paper calibration mode", "Learning Engine", "Strategy Lab", "Automation controls"],
  },
];

const featureCards = [
  { icon: Radar, title: "Market Scanner", text: "Scans the liquid large-cap universe, top gainers and active names, then requires 1H + 15m trend alignment before a 5m entry can qualify." },
  { icon: Bot, title: "Omega", text: "TradeCUE's execution intelligence. It scans, waits, enters simulated trades, manages risk, exits, and records the result." },
  { icon: BrainCircuit, title: "Professor Cue", text: "Explains structure, EMA20, VWAP, volume, pullback, confirmation, stop, ATR and the 2R training target directly beside the chart." },
  { icon: Newspaper, title: "News & Catalysts", text: "Current headlines and macro risk live on the command center so price action and catalysts are read together." },
  { icon: ShieldCheck, title: "Risk Firewall", text: "No chasing, no averaging down, hard position limits, stop validation, daily-loss controls, and an emergency kill switch." },
  { icon: BarChart3, title: "Performance Engine", text: "Tracks resolved PaperTrades, expectancy, profit factor, average R, losing streaks, and which setups actually work." },
];

const workflow = [
  { icon: Radar, step: "01", title: "Scan", text: "Find liquid names where price, volume, breadth and market direction create a real opportunity." },
  { icon: CandlestickChart, step: "02", title: "Read", text: "Require bullish 1H + 15m context, then read the 5m HH/HL + EMA20 + VWAP + pullback setup." },
  { icon: Crosshair, step: "03", title: "Enter", text: "Only enter inside the planned zone after confirmation. Late location or poor reward/risk means wait." },
  { icon: Target, step: "04", title: "Manage", text: "Original stop and targets stay attached to the trade. Position monitoring watches for invalidation." },
  { icon: TrendingUp, step: "05", title: "Exit + learn", text: "Close the trade, journal the fill, calculate R and P/L, then feed the result back into the training gate." },
];

export default function HomePage() {
  const revealSystem = useScrollReveal();
  const revealWorkflow = useScrollReveal();
  const revealFeatures = useScrollReveal();
  const revealPricing = useScrollReveal();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to="/" className={styles.brand} aria-label="TradeCUE home">
          <span className={styles.logoBars}><i/><i/><i/></span>
          <span><strong>Trade<span>CUE</span></strong><small>AI TRADING WORKSTATION</small></span>
        </Link>
        <nav className={styles.nav}>
          <a href="#system">System</a>
          <a href="#workflow">How it works</a>
          <a href="#features">Tools</a>
          <a href="#pricing">Plans</a>
        </nav>
        <div className={styles.headerActions}>
          <Button variant="outline" size="sm" asChild><Link to="/login">Log in</Link></Button>
          <Button size="sm" asChild><Link to="/login?tier=copilot">Open TradeCUE</Link></Button>
        </div>
      </header>

      <main>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <Badge variant="outline" className={styles.heroBadge}><Sparkles size={13}/> TRADECUE · OMEGA · PROFESSOR CUE</Badge>
            <h1>See the chart.<br/><em>Know the trade.</em></h1>
            <p>
              Scan market opportunities, understand stock charts, plan your risk, and track paper trades
              in one AI-assisted trading workstation.
            </p>
            <div className={styles.heroActions}>
              <Button size="lg" asChild><Link to="/login?tier=copilot">Enter the command center <ArrowRight size={17}/></Link></Button>
              <Button variant="outline" size="lg" asChild><Link to="/workstation">View workstation</Link></Button>
            </div>
            <div className={styles.heroMeta}>
              <span>Paper-first training</span><span>Webull-connected</span><span>Hard risk controls</span><span>No fabricated performance</span>
            </div>
          </div>

          <div className={styles.heroTerminal}>
            <div className={styles.terminalTop}>
              <span>TRADECUE COMMAND CENTER</span>
              <Badge variant="success">PAPER TRAINING</Badge>
            </div>
            <div className={styles.terminalGrid}>
              <div className={styles.demoChart}>
                <div className={styles.demoChartHead}>
                  <div><small>NVDA · 5m</small><strong>$234.22 <span>DEMO</span></strong></div>
                  <Badge variant="warning">WAIT</Badge>
                </div>
                <div className={styles.chartCanvas}>
                  <div className={styles.gridLines}/>
                  <svg viewBox="0 0 760 300" role="img" aria-label="Illustrative TradeCUE chart">
                    <path d="M0 92 C55 105 78 168 118 151 S174 177 222 190 S297 196 351 194 S415 181 469 185 S535 167 591 158 S657 146 760 140" fill="none" stroke="var(--chart-color-1)" strokeWidth="4"/>
                    <path d="M0 74 C74 112 138 143 220 165 S383 184 492 178 S644 155 760 149" fill="none" stroke="var(--chart-color-3)" strokeWidth="3"/>
                    <line x1="0" x2="760" y1="126" y2="126" stroke="rgba(255,193,71,.75)" strokeDasharray="7 7"/>
                    <line x1="0" x2="760" y1="178" y2="178" stroke="rgba(44,220,171,.72)" strokeDasharray="7 7"/>
                    {[24,58,91,127,167,210,249,294,338,379,424,468,513,555,602,649,699,739].map((x,i)=><rect key={x} x={x} y={245-(i%5)*8} width="9" height={35+(i%5)*8} rx="2" fill={i%3===0?"rgba(255,255,255,.88)":"rgba(203,216,226,.62)"}/>)}
                  </svg>
                  <span className={styles.resistance}>RESISTANCE</span>
                  <span className={styles.support}>SUPPORT</span>
                </div>
                <div className={styles.professorStrip}>
                  <BrainCircuit size={18}/>
                  <div><small>PROFESSOR CUE</small><strong>Why Omega is waiting</strong><p>Price is below short-term resistance, momentum is mixed, and the entry location is not clean enough yet. Wait for structure + volume confirmation.</p></div>
                </div>
              </div>

              <aside className={styles.demoOmega}>
                <div className={styles.axiomHead}><Bot size={20}/><div><small>OMEGA</small><strong>CALIBRATING</strong></div><span>82+ gate</span></div>
                <div className={styles.flow}><b>SCAN</b><i>→</i><b>ENTER</b><i>→</i><b>MANAGE</b><i>→</i><b>EXIT</b></div>
                <div className={styles.demoStats}>
                  <span><small>Paper capital</small><strong>Scales to account</strong></span>
                  <span><small>Max positions</small><strong>2</strong></span>
                  <span><small>Resolved trades</small><strong>0</strong></span>
                  <span><small>Mode</small><strong>PAPER</strong></span>
                </div>
                <div className={styles.axiomRead}><Activity size={15}/><p>Protect capital first. No clean edge means no trade.</p></div>
              </aside>
            </div>
            <p className={styles.demoDisclaimer}>Illustrative interface — prices and demo metrics shown here are not live quotes or performance claims.</p>
          </div>
        </section>

        <section id="system" ref={revealSystem} className={styles.system + " " + styles.reveal}>
          <div className={styles.sectionHead}>
            <span>ONE PLATFORM · THREE CLEAR ROLES</span>
            <h2>No more dashboard full of random AI names.</h2>
            <p>TradeCUE is the platform. Omega is the trading intelligence. Professor Cue is the teacher.</p>
          </div>
          <div className={styles.roleGrid}>
            <article><Gauge size={22}/><small>THE PLATFORM</small><h3>TradeCUE</h3><p>Command center, chart, scanner, news, journal, risk, execution, strategy lab, and performance tracking.</p></article>
            <article className={styles.roleFeatured}><Bot size={22}/><small>THE OPERATOR</small><h3>Omega</h3><p>Reads setups, waits for confirmation, sizes PaperTrades, manages positions, exits when the plan breaks, and learns from resolved results.</p></article>
            <article><BrainCircuit size={22}/><small>THE TEACHER</small><h3>Professor Cue</h3><p>Explains the chart underneath the chart so you understand why the system says enter, wait, hold, or exit.</p></article>
          </div>
        </section>

        <section id="workflow" ref={revealWorkflow} className={styles.section + " " + styles.reveal}>
          <div className={styles.sectionHead}>
            <span>THE OMEGA LOOP</span>
            <h2>Read first. Risk second. Trade third.</h2>
            <p>Omega does not get rewarded for taking more trades. It records weak evidence and recommends changes, but never rewrites the approved strategy automatically.</p>
          </div>
          <div className={styles.workflow}>
            {workflow.map(({icon:Icon,step,title,text})=><article key={step}><div className={styles.stepTop}><span>{step}</span><Icon size={20}/></div><h3>{title}</h3><p>{text}</p></article>)}
          </div>
          <div className={styles.trainingBanner}>
            <ShieldCheck size={22}/>
            <div><small>PAPER CALIBRATION PROFILE</small><strong>Calibration starts conservative.</strong><p>1H + 15m trend context · 5m execution · rising EMA20 + VWAP + volume · pullback + confirmation · protected stop · 2R training target · maximum 2 simultaneous positions.</p></div>
            <Badge variant="success">CAPITAL FIRST</Badge>
          </div>
        </section>

        <section id="features" ref={revealFeatures} className={styles.section + " " + styles.reveal}>
          <div className={styles.sectionHead}>
            <span>THE COMMAND CENTER</span>
            <h2>Only tools that help make or manage a decision.</h2>
          </div>
          <div className={styles.features}>
            {featureCards.map(({icon:Icon,title,text})=><article key={title}><div className={styles.iconBox}><Icon size={20}/></div><h3>{title}</h3><p>{text}</p></article>)}
          </div>
        </section>

        <section className={styles.proof}>
          <div><CheckCircle2 size={18}/><span><strong>Paper before live</strong><small>Train without risking capital</small></span></div>
          <div><CheckCircle2 size={18}/><span><strong>Measured learning</strong><small>Expectancy, profit factor, R, streaks</small></span></div>
          <div><CheckCircle2 size={18}/><span><strong>Kill switch</strong><small>Stop automated PaperTrade entries</small></span></div>
          <div><CheckCircle2 size={18}/><span><strong>Professor underneath</strong><small>Chart explanation where it belongs</small></span></div>
        </section>

        <section id="pricing" ref={revealPricing} className={styles.section + " " + styles.reveal}>
          <div className={styles.sectionHead}>
            <span>ACCESS</span>
            <h2>Start with the workstation. Earn more automation with evidence.</h2>
            <p>Autonomous execution is currently PaperTrade training. Live-money orders remain approval-based.</p>
          </div>
          <div className={styles.pricing}>
            {plans.map(plan=><article key={plan.key} className={plan.featured?styles.featuredPlan:undefined}>
              {plan.featured&&<Badge variant="primary">COMMAND CENTER</Badge>}
              <h3>{plan.name}</h3>
              <div className={styles.price}>{plan.price}<span>/mo</span></div>
              <p>{plan.line}</p>
              <ul>{plan.features.map(feature=><li key={feature}>✓ {feature}</li>)}</ul>
              <Button variant={plan.key==="autopilot"?"secondary":"primary"} asChild><Link to={"/login?tier="+plan.key}>Open TradeCUE</Link></Button>
            </article>)}
          </div>
        </section>

        <section className={styles.finalCta}>
          <div><small>TRADECUE</small><h2>Make the system prove itself.</h2><p>Train Omega in PaperTrade, learn the chart with Professor Cue, and scale only when the journal shows a real edge.</p></div>
          <Button size="lg" asChild><Link to="/login?tier=copilot">Enter command center <ArrowRight size={17}/></Link></Button>
        </section>
      </main>
    </div>
  );
}
