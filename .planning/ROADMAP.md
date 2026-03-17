# Roadmap: Ledger Link

## Overview

Ledger Link is built in five phases that follow the dependency graph of the problem: the Sage COM bridge must be proven first because every meaningful feature depends on it, the matching engine is built next as pure in-process logic, the review UI and write-back ship together as a safety unit, the OCR pipeline layers on top once the core loop is validated, and the dashboard completes the multi-company experience. Each phase delivers a coherent, independently verifiable capability.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation and Sage Bridge** - LAN server scaffold + Sage SDO COM bridge running in isolated child process
- [ ] **Phase 2: Bank Import and Matching Engine** - CSV/OFX import with configurable column mapping + multi-pass matching engine
- [ ] **Phase 3: Match Review UI and Reconciliation Write-Back** - Side-by-side review workflow + confirmed write-back to Sage + audit trail
- [ ] **Phase 4: OCR Document Pipeline** - Document upload + async OCR extraction with per-field confidence scores
- [ ] **Phase 5: Dashboard and Company UI** - KPI dashboard + document archive + company-level reconciliation status

## Phase Details

### Phase 1: Foundation and Sage Bridge
**Goal**: The LAN server runs, serves the browser UI, connects to Sage via the COM bridge in an isolated child process, and reads transactions from a real company dataset without blocking the HTTP server
**Depends on**: Nothing (first phase)
**Requirements**: SAGE-01, SAGE-02, SAGE-04, DASH-01
**Success Criteria** (what must be TRUE):
  1. A browser on any LAN machine can reach the app at the server's IP and load the UI
  2. The server connects to a Sage company file via the SDO COM bridge and reads transaction records
  3. The server can switch between two different Sage company datasets and return distinct data for each
  4. The HTTP server remains responsive during an SDO read operation (COM calls do not block the event loop)
  5. Integer-pence convention is enforced in the database schema and all amounts read from Sage are stored as integers
**Plans**: TBD

### Phase 2: Bank Import and Matching Engine
**Goal**: Accountants can import bank statements in CSV and OFX formats, and the matching engine produces categorised match results (exact, approximate, no match) against Sage entries
**Depends on**: Phase 1
**Requirements**: BANK-01, BANK-02, BANK-03, REC-01, REC-02, REC-03, REC-04
**Success Criteria** (what must be TRUE):
  1. User can upload a CSV bank statement and map columns (date, amount, description, reference) before import
  2. User can upload an OFX bank statement and have transaction data extracted automatically
  3. Running a reconciliation produces a results list where each bank movement is labelled as exact match, approximate match (within 2%), or no match
  4. Two bank movements with the same amount but a known fee difference of under 2% are classified as approximate matches, not mismatches
  5. Matching engine functions can be run and verified independently without a Sage connection or database
**Plans**: TBD

### Phase 3: Match Review UI and Reconciliation Write-Back
**Goal**: Accountants can review match suggestions side-by-side, confirm or reject each pair, see all unmatched items in a dedicated list, and confirmed matches are written back to Sage as reconciled — with every action logged
**Depends on**: Phase 2
**Requirements**: SAGE-03, FLOW-01, FLOW-02, FLOW-03, FLOW-04
**Success Criteria** (what must be TRUE):
  1. User can view each suggested match pair showing the document entry and the bank movement side-by-side with their confidence tier
  2. User can accept or reject individual match suggestions, and accepted matches are marked as reconciled in Sage via the SDO bridge
  3. User can view all unmatched items in a "needs attention" list that is clearly visible without navigating away from the main workflow
  4. Every accept and reject action is recorded in the audit log with the pair details and a timestamp
  5. No match is written to Sage without an explicit accountant confirmation action — the system never auto-reconciles
**Plans**: TBD

### Phase 4: OCR Document Pipeline
**Goal**: Accountants can upload invoices and receipts (PDF, JPG, PNG) and have structured fields extracted via local OCR, with per-field confidence scores surfaced for review before documents enter the reconciliation workflow
**Depends on**: Phase 2
**Requirements**: DOC-01, DOC-02, DOC-03, DOC-04
**Success Criteria** (what must be TRUE):
  1. User can upload a PDF invoice or a scanned image (JPG/PNG) and receive extracted fields (emitente, NIF, IBAN, IVA, totals) without the server becoming unresponsive during processing
  2. Each extracted field is displayed with a confidence score (high/medium/low), and fields below threshold are visually flagged for manual review
  3. User can upload a scanned bank statement image and have bank movements extracted via OCR, producing the same normalised transaction format as a CSV import
  4. OCR-extracted documents appear in the reconciliation workflow alongside CSV/OFX-imported transactions and are eligible for matching
**Plans**: TBD

### Phase 5: Dashboard and Company UI
**Goal**: Accountants have a clear starting-point view showing the reconciliation status of each Sage company and can browse all uploaded documents in an organised archive
**Depends on**: Phase 3, Phase 4
**Requirements**: DASH-02, DASH-03, DASH-04
**Success Criteria** (what must be TRUE):
  1. User lands on a dashboard that shows each active Sage company with its matched count, unmatched count, and reconciliation progress
  2. User can navigate to a document archive and see all uploaded invoices, receipts, and statements with their extraction status
  3. User can access the visual reconciliation interface for any company directly from the dashboard without additional navigation steps
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation and Sage Bridge | 0/TBD | Not started | - |
| 2. Bank Import and Matching Engine | 0/TBD | Not started | - |
| 3. Match Review UI and Reconciliation Write-Back | 0/TBD | Not started | - |
| 4. OCR Document Pipeline | 0/TBD | Not started | - |
| 5. Dashboard and Company UI | 0/TBD | Not started | - |
