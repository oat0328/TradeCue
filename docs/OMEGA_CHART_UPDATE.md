# Omega chart and account update

Saved Floot source snapshot: project 68777a84-59fb-4e1d-8f5e-99e526f02f78, version 1791423137500.

The repository was behind the Floot app. This source sync includes the current runtime files required by the workstation, Omega account/data checks, verified trade ledger, and filled-trade chart overlays. Existing repository documentation, CI and configuration are retained. Floot design-system examples and account/database records are excluded.

## Chart behavior

- Cyan entry arrow at the recorded broker entry average and containing candle.
- Green profitable-sale or red losing-sale arrows for individual verified exit allocations.
- Dashed entry-to-exit connections, a trade selector, and Show entry & exits zoom control.
- Gross realized result from sold shares only; fees and unrealized holdings are excluded.
- Authenticated user, selected paper account and symbol scope; only loaded candle locations are plotted.
- Plans remain labeled separately from actual fills. No profit is inferred from a target.

## Validation and release state

Floot project typecheck passed. chartTradeFills, chartContext and cueLotLedger suites passed. Illustrative preview DOM verified a $110 average entry, two five-share sales at $112 and $114, and +$30 gross realized result. Prior Omega account/data checks passed their targeted tests and the worker reported MATCHED reconciliation.

The chart feature is saved but NOT published: Floot rejected publishing because hosting credits were depleted. GitHub source synchronization does not deploy the application or migrate database tables. The runtime still relies on Floot-provided SDK modules, scheduled jobs and the configured database schema.

The standalone GitHub CI uses Vitest, while Floot executes Jasmine specs and injects platform SDKs. Its result must be inspected separately; Floot validation is not a claim that standalone CI or a self-hosted deployment works.
