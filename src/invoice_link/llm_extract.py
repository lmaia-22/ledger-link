from __future__ import annotations

import json
import os
import re
import urllib.request
from typing import Any, Literal

from invoice_link.models import InvoiceData, LineItem

LlmMode = Literal["test", "live"]

# Default when OLLAMA_MODEL / --llm-model not set (must match `ollama list` tag).
DEFAULT_OLLAMA_MODEL = "gemma3:12b"

SYSTEM = """You extract structured data from invoice OCR text. Return ONLY valid JSON matching this shape:
{
  "vendor_name": string or null,
  "vat_number": string or null,
  "customer_vat_number": string or null,
  "invoice_number": string or null,
  "issue_date": "YYYY-MM-DD" or null,
  "due_date": "YYYY-MM-DD" or null,
  "currency": "USD"|"EUR"|"GBP" or null,
  "subtotal": number or null,
  "tax_amount": number or null,
  "total": number or null,
  "line_items": [{"description": string or null, "quantity": number or null, "unit_price": number or null, "amount": number or null}]
}
vat_number is the supplier/seller VAT or tax ID (e.g. NIF, VAT ID). customer_vat_number is the buyer VAT when shown (e.g. "VAT No." for the customer).
Use null when unknown. Dates must be ISO. Numbers are decimals without currency symbols."""


def _parse_json_object(raw: str) -> dict[str, Any]:
    """Parse model output that may be wrapped in markdown fences."""
    text = raw.strip()
    fence = re.match(r"^```(?:json)?\s*\n?(.*)\n?```\s*$", text, re.DOTALL)
    if fence:
        text = fence.group(1).strip()
    return json.loads(text)


def _invoice_from_dict(data: dict[str, Any], ocr_text: str, extraction_method: str) -> InvoiceData:
    line_items: list[LineItem] = []
    for li in data.get("line_items") or []:
        if not isinstance(li, dict):
            continue
        line_items.append(
            LineItem(
                description=li.get("description"),
                quantity=li.get("quantity"),
                unit_price=li.get("unit_price"),
                amount=li.get("amount"),
            )
        )
    return InvoiceData(
        vendor_name=data.get("vendor_name"),
        vat_number=data.get("vat_number"),
        customer_vat_number=data.get("customer_vat_number"),
        invoice_number=data.get("invoice_number"),
        issue_date=data.get("issue_date"),
        due_date=data.get("due_date"),
        currency=data.get("currency"),
        subtotal=data.get("subtotal"),
        tax_amount=data.get("tax_amount"),
        total=data.get("total"),
        line_items=line_items,
        raw_text=ocr_text,
        extraction_method=extraction_method,
    )


def _get_openai_client_class():
    try:
        from openai import OpenAI
    except ImportError as e:
        raise RuntimeError('Install with: pip install "invoice-link[llm]"') from e
    return OpenAI


def _ollama_model_help(model_name: str, installed: list[str] | None = None) -> str:
    extra = ""
    if installed:
        extra = f"\nLocally installed models: {', '.join(installed)}"
    return (
        f"Ollama has no usable model (tried {model_name!r}).{extra}\n"
        f"Install one with: ollama pull {DEFAULT_OLLAMA_MODEL}   (or see https://ollama.com/search)\n"
        "Exact tag must match `ollama list`. Set OLLAMA_MODEL or --llm-model to that name."
    )


def _ollama_openai_base_to_root(openai_base: str) -> str:
    b = openai_base.rstrip("/")
    if b.endswith("/v1"):
        return b[:-3]
    return b


def _fetch_ollama_installed_models(api_root: str) -> list[str] | None:
    """Return model names from Ollama ``/api/tags``, or None if the server is unreachable."""
    url = f"{api_root.rstrip('/')}/api/tags"
    try:
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=8) as resp:
            payload = json.loads(resp.read().decode())
        return [m["name"] for m in payload.get("models", []) if m.get("name")]
    except Exception:
        return None


def _pick_matching_ollama_model(installed: list[str], preferred: str) -> str | None:
    """Map a requested name to an installed tag (exact, fuzzy, or single local model)."""
    if not installed:
        return None
    if preferred in installed:
        return preferred
    pl = preferred.lower()
    for n in installed:
        if n.lower() == pl:
            return n
    for n in installed:
        nl = n.lower()
        if pl in nl or nl in pl:
            return n
    if len(installed) == 1:
        return installed[0]
    for token in ("qwen", "gemma"):
        if token in pl:
            for n in installed:
                nl = n.lower()
                if token in nl and "12" in n:
                    return n
            for n in installed:
                if token in n.lower():
                    return n
    return None


