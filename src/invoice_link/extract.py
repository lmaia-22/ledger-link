from __future__ import annotations

import re
from decimal import Decimal, InvalidOperation
from datetime import date

from dateutil import parser as date_parser

from invoice_link.models import InvoiceData, LineItem

# Invoice refs: avoid capturing "no" from "Invoice no. FT ..."
_INVOICE_NO_FULL = re.compile(
    r"(?im)^\s*(?:invoice|factura|fatura)\s+no\.?\s+([A-Z0-9][A-Z0-9/\s\-]+)\s*$",
)
_INVOICE_NO_HASH = re.compile(
    r"(?i)(?:invoice|inv|factura)\s*[#:]\s*([A-Z0-9][A-Z0-9/\-]{2,})",
)
_INVOICE_NO = re.compile(
    r"(?:invoice|inv\.?|bill)\s*#\s*([A-Z0-9\-/]{3,})",
    re.IGNORECASE,
)
# PT InvoiceXpress, Stripe-style "Invoice number X"
_INVOICE_FACTURA = re.compile(
    r"(?i)Factura\s+n[ºo°]?\s+([^\n]+)",
)
_INVOICE_NUMBER_LABEL = re.compile(
    r"(?i)Invoice\s+number\s+([A-Z0-9][A-Z0-9\-]+)",
)
_RECEIPT_NUMBER = re.compile(
    r"(?i)Receipt\s+number\s+([0-9\-]+(?:\n[0-9\-]+)?)",
)
_MONEY = re.compile(
    r"(?:^|[^\d])(\$|€|£|USD|EUR|GBP)?\s*([\d]{1,3}(?:[.,\s][\d]{3})*(?:[.,]\d{2})?|\d+[.,]\d{2})",
    re.MULTILINE,
)
_TOTAL_LINE = re.compile(
    r"(?:^|\n)\s*(?:total|amount\s*due|balance\s*due|grand\s*total)\s*[:\s]*"
    r"(?:\$|€|£)?\s*([\d.,]+)",
    re.IGNORECASE,
)
_SUBTOTAL = re.compile(
    r"(?i)(?:^|\n)\s*(?:subtotal|total\s+without\s+vat|total\s+w/o\s+vat|total\s+sem\s+iva|"
    r"total\s+excluding\s+tax)\s*[:\s]*(?:€|\$|£)?\s*([\d.,]+)",
)
_TAX = re.compile(
    r"(?:^|\n)\s*(?:tax|vat|gst|iva|sales\s*tax)\s*(?:\([^)]*\))?\s*[:\s]*"
    r"(?:\$|€|£)?\s*([\d.,]+)",
    re.IGNORECASE | re.MULTILINE,
)

# Lines that are never the vendor name (header / metadata)
_VENDOR_SKIP = re.compile(
    r"(?i)^(vat\s*no|order\s*no|due\s*date|^due$|immediately|invoice\s*no|issue\s*date|"
    r"item|unit\s*price|quant\.|total\s*w/o|page\s*\d|in summary|summary|atcud|"
    r"processado\s+por|nif\s*:?\s*$|^\d{9,}$|invoice\s*number\s*$|receipt\s*number\s*$)",
)
_GENERIC_DOC_TITLE = re.compile(
    r"(?i)^(invoice|receipt|factura|fatura|bill\s+to|description|qty|amount\s+paid|"
    r"date\s+due|date\s+of\s+issue|date\s+paid|pay\s+online)\s*$",
)


def _parse_amount(s: str) -> Decimal | None:
    """
    Parse amounts with European (1.234,56 or 5,12) or US (1,234.56) grouping.
    """
    s = re.sub(r"[\s€$£]", "", (s or "").strip())
    if not s:
        return None
    # European: thousands dot, decimal comma
    if re.fullmatch(r"\d{1,3}(\.\d{3})*,\d{2}", s):
        s = s.replace(".", "").replace(",", ".")
    # US thousands comma
    elif re.fullmatch(r"\d{1,3}(,\d{3})*\.\d{2}", s):
        s = s.replace(",", "")
    # Simple: single comma as decimal (5,12)
    elif s.count(",") == 1 and "." not in s:
        left, right = s.split(",")
        if len(right) <= 2 and right.isdigit():
            s = f"{left}.{right}"
    try:
        return Decimal(s)
    except InvalidOperation:
        return None


