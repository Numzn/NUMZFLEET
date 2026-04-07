#!/usr/bin/env python3
"""
Public API service for ERB Fuel Monitor.
Provides a secure endpoint for the latest cached prices.
"""

import json
import os
import secrets
from datetime import datetime
from typing import Any, Dict

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from config import Config

app = FastAPI(title="ERB Fuel Monitor API", version="1.0.0")
security = HTTPBearer(auto_error=False)

API_TOKEN = os.getenv("API_TOKEN", "").strip()
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("API_ALLOWED_ORIGINS", "").split(",") if o.strip()]

if ALLOWED_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=ALLOWED_ORIGINS,
        allow_credentials=False,
        allow_methods=["GET"],
        allow_headers=["Authorization", "Content-Type"],
    )


def _verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> None:
    """Validate bearer token for protected endpoints."""
    if not API_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="API token is not configured on server",
        )

    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
        )

    if not secrets.compare_digest(credentials.credentials, API_TOKEN):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )


def _read_latest_prices() -> Dict[str, Any]:
    """Read latest prices from local cache file."""
    prices_file = Config.PRICES_FILE
    if not os.path.exists(prices_file):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No cached prices found",
        )

    try:
        with open(prices_file, "r", encoding="utf-8") as f:
            payload = json.load(f)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Cached prices file is invalid JSON",
        )

    if not isinstance(payload, dict) or "data" not in payload:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Cached prices format is invalid",
        )

    return payload


@app.get("/v1/health")
def health() -> Dict[str, str]:
    return {
        "status": "ok",
        "service": "erb-fuel-monitor-api",
        "timestamp": datetime.now().isoformat(),
    }


@app.get("/v1/prices/latest")
def latest_prices(_: None = Depends(_verify_token)) -> JSONResponse:
    payload = _read_latest_prices()
    return JSONResponse(content=payload, headers={"Cache-Control": "no-store"})


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("api_server:app", host="0.0.0.0", port=int(os.getenv("PORT", "8000")), reload=False)
