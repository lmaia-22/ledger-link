# Requirements: Ledger Link

**Defined:** 2026-03-17
**Core Value:** Accountants can import a bank statement and instantly see which transactions match Sage entries and which need attention

## v1 Requirements

### Sage Integration

- [x] **SAGE-01**: System connects to Sage 50 via official .NET/Interops SDK from the LAN server
- [x] **SAGE-02**: System reads transactions, invoices, and bank entries from Sage
- [ ] **SAGE-03**: System marks confirmed matches as reconciled in Sage via SDK
- [x] **SAGE-04**: System supports switching between multiple Sage company datasets (up to ~10)

### Bank Statement Processing

- [ ] **BANK-01**: User can import bank statements in CSV format
- [ ] **BANK-02**: User can import bank statements in OFX format
- [ ] **BANK-03**: System extracts transaction data (date, amount, reference, description) from imported statements

### Document Processing (DOC·SCAN)

- [ ] **DOC-01**: User can upload invoices and receipts (PDF, JPG, PNG)
- [ ] **DOC-02**: System extracts structured data via local vision model (emitente, NIF, IBAN, IVA, totals, invoice lines)
- [ ] **DOC-03**: System assigns confidence score per extraction (high/medium/low)
- [ ] **DOC-04**: User can upload bank statement images/PDFs and system extracts movements via OCR

### Reconciliation Engine

- [ ] **REC-01**: System performs exact match — values match to the cent between document and bank movement
- [ ] **REC-02**: System performs approximate match — difference ≤2% of total value (fees, rounding, shipping)
- [ ] **REC-03**: System flags "no match" when difference >2% or no corresponding movement exists
- [ ] **REC-04**: System cross-references extracted invoices/receipts against bank statement movements

### Reconciliation Workflow

- [ ] **FLOW-01**: User can view match suggestions side-by-side (document vs bank movement)
- [ ] **FLOW-02**: User can accept or reject individual match suggestions
- [ ] **FLOW-03**: User can view unmatched items in a "needs attention" list
- [ ] **FLOW-04**: System logs every confirm/reject action with timestamp (audit trail)

### Dashboard & UI

- [ ] **DASH-01**: Browser-based UI accessible from any machine on the LAN
- [ ] **DASH-02**: KPI dashboard showing matched count, unmatched count, and reconciliation progress per company
- [ ] **DASH-03**: Document archive view of all uploaded invoices, receipts, and statements
- [ ] **DASH-04**: Visual reconciliation interface for the matching workflow

## v2 Requirements

### Enhanced Document Processing

- **DOC-05**: User can manually override OCR-extracted fields with confidence scoring UI
- **DOC-06**: System supports SAF-T file import/export (bridge Option C)

### Enhanced Workflow

- **FLOW-05**: User can add notes to exception items (pending/escalated/write-off)
- **FLOW-06**: User can view import session history and re-open prior reconciliations

### Reporting

- **RPT-01**: User can export reconciliation report as PDF or CSV
- **RPT-02**: User can view per-company reconciliation history (last reconciled dates)

### Additional Sage Integration

- **SAGE-05**: System can read from Sage via ODBC as a fallback (bridge Option B)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Auto-create transactions in Sage | Liability risk; accountants must create entries manually in Sage |
| Cloud hosting / remote access | LAN-only deployment; Sage SDK requires co-location |
| Mobile UI | Desktop workflow at accounting firm; mobile adds cost with no benefit |
| Multi-currency reconciliation | Significantly more complex matching logic; defer to v2+ |
| User authentication / RBAC | Trusted LAN, single firm; low security benefit vs friction |
| Real-time Sage sync | Sage SDK not designed for concurrent access; batch workflow is correct |
| AI/ML auto-learning from corrections | Insufficient training data at launch; rules-based matching covers 90%+ |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SAGE-01 | Phase 1 | Complete |
| SAGE-02 | Phase 1 | Complete |
| SAGE-04 | Phase 1 | Complete |
| DASH-01 | Phase 1 | Pending |
| BANK-01 | Phase 2 | Pending |
| BANK-02 | Phase 2 | Pending |
| BANK-03 | Phase 2 | Pending |
| REC-01 | Phase 2 | Pending |
| REC-02 | Phase 2 | Pending |
| REC-03 | Phase 2 | Pending |
| REC-04 | Phase 2 | Pending |
| SAGE-03 | Phase 3 | Pending |
| FLOW-01 | Phase 3 | Pending |
| FLOW-02 | Phase 3 | Pending |
| FLOW-03 | Phase 3 | Pending |
| FLOW-04 | Phase 3 | Pending |
| DOC-01 | Phase 4 | Pending |
| DOC-02 | Phase 4 | Pending |
| DOC-03 | Phase 4 | Pending |
| DOC-04 | Phase 4 | Pending |
| DASH-02 | Phase 5 | Pending |
| DASH-03 | Phase 5 | Pending |
| DASH-04 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-17*
*Last updated: 2026-03-17 — phase traceability added*
