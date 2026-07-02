#!/usr/bin/env python3
"""
Document OCR service — extraction facts only.

NUMZFLEET boundary: Python returns raw OCR text + metadata.
Node (fuel-api) parses business facts and persists decisions.
"""

from __future__ import annotations

import os
import secrets
from typing import Any, Dict

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from extractor import extract_document_bytes

app = FastAPI(title="NUMZFLEET Document OCR", version="1.0.0")
security = HTTPBearer(auto_error=False)

API_TOKEN = (
    os.getenv("DOCUMENT_OCR_TOKEN")
    or os.getenv("API_TOKEN")
    or ""
).strip()
MAX_BYTES = int(os.getenv("DOCUMENT_OCR_MAX_BYTES", str(10 * 1024 * 1024)))


def _verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> None:
    if not API_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OCR API token is not configured",
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


@app.get("/v1/health")
def health() -> Dict[str, str]:
    return {"status": "ok", "service": "document-ocr"}


@app.post("/v1/extract")
async def extract(
    file: UploadFile = File(...),
    _: None = Depends(_verify_token),
) -> Dict[str, Any]:
    content_type = file.content_type or ""
    filename = file.filename or ""
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds {MAX_BYTES} bytes",
        )
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file")

    allowed = content_type.startswith("image/") or content_type == "application/pdf"
    if not allowed:
        lower = filename.lower()
        allowed = lower.endswith((".jpg", ".jpeg", ".png", ".webp", ".pdf", ".heic"))
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only images and PDF files are supported",
        )

    try:
        return extract_document_bytes(data, filename=filename, content_type=content_type)
    except Exception as exc:  # pragma: no cover
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OCR extraction failed: {exc}",
        ) from exc
