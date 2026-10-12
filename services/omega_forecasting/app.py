"""Omega predictive research service. Authenticated, opt-in, no broker/order functions.

Install base requirements and each desired model's dependencies separately.
No silent fallback: uninstalled/disabled engines return HTTP 503.
Predictions are uncalibrated research, not trading recommendations.
"""
from __future__ import annotations
import math
import os
import secrets
from functools import lru_cache
from typing import Literal
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field, model_validator

ModelId = Literal["chronos2", "kronos", "nhits"]
app = FastAPI(title="Omega Forecast Research", version="0.1.0", docs_url=None, redoc_url=None)

class Candle(BaseModel):
    time: str
    open: float = Field(gt=0)
    high: float = Field(gt=0)
    low: float = Field(gt=0)
    close: float = Field(gt=0)
    volume: float = Field(ge=0)

    @model_validator(mode="after")
    def check(self):
        if not all(math.isfinite(x) for x in (self.open,self.high,self.low,self.close,self.volume)):
            raise ValueError("Non-finite market data")
        if self.high < max(self.open,self.close) or self.low > min(self.open,self.close):
            raise ValueError("Inconsistent OHLC values")
        return self

class ForecastRequest(BaseModel):
    symbol: str = Field(pattern=r"^[A-Z0-9.-]{1,15}$")
    model: ModelId
    horizon: int = Field(default=12,ge=1,le=12)
    bars: list[Candle] = Field(min_length=100,max_length=450)

    @model_validator(mode="after")
    def chronology(self):
        import datetime
        parsed=[]
        for bar in self.bars:
            stamp=datetime.datetime.fromisoformat(bar.time.replace("Z","+00:00"))
            if stamp.tzinfo is None: raise ValueError("Timezone required")
            parsed.append(stamp)
        if any(a>=b for a,b in zip(parsed,parsed[1:])):
            raise ValueError("Bars must be sorted without duplicate timestamps")
        return self

class ForecastPoint(BaseModel):
    horizonBars: int
    median: float = Field(gt=0)
    lower: float | None = Field(default=None,gt=0)
    upper: float | None = Field(default=None,gt=0)

class ForecastResult(BaseModel):
    model: ModelId
    source: str
    points: list[ForecastPoint]
    executionAllowed: Literal[False] = False

def authenticate(x_omega_service_key: str | None = Header(default=None)):
    expected=os.environ.get("OMEGA_FORECAST_SERVICE_KEY")
    if not expected or not x_omega_service_key or not secrets.compare_digest(x_omega_service_key,expected):
        raise HTTPException(status_code=401,detail="Unauthorized model request")

@app.get("/health")
def health():
    return {"status":"up","availableModels":[m for m in ("chronos2","kronos","nhits")
        if os.environ.get("OMEGA_ENABLE_"+m.upper())=="1"],"note":"Enabled does not imply weights loaded or forecasts validated."}

def check_enabled(model: ModelId):
    if os.environ.get("OMEGA_ENABLE_"+model.upper())!="1":
        raise HTTPException(status_code=503,detail=model+" is not enabled")

def require_packages(model: ModelId):
    # Only installed and explicitly enabled model implementations run.
    check_enabled(model)

@lru_cache(maxsize=1)
def load_chronos():
    from chronos import Chronos2Pipeline
    return Chronos2Pipeline.from_pretrained(
        os.getenv("OMEGA_CHRONOS_MODEL","autogluon/chronos-2-small"),
        device_map=os.getenv("OMEGA_MODEL_DEVICE","cpu"),
    )

def chronos2(req:ForecastRequest):
    import numpy as np
    pipeline=load_chronos()
    # No cross-asset covariates are guessed or future market data synthesized.
    historical=np.asarray([c.close for c in req.bars],dtype=np.float32)
    q,_=pipeline.predict_quantiles([historical],prediction_length=req.horizon,quantile_levels=[0.1,0.5,0.9])
    values=q[0].detach().cpu().numpy()[0] # [horizon, 3]
    points=[]
    for i in (1,3,req.horizon):
        if i>req.horizon or any(p.horizonBars==i for p in points):continue
        lower,median,upper=[float(v) for v in values[i-1]]
        points.append(ForecastPoint(horizonBars=i,median=median,lower=min(lower,median),upper=max(upper,median)))
    return points,os.getenv("OMEGA_CHRONOS_MODEL","autogluon/chronos-2-small")

