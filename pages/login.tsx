import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, CheckCircle2, PlayCircle, ShieldCheck } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/Tabs";
import { Button } from "../components/Button";
import { PasswordLoginForm } from "../components/PasswordLoginForm";
import { PasswordRegisterForm } from "../components/PasswordRegisterForm";
import styles from "./login.module.css";

const planNames: Record<string, string> = {
  scout: "Scout",
  copilot: "Copilot",
  autopilot: "Autopilot",
};

export default function LoginPage() {
  const [params] = useSearchParams();
  const requestedTier = params.get("tier") || "copilot";
  const requestedName = planNames[requestedTier] || "Copilot";

  return (
    <div className={styles.page}>
      <Link to="/" className={styles.brand}><span>///</span>Trade<strong>Cue</strong></Link>

      <div className={styles.grid}>
        <section className={styles.pitch}>
          <span className={styles.kicker}>30-DAY FREE TRIAL</span>
          <h1>Start with the full<br /><em>TradeCue Copilot.</em></h1>
          <p>Your trial starts with Copilot intelligence so you can experience Cue Radar, Cue Vision, Fundamental Intelligence, Professor Cue, Growth Path and Risk Firewall before choosing a paid trim.</p>

          <div className={styles.selectedPlan}>
            <small>You came from</small>
            <strong>{requestedName}</strong>
            <span>New trials begin with Copilot access for 30 days.</span>
          </div>

          <div className={styles.benefits}>
            <div><CheckCircle2 size={17} /><span><strong>Paper first</strong><small>Learn the workstation before risking capital.</small></span></div>
            <div><ShieldCheck size={17} /><span><strong>Risk Firewall</strong><small>Long-only, no-chase and daily loss controls are built in.</small></span></div>
            <div><PlayCircle size={17} /><span><strong>Live member workstation</strong><small>Sign in to load your own Webull data, market wall, positions and CUE signals.</small></span></div>
          </div>

          <Button variant="outline" asChild><Link to="#member-access">Sign in to open workstation <ArrowRight size={16} /></Link></Button>
        </section>

        <section className={styles.authCard} id="member-access">
          <div className={styles.authHead}>
            <span>MEMBER ACCESS</span>
            <h2>Enter TradeCue</h2>
            <p>Create an account or return to your workstation.</p>
          </div>

          <Tabs defaultValue="register">
            <TabsList className={styles.tabsList}>
              <TabsTrigger value="register">Start free trial</TabsTrigger>
              <TabsTrigger value="login">Log in</TabsTrigger>
            </TabsList>
            <TabsContent value="register" className={styles.tabContent}>
              <PasswordRegisterForm />
            </TabsContent>
            <TabsContent value="login" className={styles.tabContent}>
              <PasswordLoginForm />
            </TabsContent>
          </Tabs>

          <p className={styles.legal}>TradeCue is an educational trading technology platform. Trading involves risk, and no result is guaranteed.</p>
        </section>
      </div>
    </div>
  );
}

