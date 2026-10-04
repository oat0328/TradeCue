# TradeCUE product truth contract

TradeCUE must distinguish provider data from TradeCUE-derived intelligence.

## Provider data

When connected, these values originate from Webull PaperTrade/OpenAPI:

- quotes and bars
- account balances and buying power
- positions
- screeners
- order preview / paper orders / order history / cancel
- supported company/fundamental endpoints

External news is only shown as connected when a real provider is configured.

## TradeCUE-derived analytics

These are calculated by TradeCUE from provider data:

- CUE Score
- BUY / WAIT / HOLD / STAY AWAY / EXIT REVIEW
- EMA / SMA / RSI / ATR / MACD / Bollinger interpretations
- support / resistance
- session and kill-zone overlays
- entry zone / stop / targets
- multi-timeframe alignment
- risk-sized share recommendations

A CUE Score is not a win probability. `ENTRY READY` is not a guarantee of profit.

## Market-learning rule

TradeCUE should ingest and learn from the broad market, including winners, losers, failed setups, stopped-out setups, and non-actionable conditions. The UI may rank the strongest qualified opportunities, but the engine should not train itself only on winners.

## Execution rule

TradeCUE is paper-first. Customer cash remains at the broker. Live-money execution must remain disabled until the supported broker authorization and product controls are actually implemented and verified.
