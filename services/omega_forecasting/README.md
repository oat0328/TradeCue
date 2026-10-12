# Omega model service — optional research worker

This is a **separate Python service**, not a Vercel browser bundle. It accepts broker-provided 5-minute OHLCV candles forwarded by TradeCUE's **authenticated server** and returns research-only model forecasts. It never submits brokerage orders. Model inference is *not installed or deployed merely because these files exist in GitHub*.

## Models
- Chronos-2: optional `chronos-forecasting`; default smaller model `autogluon/chronos-2-small`; set `OMEGA_CHRONOS_MODEL=amazon/chronos-2` to use the 120M model after testing the resource budget. 10th/50th/90th quantiles are *uncalibrated on trading data*.
- Kronos: optional official `shiyu-coder/Kronos` source on `PYTHONPATH` with vetted dependencies, `NeoQuasar/Kronos-small` model and tokenizer. Returns only point estimates. Do not clone/install untrusted sources during an HTTP request.
- NHITS: optional `neuralforecast`; request-scoped training with a step limit, expensive on CPU; not comparable to pretrained zero-shot inference. CPU queue recommended.

## Running locally
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r services/omega_forecasting/requirements.txt
# Optional on a dedicated ML runner: pip install -r services/omega_forecasting/requirements-models.txt
export OMEGA_FORECAST_SERVICE_KEY='<strong random server-only key>'
export OMEGA_ENABLE_CHRONOS2=1 # only after installing and validating
uvicorn services.omega_forecasting.app:app --host 127.0.0.1 --port 8000 --workers 1
```

In the TradeCUE server environment configure:
- `OMEGA_FORECAST_URL`: private model service base HTTPS URL.
- `OMEGA_FORECAST_SERVICE_KEY`: same random server-only value.
No token should be put in the frontend, docs, logs, or GitHub. Never allow unauthenticated public inference (compute bill / denial-of-service risk).

## Before enabling any model
1. Install libraries in an isolated worker, review source/model licenses and license changes, pin/test versions.
2. Validate accuracy across out-of-sample chronological holdout data, compare against the transparent baselines in `helpers/omegaForecastResearch.tsx`, test different regimes, all relevant costs, and stability.
3. Record model ID, source timestamp, instrument, currency, bar intervals, data provenance, point/interval calibration. Weekend and holiday bars must be generated from a real exchange calendar before presenting timestamped future candles.
4. Limit workloads and add a queue/cache, account quotas, model-resource monitoring, alerts, retries, and rollback before production activation.
5. Backtests must use full model inference at each historical origin; today's model prediction must never be inserted as if available in the past.
6. Cross-market covariates can be added only when contemporaneous histories have aligned timestamps and are available at prediction time (no future leakage).
7. Broker order routing must remain separate. Futures/options/FX/crypto require instrument-specific provider adapters and permissions.

## Related official sources
- https://github.com/amazon-science/chronos-forecasting
- https://github.com/shiyu-coder/Kronos
- https://github.com/Nixtla/neuralforecast

This is **research code**, not evidence of a profitable algorithm.
