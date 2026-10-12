# TradeCUE

TradeCUE is a premium AI-assisted trading workstation built around real Webull PaperTrade/OpenAPI data, multi-timeframe market intelligence, explainable decision support, risk controls, and paper-first execution.

## Live app
https://cuetrade.floot.app

## Current working core
- Email/password authentication with protected member and owner/admin routes
- Scout, Copilot, and Autopilot membership entitlements
- Owner coupon engine; `TRADECUE2026` supports promotional access
- Webull PaperTrade/OpenAPI account, balance, position, chart, screener, order-preview, paper-order, historical-order, and cancel integration
- Current Webull trading routes under `/trading/orders/...`
- Market Wall: SPY, QQQ, IWM, DIA, gainers, losers, most-active names, and breadth
- Cue Vision: Candles, Heikin-Ashi, OHLC, Kill Zones, VWAP, Volume, EMA, SMA, Bollinger Bands, RSI, MACD, ATR
- Professor Cue explicitly reads the currently loaded ticker and timeframe
- Current-chart cheat sheet: BUY / WAIT / HOLD / EXIT with pass/fail checks
- CUE Intelligence: 5m + 15m + 1H + 1D alignment, composite technical score, market context, and freshness gating
- Cue Hunter Auto Hunt: Webull activity + momentum + pullback discovery, then 5m + 15m + 1H deep evaluation
- Entry Ready gating uses freshness, trend, setup, volume, multi-timeframe confirmation, and QQQ context
- Position Sentinel monitors open Webull paper positions for Hold / Watch / Exit Review / Data Check
- Position-size/risk planner and persistent watchlists
- Human-readable API errors and stale-data protection

## Product rule
TradeCUE does **not** guarantee profit. `ENTRY READY` means the current rule set is satisfied on available data; it is not a promise that the trade will win. Live-money autonomous execution is disabled. Paper trading comes first.

## External integrations still required
- Approved fundamental/news provider such as Financial Modeling Prep
- Tradovate partner/API credentials for CueFutures
- Production Stripe configuration
- Production email provider for password reset/notifications
- Webull Connect/partner approval for a consumer OAuth-style brokerage connection

## Secrets
Never commit credentials. Use environment variables listed in `.env.example`.

## Development workflow
TradeCUE is GitHub-first:

1. Build and review code in this repository.
2. Sync the changed source files into Floot project `68777a84-59fb-4e1d-8f5e-99e526f02f78`.
3. Run Floot typecheck/tests and preview QA.
4. Publish to https://cuetrade.floot.app.
5. If a hotfix is made directly in Floot, sync it back here immediately.

See `docs/FLOOT_DEPLOYMENT.md` for the release checklist.

This repository is the **canonical source of truth** for TradeCUE. Floot is the deployment/runtime layer for the production app.


## Data audit

Validated against the connected Webull PaperTrade/OpenAPI sandbox on 2026-10-03:
- Accounts, balances/positions rails, bars, snapshots, and screeners respond successfully.
- Webull company profiles, analyst ratings, target prices, EPS forecasts, filings, earnings calendars, capital flows, financial alerts, and indicator fundamentals respond successfully.
- TradeCUE technical scores are computed locally from Webull candles; they are not broker-supplied win probabilities.
- Heikin-Ashi, EMA/RSI/ATR, support/resistance, session ranges, entry/stop/target overlays, and CUE states are derived analytics built from the underlying Webull data.
- Financial Modeling Prep news is not connected until FMP_API_KEY is configured.

## Omega Predictive Brain (new research package)

The feature branch includes a read-only prediction laboratory in the workstation: choose **Omega → Chronos-2, Kronos, NeuralForecast/NHITS, or Baseline Lab**. The baseline lab calculates walk-forward next-1/3/12-bar price estimates, interval coverage, next-bar directional hit rates, and synchronized SPY/QQQ correlation from available broker candles.

- `helpers/omegaForecastResearch.tsx` — transparent non-AI baselines with historical holdout comparisons.
- `helpers/omegaIntermarket.tsx` — contemporaneous cross-market context (not causality).
- `endpoints/forecast/research_GET.ts` — authenticated Webull research endpoint, optional authenticated Python inference.
- `components/OmegaForecastPanel.tsx` — real research readout and explicit model readiness.
- `services/omega_forecasting/` — isolated optional adapters for Chronos-2, Kronos and NHITS. See its README for model installation, privacy and infrastructure requirements.
- `helpers/omegaGenius.tsx` — read-only multi-timeframe 20-EMA risk review.

**Status:** The baseline uses real candles only when Webull can authenticate and supply data. External AI model weights are not installed/deployed by committing code; missing integrations show unavailable. No synthetic prediction, win rate or broker order is produced. All universal-market live execution remains disabled. Model output must pass out-of-sample validation and independent risk checks before it could inform even a paper-order decision.

**Deployment note:** The existing Floot-specific source repository is not a ready-to-deploy standalone Vite application; an external Vercel setup needs a complete frontend/backend build, a production API runtime, database wiring and its own validation. Do not assume Vercel previews are production-ready merely because GitHub pushes trigger them.
