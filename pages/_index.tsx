import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Bitcoin,
  BrainCircuit,
  LineChart,
  Newspaper,
  Radar,
  ShieldCheck,
  Sparkles,
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
    line: "Teach me. Help me build the habit.",
    features: ["Cue Radar Lite", "Professor Cue", "Paper trading", "Basic alerts", "Growth Path"],
  },
  {
    key: "copilot",
    name: "Copilot",
    price: "$129",
    line: "Trade beside me. Explain every decision.",
    features: ["Full Cue Radar", "Cue Vision", "Fundamental Intelligence", "Risk Firewall", "Webull-ready desk"],
    featured: true,
  },
  {
    key: "autopilot",
    name: "Autopilot",
    price: "$249",
    line: "Run my approved system with me.",
    features: ["Everything in Copilot", "Strategy Lab", "CueFutures", "CueCrypto 24/7", "Automation controls"],
  },
];

const featureCards = [
  { icon: Radar, title: "Cue Radar", text: "Scans for setups that fit your money, timeframe, risk rules, and long-only Green Gate." },
  { icon: LineChart, title: "Cue Vision", text: "Multi-timeframe chart intelligence that explains what is happening instead of just drawing lines." },
  { icon: Newspaper, title: "Fundamental Intelligence", text: "Earnings, guidance, SEC filings, analyst moves, macro events, and catalysts translated into trade impact." },
  { icon: BrainCircuit, title: "Professor Cue", text: "Learns with you in real time: why the setup matters, what could fail, and which timeframe actually matters." },
  { icon: ShieldCheck, title: "Risk Firewall", text: "No-chase logic, max risk, daily loss limits, stop planning, and a hard bias toward protecting capital." },
  { icon: Bitcoin, title: "CueCrypto", text: "A 24/7 crypto desk with the same READY / WAIT / EXTENDED framework and education layer." },
];

