from __future__ import annotations

import io
from pathlib import Path

import fitz  # PyMuPDF
from PIL import Image
import pytesseract


def _image_to_text(image: Image.Image, lang: str = "eng") -> str:
    return pytesseract.image_to_string(image, lang=lang)


def extract_text_from_image(path: Path | str, lang: str = "eng") -> str:
    """OCR a PNG/JPEG/WebP/TIFF image."""
    p = Path(path)
    with Image.open(p) as img:
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
        return _image_to_text(img, lang=lang).strip()


def extract_text_from_pdf(
    path: Path | str,
    lang: str = "eng",
    ocr_if_empty: bool = True,
    min_chars_per_page: int = 50,
) -> str:
    """
    Prefer embedded PDF text; if pages are nearly empty (scanned), OCR rendered pages.
    """
    p = Path(path)
    doc = fitz.open(p)
    parts: list[str] = []
    try:
        for page in doc:
            text = page.get_text("text").strip()
            if len(text) >= min_chars_per_page or not ocr_if_empty:
                parts.append(text)
                continue
            # Rasterize for OCR
            mat = fitz.Matrix(2, 2)  # 2x zoom improves OCR on small text
            pix = page.get_pixmap(matrix=mat, alpha=False)
            img = Image.open(io.BytesIO(pix.tobytes("png")))
            if img.mode not in ("RGB", "L"):
                img = img.convert("RGB")
            parts.append(_image_to_text(img, lang=lang))
    finally:
        doc.close()
    return "\n\n".join(s.strip() for s in parts if s.strip()).strip()


def extract_text_auto(path: Path | str, lang: str = "eng") -> str:
    """Dispatch by file extension: PDF vs image."""
    p = Path(path)
    suffix = p.suffix.lower()
    if suffix == ".pdf":
        return extract_text_from_pdf(p, lang=lang)
    return extract_text_from_image(p, lang=lang)
