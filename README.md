# invoice-link

OCR invoices (images or PDFs) and output structured JSON: vendor, invoice number, dates, totals, and optional line items.

## Setup

1. **Python 3.10+** and [Tesseract OCR](https://github.com/tesseract-ocr/tesseract) on your PATH.

   - macOS: `brew install tesseract`
   - Ubuntu: `sudo apt install tesseract-ocr`

2. Install:

   ```bash
   python -m venv .venv
   source .venv/bin/activate
   pip install -e .
   ```

3. **Environment file (optional):** create a file named **`.env`** in the **project root** (same folder as `pyproject.toml`, i.e. `ledger-link-v2/.env`). Copy from `.env.example` and set variables there. The CLI loads it automatically on startup.

   | Variable | Purpose |
   |----------|---------|
   | `INVOICE_ENV` | Label for your deployment: `dev`, `test`, `staging`, `prod` (not used by core parsing unless you wire it). |
   | `INVOICE_LLM_MODE` | `test` = Ollama, `live` = OpenAI. |
   | `OLLAMA_MODEL` | Ollama model tag (e.g. `gemma3:12b`). |
   | `OPENAI_API_KEY` | OpenAI key when using live mode. |

   Do not commit `.env` (it is gitignored). Commit `.env.example` only.

   Optional LLM extraction (OpenAI and/or local Ollama):

   ```bash
   pip install -e ".[llm]"
   ```

   **Live (OpenAI):** set the API key; if ``INVOICE_LLM_MODE`` is unset, the CLI uses **live** automatically when ``OPENAI_API_KEY`` is set.

   ```bash
   export OPENAI_API_KEY=sk-...
   export INVOICE_LLM_MODE=live   # optional if key is set (same default)
   # optional: export OPENAI_MODEL=gpt-4o-mini
   ```

   **Test (local Ollama):** run `ollama serve` and install the default model (`gemma3:12b`) or another:

   ```bash
   ollama pull gemma3:12b
   ```

   If ``OPENAI_API_KEY`` is **not** set and ``INVOICE_LLM_MODE`` is unset, ``--llm`` defaults to **Ollama** (test).

   ```bash
   export OLLAMA_MODEL=gemma3:12b
   invoice-link doc.pdf --llm --llm-model mistral
   # optional: export OLLAMA_BASE_URL=http://localhost:11434/v1
   ```

## Testing

1. Activate the venv: `source .venv/bin/activate`.
2. Drop real invoices under `invoices/` (PDF or common image formats).
3. Run on one file:

   ```bash
   invoice-link invoices/your-file.pdf
   invoice-link invoices/your-file.pdf --raw-text
   ```

4. Process every PDF/image in `invoices/`:

   ```bash
   ./scripts/process_invoices.sh
   ./scripts/process_invoices.sh --llm --llm-mode test
   ```

A committed sample lives at `invoices/sample_invoice.pdf` (text-based PDF, no OCR). For **scanned** PDFs or photos, Tesseract runs automatically when the page has little embedded text.

## Usage

```bash
invoice-link path/to/invoice.pdf
invoice-link path/to/invoice.png --raw-text
invoice-link invoice.pdf --llm
invoice-link invoice.pdf --llm --llm-mode test
```

JSON is printed to stdout. Without `--raw-text`, `raw_text` is omitted to keep output small.

## How it works

- **PDFs**: Uses embedded text when present; otherwise renders pages and runs Tesseract.
- **Images**: Tesseract OCR.
- **Extraction**: Default is fast, offline heuristics (regex + date parsing). Use `--llm` for smarter field mapping: **test** uses local Ollama; **live** uses OpenAI (`INVOICE_LLM_MODE` or `--llm-mode`).
