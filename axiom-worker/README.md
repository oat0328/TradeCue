# Axiom paper background runner

This separate Node 22 worker calls the authenticated TradeCUE backend serially. TradeCUE remains hosted on Floot. No broker secrets, passwords, database credentials, or cash-order endpoint belong in this worker.

Start: `node axiom-worker/index.mjs`. Tests: `node --test axiom-worker/runtime.test.mjs`.

Required environment: `AXIOM_WORKER_TOKEN`, issued through the administrator-only TradeCUE worker-access route. Store it only as a Render secret. The database stores its hash. Revoke it from TradeCUE to stop access.

`TRADECUE_BASE_URL` defaults to `https://www.gettradecue.com`. `AXIOM_DRY_RUN` defaults to `true`. Keep observation mode until publication, broker protection, current data, heartbeat, and paper-order acceptance checks have passed. Setting this to false cannot bypass server-side execution permission, arming, kill switch, session hours, protection alerts, or risk limits.

Successful checks run every 30 seconds during regular market hours and five minutes outside the session. Failures back off. Only one HTTP request is in flight. SIGTERM stops the loop and lets the current request finish; Render shutdown grace should be 120 seconds.

A recent check-in proves connectivity, not continuous uptime or profitability. Observe mode submits no orders. Missing macro data and unprotected positions continue to block buys.

Deployment: Render Background Worker in the approved My Workspace, one instance, Oregon, Node 22, build `node --test axiom-worker/runtime.test.mjs`, start `node axiom-worker/index.mjs`. The smallest worker plan is paid; approve the displayed recurring charge before creation. Do not use a free web service as an always-on workaround.