@lru_cache(maxsize=1)
def load_kronos():
    # Only load reviewed official Kronos code from the PYTHONPATH, never runtime Git clones.
    from model import Kronos, KronosTokenizer, KronosPredictor
    model=Kronos.from_pretrained("NeoQuasar/Kronos-small")
    tokenizer=KronosTokenizer.from_pretrained("NeoQuasar/Kronos-Tokenizer-base")
    return KronosPredictor(model,tokenizer,max_context=512)

def kronos(req:ForecastRequest):
    import pandas as pd
    predictor=load_kronos()
    rows=pd.DataFrame([c.model_dump() for c in req.bars])
    x_times=pd.to_datetime(rows["time"],utc=True)
    # Synthetic future indexes are bar positions only; not market-session timestamps.
    future=pd.date_range(x_times.iloc[-1]+pd.Timedelta(minutes=5),periods=req.horizon,freq="5min",tz="UTC")
    pred=predictor.predict(df=rows[["open","high","low","close","volume"]],
        x_timestamp=x_times,y_timestamp=pd.Series(future),pred_len=req.horizon,
        T=1.0,top_p=0.9,sample_count=1)
    points=[]
    for i in (1,3,req.horizon):
        if i>req.horizon or any(p.horizonBars==i for p in points):continue
        points.append(ForecastPoint(horizonBars=i,median=float(pred.iloc[i-1]["close"])))
    return points,"NeoQuasar/Kronos-small (point estimates only)"

def nhits(req:ForecastRequest):
    import pandas as pd
    from neuralforecast import NeuralForecast
    from neuralforecast.models import NHITS
    # CPU-heavy per-request training is intended only for a single authenticated research worker.
    history=[c.close for c in req.bars]
    frame=pd.DataFrame({"unique_id":req.symbol,"ds":pd.date_range(
        "2020-01-01",periods=len(history),freq="5min"),"y":history})
    model=NeuralForecast(models=[NHITS(h=req.horizon,input_size=min(96,len(history)//2),
        max_steps=50,scaler_type="robust",enable_progress_bar=False)],freq="5min")
    model.fit(df=frame)
    values=model.predict()["NHITS"].to_numpy()
    points=[]
    for i in (1,3,req.horizon):
        if i>req.horizon or any(p.horizonBars==i for p in points):continue
        points.append(ForecastPoint(horizonBars=i,median=float(values[i-1])))
    return points,"Nixtla NeuralForecast NHITS (trained on submitted data; not prevalidated)"

@app.post("/forecast",response_model=ForecastResult,dependencies=[Depends(authenticate)])
def forecast(request:ForecastRequest):
    require_packages(request.model)
    try:
        if request.model=="chronos2": points,source=chronos2(request)
        elif request.model=="kronos": points,source=kronos(request)
        else: points,source=nhits(request)
    except (ImportError,ModuleNotFoundError) as exc:
        raise HTTPException(status_code=503,detail="Model package not installed") from exc
    except HTTPException:
        raise
    except Exception as exc:
        # Avoid exposing internal deployment paths, tokens, or provider data.
        raise HTTPException(status_code=503,detail="Model inference unavailable") from exc
    if not points: raise HTTPException(status_code=503,detail="No forecasts produced")
    if any(not math.isfinite(p.median) or (p.lower is not None and not math.isfinite(p.lower))
           or (p.upper is not None and not math.isfinite(p.upper)) for p in points):
        raise HTTPException(status_code=503,detail="Invalid model outputs")
    return ForecastResult(model=request.model,source=source,points=points)
