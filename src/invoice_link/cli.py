from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from invoice_link.env import load_dotenv_config
from invoice_link.extract import parse_invoice_text
from invoice_link.ocr import extract_text_auto


def main() -> None:
    load_dotenv_config()
    parser = argparse.ArgumentParser(
        description="OCR an invoice (image or PDF) and output JSON.",
    )
    parser.add_argument(
        "path",
        type=Path,
        help="Path to invoice image (.png, .jpg, …) or .pdf",
    )
    parser.add_argument(
        "--lang",
        default="eng",
        help="Tesseract language code (default: eng)",
    )
    parser.add_argument(
        "--llm",
        action="store_true",
        help="Use LLM for extraction (pip install invoice-link[llm]; see INVOICE_LLM_MODE)",
    )
    parser.add_argument(
        "--llm-mode",
        choices=("test", "live"),
        default=None,
        help="Override INVOICE_LLM_MODE: test=Ollama, live=OpenAI (default: env, or live if OPENAI_API_KEY set else test)",
    )
    parser.add_argument(
        "--llm-model",
        default=None,
        metavar="NAME",
        help="Model name: Ollama (test) or OpenAI (live); overrides OLLAMA_MODEL / OPENAI_MODEL",
    )
    parser.add_argument(
        "--raw-text",
        action="store_true",
        help="Include full OCR text in JSON under raw_text",
    )
    args = parser.parse_args()

    if not args.path.is_file():
        print(f"File not found: {args.path}", file=sys.stderr)
        sys.exit(1)

    text = extract_text_auto(args.path, lang=args.lang)

    if args.llm:
        from invoice_link.llm_extract import extract_with_llm

        invoice = extract_with_llm(text, mode=args.llm_mode, model=args.llm_model)
    else:
        invoice = parse_invoice_text(text)

    if not args.raw_text:
        invoice = invoice.model_copy(update={"raw_text": ""})

    out = invoice.to_json_dict()
    print(json.dumps(out, indent=2, default=str))


if __name__ == "__main__":
    main()
