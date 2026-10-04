# TradeCUE GitHub → Floot workflow

GitHub is the canonical TradeCUE source repository.

**Canonical repository:** `oat0328/TradeCue`  
**Production app:** https://cuetrade.floot.app  
**Floot project:** `68777a84-59fb-4e1d-8f5e-99e526f02f78`

## Source-of-truth rule

1. Make product/code changes in GitHub first.
2. Do not commit secrets.
3. Sync the changed source files into the Floot project.
4. Run Floot typecheck and automated tests.
5. Test the Floot preview.
6. Publish the Floot project to production.
7. If an emergency fix is made directly in Floot, immediately sync the exact changed files back to GitHub before the next feature build.

## Secrets

These stay only in deployment/runtime configuration, never in GitHub:

- `FLOOT_DATABASE_URL`
- `JWT_SECRET`
- `WEBULL_APP_KEY`
- `WEBULL_APP_SECRET`
- `STRIPE_SECRET_KEY`
- `FMP_API_KEY`
- `TRADOVATE_CLIENT_ID`
- `TRADOVATE_CLIENT_SECRET`
- `RESEND_API_KEY`

## Pre-publish checklist

- TypeScript/typecheck passes.
- Automated chart/signal/API tests pass.
- No `qa-*` audit endpoints remain.
- No credentials appear in source.
- Webull data failures render a human-readable unavailable/rate-limit state.
- Stale stock-market data cannot create an actionable intraday ENTRY READY state.
- Paper and live-money execution states are visibly distinct.
- Current GitHub commit is recorded in the release notes/checkpoint.
- Floot preview is checked before production publish.

## Webull traffic policy

TradeCUE centralizes Webull reads through the request layer in `helpers/webullClient.tsx`.

- Coalesce identical in-flight GET requests.
- Cache bars/snapshots/screeners for short windows.
- Cache fundamentals longer.
- Back off and retry on `429 / TOO_MANY_REQUESTS`.
- Avoid one Webull request per visible UI card when a batch call exists.
- Keep the chart responsive without letting every panel poll independently at high frequency.

## Release sequence

```
GitHub main
   ↓
Sync changed files to Floot
   ↓
Floot typecheck + tests
   ↓
Floot preview QA
   ↓
Publish cuetrade.floot.app
```

If Floot build actions are temporarily exhausted, continue development in GitHub. Publish only after the source has been synced and verified in Floot.
