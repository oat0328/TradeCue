"""Fast isolated tests: no model weights and no broker connection required."""
from datetime import datetime,timedelta,timezone
import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from services.omega_forecasting.app import ForecastRequest,authenticate,forecast

def data():
    first=datetime(2026,1,1,tzinfo=timezone.utc)
    return {"symbol":"SPY","model":"chronos2","horizon":3,"bars":[
        {"time":(first+timedelta(minutes=5*i)).isoformat(),
         "open":100+i*.01,"high":100.2+i*.01,"low":99.8+i*.01,
         "close":100+i*.01,"volume":1000} for i in range(100)
    ]}

def test_unauthorized_by_default(monkeypatch):
    monkeypatch.delenv("OMEGA_FORECAST_SERVICE_KEY",raising=False)
    with pytest.raises(HTTPException) as error:
        authenticate("wrong")
    assert error.value.status_code==401

def test_wrong_key_rejected(monkeypatch):
    monkeypatch.setenv("OMEGA_FORECAST_SERVICE_KEY","safe-testing-key")
    with pytest.raises(HTTPException) as error:
        authenticate("another-key")
    assert error.value.status_code==401

def test_model_not_automatically_enabled(monkeypatch):
    monkeypatch.delenv("OMEGA_ENABLE_CHRONOS2",raising=False)
    with pytest.raises(HTTPException) as error:
        forecast(ForecastRequest(**data()))
    assert error.value.status_code==503

def test_bad_ohlc_rejected():
    record=data()
    record["bars"][5]["high"]=1
    with pytest.raises(ValidationError):ForecastRequest(**record)

def test_unsorted_duplicate_bars_rejected():
    record=data()
    record["bars"][40]["time"]=record["bars"][39]["time"]
    with pytest.raises(ValidationError):ForecastRequest(**record)

def test_payload_and_horizon_limits():
    record=data()
    record["horizon"]=500
    with pytest.raises(ValidationError):ForecastRequest(**record)
    record=data()
    record["bars"]=record["bars"][:50]
    with pytest.raises(ValidationError):ForecastRequest(**record)
