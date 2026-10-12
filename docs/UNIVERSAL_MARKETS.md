# TradeCUE Universal — multi-asset expansion plan

**Intent:** A user can choose what they wish to analyze or trade: stocks/ETFs, options, forex, gold/metals, crypto, futures, and later eligible fixed-income products. **This document is a feature plan, not a claim that integrations are live.**

## Product principles
- **One Omega interface, distinct market adapters.** Normalize symbols, market sessions, currencies, price precision, order types, minimum order sizes, account permissions, margin, and contract multipliers.
- **Data does not imply execution.** Search and charts can show an instrument without enabling a buy/sell order. The order controls show a provider-specific disabled reason until connectivity, permissions, and trading support are confirmed.
- **Paper first.** Preserve existing Webull paper-stock pathways; do not pass non-stock orders through equity-only functions. No real-money autonomous execution is enabled by this feature.
- **User choice, not forced automation.** Users pick market, instrument, timeframe, educational/manual/alerts-only/paper modes, permitted strategies, daily risk, and trading hours. Live trading must require separate provider work, opt-in, and independent controls.
- **Universal means extensible, not literally every instrument.** Users can select any asset that a verified integrated provider supports in their country and account type. Do not claim universal real-time quotes or order execution.

## Omega market playbooks
| Family | Examples | Chart / entry logic | Risk model |
|---|---|---|---|
| US stocks & ETFs | SPY, QQQ, TSLA | 20 EMA pullback, 5m confirmation, VWAP, volume, 15m/1H trend | share size, trading session, spreads |
| FX | EUR/USD, GBP/USD, USD/JPY | trend, session structure, economic events, spread and volatility | pip value, lot size, account currency, leverage |
| Crypto spot | BTC/USD, ETH/USD | momentum, exchange liquidity, round-the-clock volatility | quantity steps, fees, market uptime, exchange risks |
| Gold & metals | MGC/GC futures, GLD ETF | macro events, volume, contract/ETF-specific structure | futures tick value and margin **or** ETF shares |
| Listed options | calls/puts/spreads | underlying setup, IV, Greeks, spread/strike/expiry | premiums, multiplier, max loss and assignment risk |
| Futures | MES, MNQ, CL | session/contract trend, support/resistance, scheduled reports | tick size/value, expiry, margin, overnight exposure |
| Fixed income | eligible bonds/funds | yields, duration, spread and liquidity | face value, accrued interest, duration |

## Connector architecture
1. **Instrument discovery** uses a provider catalog: broker symbol, normalized instrument ID, class, exchange, currency, hours, tick size, quantity increment, minimum notional, expiry/strike/option-right if applicable, futures multiplier, and supported order types.
2. **Market data** streams quotes/bars and records source, timestamp, entitlement, and stale status; respect exchange market-data licenses.
3. **Broker adapter** supplies account permissions, paper/live environments, order preview, submit, amend, cancel, balances, and position reconciliation.
4. **Omega strategy adapter** generates explainable ENTER/WAIT/EXIT suggestions with timeframe agreement and market-specific calculations. Signals are not promises of win rate.
5. **Risk firewall** enforces per-trade loss, maximum daily drawdown, stale feeds, max concurrent positions, spread/slippage checks, event risk, trade cutoffs, kill switch, and no unsupported leverage. Stops may slip, gap, or fail to fill.
6. **Order management and audit** idempotency, duplicate-order protection, websocket reconnect, timeouts, position sync, fill reports, journaling and backtesting without look-ahead bias.

## Suggested providers to evaluate
- **Interactive Brokers**: broad stocks/options/futures/FX support with account permissions and API setup.
- **Alpaca**: stock, options, crypto, and paper API where eligible.
- **OANDA**: forex/API where supported by regional entity/account type.
- **Coinbase Advanced**: crypto market data and execution API.
- **Existing Webull**: retain stock paper-trading connection; verify product-by-product support rather than assume forex/futures/options authorization.
Providers, permissions, rate limits, costs, and legal constraints must be validated before connecting. The first step is separate watch/analysis feeds, followed by testable paper-execution adapters.

## Implementation milestones
1. **Foundation (this PR):** explicit catalog, provider capability gate, market playbook contract, and unit tests; **no real trading changes**.
2. Multi-market instrument search, symbol detail panel, source freshness badges, watchlists, and market picker.
3. Read-only provider connections and streaming historical/live data integration with normalized models.
4. Paper order tickets per asset class with unit-aware stops, targets, sizing, risk and audit tests.
5. Paper automation with position monitor, emergency stop, scheduled economic/news filters, daily Omega grading.
6. Controlled broker-approved live support only after security, jurisdiction/compliance, consumer consent, and independent risk controls are validated.

## Acceptance criteria
- Switching markets never sends a previous market's order by mistake.
- Disabled buttons explain why trading is unavailable.
- Currency conversion, futures multipliers, forex pips/lots, options premiums/assignment, and crypto increments are calculated correctly.
- Every order is attributable to user, account, provider, instrument, mode and strategy.
- Paper data is isolated from live accounts.
- Failed or stale providers cannot open positions.
- Live universal-market execution is disabled by default.
