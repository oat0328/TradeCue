TradeCue architecture

Frontend:
- / landing page with pain -> relief -> financial freedom positioning and three pricing trims.
- /login production email/password auth plus a no-account product preview path.
- /workstation interactive demo/member command center with Cue Radar, Cue Vision, timeframes, Fundamental Intelligence, CueCrypto, CueFutures, Risk Firewall, and automation locks.
- Cue Vision supports Standard Candles, Heikin-Ashi and OHLC Bars plus configurable Asia/London/New York kill-zone/session overlays. Kill zones are context overlays, not automatic trade signals.
- /admin owner-only operations console.

Backend:
- Floot Postgres + session auth.
- user_memberships: Scout/Copilot/Autopilot, trial status, trial dates.
- risk_profiles: max risk/trade, daily loss, max trades, long-only, Green Confirmation, no-chase, safe mode, 12:30 PT day-trade flat rule.
- broker_connections: Webull + Tradovate.
- user_workspaces: morning hunt, day trader, swing, long-term, crypto 24/7, futures, news, end-of-day.
- watchlist_items, fundamental_events, cue_audit_log.
- GET /_api/me/entitlements returns real backend tier/features/risk/brokers/workspaces.
- GET /_api/fundamentals/brief?symbol=... uses FMP + gpt-6-luna for live plain-English fundamental intelligence. FMP_API_KEY credential request may still be pending.
- GET /_api/admin/overview returns live owner metrics.

Access model:
- New registrations receive a 30-day Copilot trial.
- Logged-in workstation tier comes from backend entitlements; public preview can switch trims for demonstration.
- Admin page is protected by admin role; customer trading permissions and platform administration remain separate.

Planned integrations:
- Webull Connect OAuth/API scaffold is implemented in sandbox mode: secure state validation, encrypted broker tokens, Connect Webull/Disconnect controls, broker status in entitlements, account lookup after authorization, and audit logs. Live authorization requires Webull-issued Connect credentials and an exact registered callback URL.
- Tradovate Partner/API for CueFutures.
- Stripe billing once payment resource/account setup is available.
- Live charting/market data and order execution are not yet connected; current market prices/charts on public preview are clearly demo content.

Design:
- Precision AI trading cockpit; dark navy-black, electric cyan, emerald positive states, amber caution, rose risk.
- Bricolage Grotesque display, IBM Plex Sans UI, IBM Plex Mono numbers.
   35

Latest chart and brokerage updates:
- Cue Vision now includes Standard Candles, Heikin-Ashi, and OHLC Bars.
- Kill-zone overlays were added with Asia, London, New York AM, London Close, and New York PM presets labeled in ET. The overlays are context tools, not trade signals, and can be toggled by session.
- Webull Connect OAuth is wired behind Copilot/Autopilot membership access using server-side credentials, hashed OAuth state, encrypted broker tokens, and audit logging.
- Webull sandbox callback path: /_api/webull/callback.
- The member workstation now shows Webull connection status and connect/disconnect controls. Public demo users are sent to sign in first; Scout shows Copilot required.
- Live Webull account authorization still depends on Webull-issued Connect API credentials being supplied through Floot's secure credential connection flow.