def _parse_decimal_legacy(s: str) -> Decimal | None:
    return _parse_amount(s)


def _parse_money_line(line: str) -> Decimal | None:
    m = _MONEY.search(line)
    if not m:
        return None
    return _parse_amount(m.group(2))


def _parse_date_token(s: str) -> date | None:
    s = s.strip()
    m = re.fullmatch(r"(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})", s)
    if m:
        y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
        try:
            return date(y, mo, d)
        except ValueError:
            return None
    m = re.fullmatch(r"(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})", s)
    if m:
        try:
            return date_parser.parse(s, dayfirst=True).date()
        except (ValueError, OverflowError):
            return None
    return None


def _parse_loose_date(s: str) -> date | None:
    """ISO, numeric, or English month (e.g. ``February 8, 2026``)."""
    s = (s or "").strip()
    if not s:
        return None
    d = _parse_date_token(s)
    if d:
        return d
    try:
        return date_parser.parse(s, dayfirst=False).date()
    except (ValueError, OverflowError, TypeError):
        return None


def _is_probably_date_only_line(line: str) -> bool:
    """Skip lines like ``February 8, 2026`` when hunting vendor name."""
    s = line.strip()
    if len(s) > 42:
        return False
    if re.match(r"^\d{4}[/\-]\d{1,2}[/\-]\d{1,2}\s*$", s):
        return True
    if _parse_loose_date(s) is not None and re.search(
        r"(?i)\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)\b",
        s,
    ):
        return True
    return False


def _extract_dates(text: str) -> tuple[date | None, date | None]:
    issue: date | None = None
    due: date | None = None

    m = re.search(
        r"(?i)data\s+de\s+emiss[aã]o\s*[:\s]+\s*(\d{4}/\d{1,2}/\d{1,2})",
        text,
    )
    if m:
        issue = _parse_date_token(m.group(1))
    m = re.search(
        r"(?i)data\s+de\s+vencimento\s*[:\s]+\s*(\d{4}/\d{1,2}/\d{1,2})",
        text,
    )
    if m:
        due = _parse_date_token(m.group(1))

    if issue is None:
        for m in re.finditer(
            r"(?i)(issue\s*date|date\s*of\s+issue|data\s+da\s+fatura)\s*[:\s]+\s*"
            r"(\d{4}[/\-]\d{1,2}[/\-]\d{1,2}|\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})",
            text,
        ):
            issue = _parse_date_token(m.group(2))
            break
    if due is None:
        for m in re.finditer(
            r"(?i)(due\s*date|vencimento|data\s+de\s+vencimento)\s*[:\s]+\s*"
            r"(\d{4}[/\-]\d{1,2}[/\-]\d{1,2}|\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})",
            text,
        ):
            due = _parse_date_token(m.group(2))
            break

    if issue is None:
        m = re.search(
            r"(?i)date\s+of\s+issue\s*\n+\s*([^\n]+?)\s*\n",
            text,
        )
        if m:
            issue = _parse_loose_date(m.group(1))
    if due is None:
        m = re.search(
            r"(?i)date\s+due\s*\n+\s*([^\n]+?)\s*\n",
            text,
        )
        if m:
            due = _parse_loose_date(m.group(1))
    if issue is None:
        m = re.search(r"(?i)date\s+paid\s*\n+\s*([^\n]+?)\s*\n", text)
        if m:
            issue = _parse_loose_date(m.group(1))

    if due is None:
        m = re.search(
            r"(?i)due\s*date\s*[:\s]*\n\s*(\d{4}[/\-]\d{1,2}[/\-]\d{1,2})",
            text,
        )
        if m:
            due = _parse_date_token(m.group(1))

    if issue is None or due is None:
        blob = text[:6000]
        found: list[date] = []
        for m in re.finditer(
            r"\b(20\d{2}[/\-]\d{1,2}[/\-]\d{1,2}|\d{1,2}[/\-]\d{1,2}[/\-]20\d{2})\b",
            blob,
        ):
            d = _parse_date_token(m.group(1))
            if d is not None:
                found.append(d)
        if issue is None and found:
            issue = found[0]
        if due is None and len(found) > 1:
            due = found[1]
    return issue, due


