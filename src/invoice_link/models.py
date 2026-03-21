from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field


class LineItem(BaseModel):
    description: str | None = None
    quantity: Decimal | None = None
    unit_price: Decimal | None = None
    amount: Decimal | None = None


class InvoiceData(BaseModel):
    """Structured fields extracted from an invoice."""

    vendor_name: str | None = None
    vat_number: str | None = Field(
        default=None,
        description="Supplier VAT / tax ID (e.g. NIF, VAT ID).",
    )
    customer_vat_number: str | None = Field(
        default=None,
        description="Customer VAT when shown (e.g. header «VAT No.»).",
    )
    invoice_number: str | None = None
    issue_date: date | None = None
    due_date: date | None = None
    currency: str | None = None
    subtotal: Decimal | None = None
    tax_amount: Decimal | None = None
    total: Decimal | None = None
    line_items: list[LineItem] = Field(default_factory=list)
    raw_text: str = ""
    extraction_method: str = "heuristic"

    def to_json_dict(self) -> dict[str, Any]:
        """JSON-serializable dict (decimals and dates as strings)."""
        return self.model_dump(mode="json", exclude_none=False)


def empty_invoice() -> InvoiceData:
    return InvoiceData()