def _chat_json(
    *,
    base_url: str | None,
    api_key: str,
    model: str,
    user_text: str,
    use_json_response_format: bool,
) -> dict[str, Any]:
    client_cls = _get_openai_client_class()
    kwargs: dict[str, Any] = {"api_key": api_key}
    if base_url:
        kwargs["base_url"] = base_url
    client = client_cls(**kwargs)
    messages = [
        {"role": "system", "content": SYSTEM},
        {"role": "user", "content": user_text[:120_000]},
    ]
    if use_json_response_format:
        try:
            resp = client.chat.completions.create(
                model=model,
                response_format={"type": "json_object"},
                messages=messages,
            )
            raw = resp.choices[0].message.content or "{}"
            return _parse_json_object(raw)
        except Exception:
            use_json_response_format = False
    resp = client.chat.completions.create(model=model, messages=messages)
    raw = resp.choices[0].message.content or "{}"
    return _parse_json_object(raw)


def resolve_llm_mode(explicit: LlmMode | None = None) -> LlmMode:
    """
    CLI override wins; else ``INVOICE_LLM_MODE``.

    If unset: **live** when ``OPENAI_API_KEY`` is set, otherwise **test** (Ollama local).
    """
    if explicit is not None:
        return explicit
    raw = os.environ.get("INVOICE_LLM_MODE")
    if raw is not None and raw.strip():
        env = raw.strip().lower()
        if env in ("test", "local", "ollama"):
            return "test"
        if env in ("live", "prod", "production", "openai"):
            return "live"
        raise ValueError(
            f"Invalid INVOICE_LLM_MODE={env!r}; use 'test' (Ollama) or 'live' (OpenAI).",
        )
    if os.environ.get("OPENAI_API_KEY"):
        return "live"
    return "test"


def extract_with_llm(
    ocr_text: str,
    mode: LlmMode | None = None,
    model: str | None = None,
) -> InvoiceData:
    """
    Structured extraction using an LLM.

    - **test**: local Ollama (OpenAI-compatible API). Set OLLAMA_MODEL; optional OLLAMA_BASE_URL.
    - **live**: OpenAI. Set OPENAI_API_KEY; optional OPENAI_MODEL.

    Mode: ``mode`` arg, or env ``INVOICE_LLM_MODE``. If unset: ``live`` when
    ``OPENAI_API_KEY`` is set, else ``test`` (Ollama).
    """
    m = resolve_llm_mode(mode)
    if m == "test":
        from openai import APIConnectionError, NotFoundError

        base = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434/v1").rstrip("/")
        if not base.endswith("/v1"):
            base = base + "/v1"
        api_root = _ollama_openai_base_to_root(base)
        requested = (model or os.environ.get("OLLAMA_MODEL") or DEFAULT_OLLAMA_MODEL).strip()
        installed = _fetch_ollama_installed_models(api_root)
        ollama_model = requested
        if installed is not None:
            if len(installed) == 0:
                raise RuntimeError(
                    f"Ollama has no models installed. Run e.g.: ollama pull {DEFAULT_OLLAMA_MODEL}\n"
                    "Then check the exact name with: ollama list",
                )
            picked = _pick_matching_ollama_model(installed, requested)
            ollama_model = picked if picked is not None else requested
        api_key = os.environ.get("OLLAMA_API_KEY", "ollama")
        try:
            data = _chat_json(
                base_url=base,
                api_key=api_key,
                model=ollama_model,
                user_text=ocr_text,
                use_json_response_format=True,
            )
        except NotFoundError as e:
            inst = installed if installed is not None else None
            raise RuntimeError(_ollama_model_help(ollama_model, inst)) from e
        except APIConnectionError as e:
            raise RuntimeError(
                "Cannot reach Ollama. Start it with: ollama serve\n"
                "Default URL is http://localhost:11434 — override with OLLAMA_BASE_URL if needed.",
            ) from e
        return _invoice_from_dict(data, ocr_text, f"ollama:{ollama_model}")

    openai_model = model or os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("Set OPENAI_API_KEY for live LLM extraction (INVOICE_LLM_MODE=live).")
    data = _chat_json(
        base_url=None,
        api_key=api_key,
        model=openai_model,
        user_text=ocr_text,
        use_json_response_format=True,
    )
    return _invoice_from_dict(data, ocr_text, f"openai:{openai_model}")


def extract_with_openai(ocr_text: str, model: str | None = None) -> InvoiceData:
    """Same as ``extract_with_llm(..., mode='live')`` for backwards compatibility."""
    return extract_with_llm(ocr_text, mode="live", model=model)
