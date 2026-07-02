"""Vision/OCR extraction only — returns raw text facts, no business rules."""

from __future__ import annotations

import io
from typing import Any, Dict, List, Tuple

from PIL import Image
import pytesseract

try:
    from pdf2image import convert_from_bytes
except ImportError:  # pragma: no cover
    convert_from_bytes = None


def _ocr_image(image: Image.Image) -> str:
    rgb = image.convert("RGB")
    return pytesseract.image_to_string(rgb) or ""


def _ocr_pdf_bytes(data: bytes) -> Tuple[str, int]:
    if convert_from_bytes is None:
        raise RuntimeError("pdf2image is not installed")
    pages = convert_from_bytes(data, dpi=200)
    texts: List[str] = []
    for page in pages:
        texts.append(_ocr_image(page))
    return "\n\n".join(texts).strip(), len(pages)


def extract_document_bytes(
    data: bytes,
    *,
    filename: str = "",
    content_type: str = "",
) -> Dict[str, Any]:
    """Run OCR on image or PDF bytes. Returns extraction facts only."""
    if not data:
        return {
            "rawText": "",
            "pageCount": 0,
            "engine": "tesseract",
            "contentType": content_type or None,
            "filename": filename or None,
        }

    lower_name = (filename or "").lower()
    is_pdf = content_type == "application/pdf" or lower_name.endswith(".pdf")

    if is_pdf:
        raw_text, page_count = _ocr_pdf_bytes(data)
    else:
        image = Image.open(io.BytesIO(data))
        raw_text = _ocr_image(image)
        page_count = 1

    return {
        "rawText": raw_text.strip(),
        "pageCount": page_count,
        "engine": "tesseract",
        "contentType": content_type or None,
        "filename": filename or None,
    }