def _invoice_number(text: str) -> str | None:
    m = _INVOICE_FACTURA.search(text)
    if m:
        ref = " ".join(m.group(1).split())
        if len(ref) >= 4:
            return ref
    m = _INVOICE_NUMBER_LABEL.search(text)
    if m:
        ref = m.group(1).strip()
        if len(ref) >= 3:
            return ref
    m = _INVOICE_NO_FULL.search(text)
    if m:
        ref = " ".join(m.group(1).split())
        if len(ref) >= 4:
            return ref
    m = _INVOICE_NO_HASH.search(text)
    if m:
        ref = m.group(1).strip()
        if len(ref) >= 3:
            return ref
    m = _INVOICE_NO.search(text)
    if m:
        ref = m.group(1).strip()
        if len(ref) >= 3 and ref.lower() not in ("no", "inv", "na"):
            return ref
    m = _RECEIPT_NUMBER.search(text)
    if m:
        ref = re.sub(r"\s+", "", m.group(1).strip())
        if len(ref) >= 4:
            return ref
    return None


def _totals(text: str) -> tuple[Decimal | None, Decimal | None, Decimal | None]:
    sub: Decimal | None = None
    tax: Decimal | None = None
    total: Decimal | None = None
    m = _SUBTOTAL.search(text)
    if m:
        sub = _parse_amount(m.group(1))
    # VAT/tax: same line or "VAT:\n1,18€"
    m = _TAX.search(text)
    if m:
        tax = _parse_amount(m.group(1))
    if tax is None:
        m = re.search(
            r"(?im)^\s*(?:VAT|IVA|Tax)\s*:\s*$\s*^\s*([\d.,]+)\s*€?",
            text,
        )
        if m:
            tax = _parse_amount(m.group(1))
    if tax is None:
        m = re.search(r"(?i)VAT\s*[^\n]+\n\s*[€$]([\d.,]+)", text)
        if m:
            tax = _parse_amount(m.group(1))
    m = _TOTAL_LINE.search(text)
    if m:
        total = _parse_amount(m.group(1))
    # "Total:\n6,30€" or summary total
    if total is None:
        m = re.search(
            r"(?im)^\s*Total\s*:\s*$\s*^\s*([\d.,]+)\s*€?",
            text,
        )
        if m:
            total = _parse_amount(m.group(1))
    if total is None:
        for line in reversed(text.splitlines()):
            if re.search(r"total|amount\s*due", line, re.I):
                v = _parse_money_line(line)
                if v is not None:
                    total = v
                    break
    # Summary block: "Total: 6,30€" at end — prefer line with € near "Total:" and small magnitude
    if total is not None and total > 1000 and re.search(r"\d+,\d{2}€", text):
        # Likely misparsed European amount; find best Total near bottom
        best: Decimal | None = None
        for m in re.finditer(
            r"(?i)Total\s*:\s*([\d.,]+)\s*€",
            text,
        ):
            v = _parse_amount(m.group(1))
            if v is not None and (best is None or v < 10000):
                best = v
        if best is not None:
            total = best
    return sub, tax, total


def _vat_numbers(text: str) -> tuple[str | None, str | None]:
    """
    Return (vendor_vat, customer_vat).
    PT: customer often ``NIF:\\n227160061`` at top; vendor ``NIF: 507026918`` after company.
    EN: ``VAT No.:`` + line; vendor ``VAT:`` on its own line with digits.
    """
    customer: str | None = None
    vendor: str | None = None

    m = re.search(
        r"(?i)VAT\s*No\.?\s*[:\s]*\n\s*([\d\s\-]{6,22})",
        text,
    )
    if m:
        digits = re.sub(r"[\s\-]", "", m.group(1).strip())
        if digits.isdigit() and len(digits) >= 6:
            customer = digits

    m = re.search(r"(?is)^\s*NIF\s*:\s*\n\s*(\d{8,12})\b", text)
    if m:
        customer = m.group(1)

    single_nifs = list(
        re.finditer(r"(?im)^\s*NIF\s*:\s*(\d{8,12})\s*$", text),
    )
    if len(single_nifs) >= 2:
        if customer is None:
            customer = single_nifs[0].group(1)
        vendor = single_nifs[-1].group(1)
    elif len(single_nifs) == 1:
        vid = single_nifs[0].group(1)
        if customer and vid != customer:
            vendor = vid
        elif customer is None:
            vendor = vid

    if vendor is None:
        for m in re.finditer(
            r"(?im)^\s*VAT\s*:\s*(\d{8,12})\s*$",
            text,
        ):
            vendor = m.group(1)
            break

    if vendor is None:
        m = re.search(
            r"\b((?:AT|BE|BG|CY|CZ|DE|DK|EE|EL|ES|FI|FR|HR|HU|IE|IT|LT|LU|LV|MT|NL|PL|PT|RO|SE|SI|SK)[A-Z0-9]{8,12})\b",
            text,
        )
        if m:
            vendor = m.group(1).replace(" ", "")

    if vendor is None:
        m = re.search(r"\b(GB\d{9}(?:\d{3})?)\b", text)
        if m:
            vendor = m.group(1).replace(" ", "")

    if customer == vendor:
        customer = None

    return vendor, customer


