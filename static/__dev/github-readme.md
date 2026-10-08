# TradeCUE

TradeCUE is a premium market-intelligence and Webull PaperTrade workstation focused on real market data, transparent rule-based decision support, risk controls, education, and paper-first execution.

## Live app
https://cuetrade.floot.app

## Current working core
- Email/password authentication with protected member and owner/admin routes
- Scout, Copilot, and Autopilot entitlements
- Owner coupon engine; `TRADECUE2026` currently grants 90 days of Autopilot access when redeemed
- Webull PaperTrade/OpenAPI account, balance, position, chart, screener, order-preview, paper-order, order-history, and cancel integration
- Webull V2 stock order endpoints with a broker preview check before paper-order submission
- Market Wall: SPY, QQQ, IWM, DIA, gainers, losers, most-active names, and breadth
- Cue Vision: Candles, Heikin-Ashi, OHLC, Kill Zones, VWAP, Volume, EMA, SMA, Bollinger Bands, RSI, MACD, ATR
- Professor Cue contextual chart coach that explicitly reads the currently loaded ticker/timeframe
- TradeCUE cheat sheet: Entry Ready / Wait / Hold / Exit Review with failing/passing checks
- CUE Intelligence v1: 5m + 15m + 1H + 1D alignment, composite technical score, SPY context, freshness gating
- Cue Hunter Auto Hunt: combines Webull activity, momentum, and pullback lists, then evaluates real 5-minute bars
- Strict Entry Ready gating: fresh data + BUY state + score + trend + setup + volume confirmation
- Position Sentinel: monitors open Webull paper positions for Hold / Watch / Exit Review / Data Check states
- Position-size/risk planner
- Persistent watchlist
- Human-readable API error handling so raw JSON/HTML parser errors are not exposed in the workstation
- Stale-data protection that suppresses actionable intraday entry levels

## Safety / product rule
TradeCUE does not guarantee profit. CUE Scores are rule-based setup scores, not probabilities of winning. Live-money autonomous execution is disabled. Current order controls are Webull PaperTrade only.

## External integrations still required
- Financial Modeling Prep or approved fundamental-news provider
- Tradovate partner/API credentials for CueFutures
- Production Stripe configuration
- Production email provider for password reset/notifications
- Webull Connect/partner approval for a consumer OAuth-style brokerage connection

## Local / deployment environment
Never commit credentials. Use the variables listed in `.env.example`.

This repository is a source mirror of the TradeCUE application currently deployed with Floot.
