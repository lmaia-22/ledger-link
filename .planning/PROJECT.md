# Ledger Link

## What This Is

A browser-based reconciliation tool that automates cross-referencing of invoices, receipts, and bank statements against entries in Sage 50 Accounts. It runs on a LAN alongside Sage, serving accountants who currently spend hours manually hunting for mismatches between source documents and Sage transactions.

## Core Value

Accountants can import a bank statement and instantly see which transactions match Sage entries and which need attention — eliminating the manual hunt through Sage for every line item.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Import bank statements (CSV/OFX) and extract transaction data
- [ ] Upload invoices and receipts (PDF, scanned images) and extract key fields via OCR
- [ ] Connect to Sage 50 Accounts via COM SDK (SDO) and read transactions
- [ ] Auto-match imported documents/bank lines against Sage entries by amount, date, and reference
- [ ] Display match suggestions for accountant review and confirmation
- [ ] Mark confirmed matches as reconciled in Sage via COM SDK
- [ ] Flag unmatched items for manual review with a clear "needs attention" list
- [ ] Support multiple Sage client company datasets (up to ~10 per firm)
- [ ] Browser-based UI accessible from any machine on the LAN

### Out of Scope

- Auto-creating missing transactions in Sage — v1 is read + reconcile only, not write new entries
- Cloud hosting or external access — runs entirely on the LAN
- Mobile-specific UI — desktop browsers on the LAN are the target
- Real-time sync with Sage — batch import/reconcile workflow, not live monitoring

## Context

- **Sage 50 Accounts** is a Windows desktop application installed on the LAN. Integration is via the COM-based Sage Data Objects (SDO) SDK, which provides programmatic access to invoices, bank entries, and transactions.
- **Node.js backend** will need a COM bridge library (e.g., `winax` or `edge-js`) to communicate with Sage SDO from JavaScript on Windows.
- **Document sources are mixed**: some clients provide digital PDFs and CSV bank exports; others bring scanned paper documents that need OCR to extract amounts, dates, and references.
- **Target users are accountants** at a small firm managing under 10 client companies in Sage. The workflow is batch-oriented: import a statement, review matches, confirm, move to next client.

## Constraints

- **Platform**: Backend must run on Windows (Sage COM SDK is Windows-only)
- **Network**: LAN-only deployment, no external connectivity required
- **Sage version**: Sage 50 Accounts (desktop), accessed via SDO COM API
- **Runtime**: Node.js backend, browser-based frontend
- **OCR**: Needed for scanned paper documents — either built-in or via a service accessible on the LAN

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Browser-based over desktop app | Avoids per-machine installs, easier to maintain | — Pending |
| Node.js + COM bridge for Sage | Team preference; COM interop via winax/edge-js | — Pending |
| Reconcile-only (no auto-create in Sage) | Lower risk for v1; accountants verify before any Sage writes | — Pending |
| OCR in v1 | Mixed document sources make OCR essential from day one | — Pending |

---
*Last updated: 2026-03-17 after initialization*