export default function HomePage() {
  const revealPain = useScrollReveal();
  const revealFeatures = useScrollReveal();
  const revealPricing = useScrollReveal();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to="/" className={styles.brand} aria-label="TradeCue home">
          <span className={styles.logoBars}><i /><i /><i /></span>
          <span>
            <strong>Trade<span>Cue</span></strong>
            <small>AI MARKET COPILOT</small>
          </span>
        </Link>
        <nav className={styles.nav}>
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <Link to="/login?tier=copilot">Member workstation</Link>
        </nav>
        <div className={styles.headerActions}>
          <Button variant="outline" size="sm" asChild><Link to="/login">Log in</Link></Button>
          <Button size="sm" asChild><Link to="/login?tier=copilot">Start 30-day trial</Link></Button>
        </div>
      </header>

      <main>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <Badge variant="outline" className={styles.heroBadge}><Sparkles size={13} /> AI-powered market workstation</Badge>
            <h1>Stop guessing<br />with <em>your money.</em></h1>
            <p>
              TradeCue watches the market, explains what matters, filters opportunities to your capital,
              and teaches you while you trade.
            </p>
            <div className={styles.heroActions}>
              <Button size="lg" asChild><Link to="/login?tier=copilot">Start with what I have <ArrowRight size={17} /></Link></Button>
              <Button variant="outline" size="lg" asChild><Link to="/workstation?tier=copilot">See TradeCue in action</Link></Button>
            </div>
            <div className={styles.heroMeta}>
              <span>30-day free trial</span><span>Paper first</span><span>Long-only Green Gate</span>
            </div>
          </div>

          <div className={styles.heroTerminal}>
            <div className={styles.terminalTop}>
              <span>COMMAND CENTER</span>
              <Badge variant="outline">PRODUCT PREVIEW</Badge>
            </div>
            <div className={styles.marketStrip}>
              <div><small>SPY</small><strong>Webull</strong><span>after sign-in</span></div>
              <div><small>QQQ</small><strong>Webull</strong><span>after sign-in</span></div>
              <div><small>WATCHING</small><strong>Your list</strong><span>live when connected</span></div>
            </div>
            <div className={styles.tradePanel}>
              <div className={styles.chartHead}>
                <div><small>CUE VISION • CONNECTED MARKET DATA</small><strong>Real prices after sign-in</strong></div>
                <Badge variant="outline">WAITING FOR DATA</Badge>
              </div>
              <div className={styles.chart}>
                <span className={styles.target}>TARGET 2</span>
                <span className={styles.entry}>ENTRY ZONE</span>
                <span className={styles.stop}>STOP</span>
                <svg viewBox="0 0 720 260" role="img" aria-label="Illustrative TradeCUE interface preview">
                  <path d="M0 208 C55 188 89 224 132 175 S206 182 248 148 S320 170 372 104 S462 121 518 88 S607 99 720 50" fill="none" stroke="var(--chart-color-1)" strokeWidth="5"/>
                  <path d="M0 223 C120 214 205 194 302 172 S494 135 720 102" fill="none" stroke="var(--chart-color-3)" strokeWidth="3" strokeDasharray="10 7"/>
                  <line x1="0" x2="720" y1="69" y2="69" stroke="var(--success)" strokeDasharray="7 7"/>
                  <line x1="0" x2="720" y1="217" y2="217" stroke="var(--error)" strokeDasharray="7 7"/>
                </svg>
              </div>
              <div className={styles.aiNote}>
                <BrainCircuit size={18} />
                <div><strong>Professor Cue</strong><p>When Webull is connected, this panel explains the current chart, what confirms an entry, what blocks it, and where risk changes the decision.</p></div>
              </div>
            </div>
          </div>
        </section>

        <section ref={revealPain} className={styles.problemGrid + " " + styles.reveal}>
          <article><small>THE PAIN</small><h2>Noise makes money feel harder than it is.</h2><p>Too many opinions, too many indicators, and no clear reason to act or wait.</p></article>
          <article><small>THE RELIEF</small><h2>Cue tells you what matters now.</h2><p>Price, fundamentals, news, risk, timeframe, and capital fit become one clear decision.</p></article>
          <article><small>THE GOAL</small><h2>Build skill before you scale size.</h2><p>Protect the bag, learn the setup, track your growth, and earn the right to take more risk.</p></article>
        </section>

        <section id="features" ref={revealFeatures} className={styles.section + " " + styles.reveal}>
          <div className={styles.sectionHead}>
            <span>ONE ENGINE • MULTIPLE WORKSTATIONS</span>
            <h2>Stocks, ETFs, crypto, futures — taught by the same Cue brain.</h2>
          </div>
          <div className={styles.features}>
            {featureCards.map(({ icon: Icon, title, text }) => (
              <article key={title}>
                <div className={styles.iconBox}><Icon size={20} /></div>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
          <div className={styles.marketFamily}>
            <div><BarChart3 size={18} /><strong>CueStocks</strong><span>Stocks + ETFs</span></div>
            <div><Bitcoin size={18} /><strong>CueCrypto</strong><span>24/7 crypto</span></div>
            <div><TrendingUp size={18} /><strong>CueFutures</strong><span>Futures workstation</span></div>
            <div><ShieldCheck size={18} /><strong>CueOptions</strong><span>Advanced access</span></div>
          </div>
        </section>

        <section id="pricing" ref={revealPricing} className={styles.section + " " + styles.reveal}>
          <div className={styles.sectionHead}>
            <span>THE CHEVY CONCEPT</span>
            <h2>Same engine. Different trim.</h2>
            <p>Every plan runs on TradeCue. Higher tiers unlock deeper intelligence, more markets, and more control.</p>
          </div>
          <div className={styles.pricing}>
            {plans.map((plan) => (
              <article key={plan.key} className={plan.featured ? styles.featuredPlan : undefined}>
                {plan.featured && <Badge variant="primary">MOST POPULAR</Badge>}
                <h3>{plan.name}</h3>
                <div className={styles.price}>{plan.price}<span>/mo</span></div>
                <p>{plan.line}</p>
                <ul>{plan.features.map((feature) => <li key={feature}>✓ {feature}</li>)}</ul>
                <Button variant={plan.key === "autopilot" ? "secondary" : "primary"} asChild>
                  <Link to={"/login?tier=" + plan.key}>Start 30-day free trial</Link>
                </Button>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