def _vendor_name(text: str) -> str | None:
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]

    def looks_like_vendor(line: str) -> bool:
        if len(line) < 4 or len(line) > 200:
            return False
        if _is_probably_date_only_line(line):
            return False
        if _VENDOR_SKIP.match(line):
            return False
        if _GENERIC_DOC_TITLE.match(line):
            return False
        if re.match(r"(?i)^nif\s*:?\s*$", line):
            return False
        if line.isdigit():
            return False
        if re.match(r"(?i)^(rua|r\.|av\.|avenida|cp\s|^\d{4}-|portugal|luis\s)", line):
            return False
        if not re.search(r"[A-Za-zÀ-ÿ]", line):
            return False
        if re.match(r"(?i)^(vat|order|due|invoice|issue|item|page|total|tax)\s*:", line):
            return False
        return True

    anchors = (
        r"(?i)issue\s*date",
        r"(?i)data\s+de\s+emiss[aã]o",
        r"(?i)date\s+of\s+issue",
        r"(?i)date\s+paid",
    )
    for anchor in anchors:
        for i, line in enumerate(lines):
            if re.search(anchor, line):
                for j in range(i + 1, min(i + 20, len(lines))):
                    if looks_like_vendor(lines[j]):
                        return lines[j][:200]
                break

    for i, line in enumerate(lines):
        if re.search(r"(?i)issue\s*date", line):
            for j in range(i + 1, min(i + 8, len(lines))):
                if looks_like_vendor(lines[j]):
                    return lines[j][:200]
            break

    for line in lines:
        if looks_like_vendor(line):
            return line[:200]
    return None


def _currency(text: str) -> str | None:
    if re.search(r"(?i)\$\s*[\d.,]+\s*USD|[\d.,]+\s*USD\s+due|amount\s+(due|paid)\s*\$", text):
        return "USD"
    if re.search(r"(?im)^\s*Total\s*$\s*^\s*\$", text) or re.search(
        r"(?i)Total\s*\n\s*\$[\d.,]+",
        text,
    ):
        return "USD"
    if "€" in text or re.search(r"\bEUR\b", text):
        return "EUR"
    if "£" in text or re.search(r"\bGBP\b", text):
        return "GBP"
    if "$" in text or re.search(r"\bUSD\b", text):
        return "USD"
    return None


def _line_items_simple(text: str) -> list[LineItem]:
    items: list[LineItem] = []
    row = re.compile(
        r"^(.{3,60}?)\s+(\d+(?:\.\d+)?)\s+[@x]\s*([\d.,]+)\s+([\d.,]+)\s*$",
        re.IGNORECASE,
    )
    for line in text.splitlines():
        m = row.match(line.strip())
        if m:
            items.append(
                LineItem(
                    description=m.group(1).strip(),
                    quantity=_parse_decimal_legacy(m.group(2)),
                    unit_price=_parse_amount(m.group(3)),
                    amount=_parse_amount(m.group(4)),
                )
            )
    return items


def parse_invoice_text(text: str) -> InvoiceData:
    """Rule-based extraction from OCR/plain text."""
    text = text.strip()
    issue, due = _extract_dates(text)
    sub, tax, total = _totals(text)
    vendor_vat, customer_vat = _vat_numbers(text)
    inv = InvoiceData(
        vendor_name=_vendor_name(text),
        vat_number=vendor_vat,
        customer_vat_number=customer_vat,
        invoice_number=_invoice_number(text),
        issue_date=issue,
        due_date=due,
        currency=_currency(text),
        subtotal=sub,
        tax_amount=tax,
        total=total,
        line_items=_line_items_simple(text),
        raw_text=text,
        extraction_method="heuristic",
    )
    return inv
