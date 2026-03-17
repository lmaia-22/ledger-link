# Project Research Summary

**Project:** Ledger Link — Sage 50 Reconciliation Tool
**Domain:** LAN-hosted accounting reconciliation with COM/SDO integration (Sage 50 desktop, SMB accounting firms)
**Researched:** 2026-03-17
**Confidence:** MEDIUM

## Executive Summary

Ledger Link is a niche but well-scoped product: a LAN-hosted browser SPA that automates reconciliation between Sage 50 desktop accounting data and external bank statements / scanned documents. No identified competitor serves this exact niche (LAN-local, Sage 50 COM write-back, OCR, multi-company firm model). The dominant pattern for this type of tool is a Node.js HTTP server running as a Windows service, with a strictly isolated COM bridge to Sage's SDO API, feeding a rules-based multi-pass matching engine, reviewed by accountants via a React data-grid UI before any write-back to Sage occurs. The core technical bet — winax COM interop against Sage 50 SDO on Node.js 22 — is achievable but narrow: it requires Windows co-location with Sage data, careful connection lifecycle management, and all SDO calls isolated in a child process to avoid blocking the HTTP event loop.

The recommended approach is to validate the COM bridge in isolation before building anything else, then construct the matching pipeline (bank statement parsing + matching engine) as pure in-process logic, and finally layer the OCR document pipeline on top. This ordering is driven by the hard dependency graph: the Sage bridge gates everything, the matching engine gates the review UI, and the review UI gates reconciliation write-back. OCR enhances but does not block the core bank-vs-Sage workflow, so it can be developed in parallel and delivered alongside the core MVP. The full v1 feature set — Sage read/write, bank import, OCR, matching, multi-company support, review UI, audit trail — is MVP scope, not phased delivery, because the firm won't adopt a tool that omits OCR support for paper-based clients.

The key risks are all Phase 1 concerns: the COM bridge must run in a child process (not on the main event loop), monetary amounts must be stored as integer pence from the first line of parsing code, and the Sage SDO connection must open-and-close per operation (never held as a persistent singleton). Any one of these three mistakes, left to Phase 2 or beyond, requires expensive architectural refactoring. Security risk is lower than typical (LAN trust model, no external network), but Sage credential storage and append-only audit logging must be addressed before handoff to a real accounting firm.

---

## Key Findings

### Recommended Stack

The stack is a standard 2025 Node.js monorepo on Windows: Fastify 5 + TypeScript 5 on the backend, React 19 + Vite 6 + TanStack Table + TanStack Query on the frontend, SQLite via better-sqlite3 with Drizzle ORM for persistence, and winax for Sage COM interop. All choices prioritise zero-install-overhead (no external DB server, no compile step at runtime) and offline operation (no cloud OCR APIs — Tesseract.js runs locally). The non-negotiable Windows constraint is winax: it builds a native addon and must be installed on the Windows deployment machine directly, not copied from a Mac/Linux dev environment.

**Core technologies:**
- Node.js 22 LTS — runtime; prebuilt winax and better-sqlite3 binaries available for v22, avoiding native compile pain on the deployment machine
- TypeScript 5 — type safety pays off directly in financial matching logic; Drizzle and Fastify have first-class TS support
- Fastify 5 — HTTP server; built-in JSON schema validation, multipart file upload support; meaningfully better than Express for early error-catching
- React 19 + TanStack Table v8 — TanStack Table's API is the decisive reason to pick React over Vue here; it handles the core sortable/filterable match-review grid natively
- better-sqlite3 v11 + Drizzle ORM v0.40 — single-file SQLite, zero server process, WAL mode for light concurrent access; Drizzle surfaces schema changes as TypeScript errors before runtime
- winax v3 — the only actively maintained Node.js COM IDispatch wrapper with Node 22 prebuilts; all alternatives are abandoned or require .NET SDK
- tesseract.js v5 + pdfjs-dist v4 — offline OCR pipeline; pdfjs-dist extracts text from digital PDFs, tesseract.js handles scanned documents; neither requires external connectivity

**Critical version notes:**
- winax must match Node.js bitness (x64 for Sage 50 v30+; x86 for older 32-bit SDO installations — verify Sage version before choosing Node architecture)
- `node:sqlite` (built-in Node 22) is experimental and must NOT be used; use better-sqlite3
- Prisma must NOT be used (downloads a Rust binary at install time — fails on LAN machines without internet)

### Expected Features

The MVP is broader than typical for a v1 because the firm's core workflow requires the full loop: OCR support cannot be deferred without leaving paper-based clients unsupported from day one.

**Must have (table stakes for v1):**
- Sage 50 Read Integration via SDO/COM — gates everything; highest technical risk; prove this first
- Bank statement import (CSV + OFX) — primary document source; requires configurable column mapping for CSV (different UK banks export differently)
- Auto-matching engine (amount + date + reference; configurable tolerance) — core value proposition
- Match suggestion UI (side-by-side review, accept/reject, bulk-accept for exact matches) — required before any write-back; accountants are professionally liable
- Confirm/mark reconciled in Sage via SDO — completes the loop; without this it's a report, not a tool
- Unmatched items list with exception notes — clear end-state for accountants; surface prominently, not buried behind clicks
- Audit trail (action log: user, timestamp, matched pairs, confidence, action) — compliance requirement for accounting firms
- Multi-company support (up to ~10 Sage datasets) — firms won't adopt a single-client tool
- OCR for PDFs and scanned images (tesseract.js + pdfjs-dist) — stated constraint; deferred OCR means paper-based clients unsupported
- Document upload (PDF, JPG, PNG, TIFF) — prerequisite to OCR
- LAN browser UI on fixed IP/hostname — stated deployment model; no per-machine install
- Status dashboard per company (matched/unmatched/needs-attention counts) — starting-point view for accountants

**Should have (differentiators, add in v1.x after validation):**
- OCR confidence scoring with manual override — add once OCR is live and field-level error patterns are understood
- Import session history and re-reconciliation — add when accountants report needing to revisit closed sessions
- Exportable reconciliation report (PDF/CSV) — add when firms ask for filing evidence
- Per-company reconciliation history ("last reconciled" dates) — add once multi-company usage is established
- Exception status labels (pending / escalated / write-off) — add once exception notes are in active use

**Defer (v2+):**
- Configurable tolerance rules UI — v1 ships with sensible hardcoded defaults; the UI for tuning adds UX complexity that isn't needed until users hit limits
- Multi-currency matching — substantially more complex; defer until a foreign-currency client is actively onboarded
- User authentication / RBAC — LAN trust model is correct for v1; add only if the firm adds external staff or questions the trust model
- AI/ML auto-match learning — rules-based matching with configurable tolerance solves 90%+ of cases; ML is over-engineering for this data volume

**Confirmed anti-features (do not build):**
- Auto-create missing Sage transactions — explicitly out of scope; creates professional liability
- Real-time Sage sync — SDO concurrent read/write causes file-lock risks
- Cloud hosting — COM bridge is LAN-bound and Windows-only

### Architecture Approach

The architecture is a single-process Windows service (Fastify HTTP server) with one critical exception: all Sage SDO calls must run in a dedicated child process (child_process.fork) with IPC to the main process, because winax COM calls are synchronous and block the Node.js event loop. Everything else — matching engine, OCR, parsers, database — runs in-process. The matching engine is deliberately pure functions with no I/O, making it independently testable without Sage or a database. The COM bridge is isolated behind a TypeScript interface so the entire non-Sage codebase can be developed and tested on Mac/Linux with a mock bridge.

**Major components:**
1. Fastify HTTP Server + REST routes — thin HTTP layer; Zod validation on all inputs; returns JSON domain objects
2. Sage Bridge (sage-bridge/) — the only module that imports winax; runs in a child process; exposes a typed promise-based IPC interface; manages SDO connection lifecycle (open-per-operation, close-immediately-after)
3. Matching Engine (matching/) — pure functions; multi-pass strategy (exact → amount+date tolerance → reference fuzzy); produces MatchResult[] with confidence scores and strategy metadata
4. OCR Worker (ocr/) — tesseract.js adapter behind an interface; returns extracted fields with per-field confidence scores; runs async with job ID response pattern
5. Parsers (parsers/) — CSV (configurable column mapping) and OFX (handles both SGML and XML variants); normalises to ImportedTransaction domain type
6. Service Layer (services/) — orchestrates bridge + parsers + engine + database; manages reconciliation session lifecycle
7. SQLite / Drizzle (db/) — persists all app-owned state (sessions, imports, match results, audit log); never touches Sage .sdf files directly
8. React SPA (frontend) — TanStack Table for match review grid; TanStack Query for polling/caching; Vite build served as static files from Fastify

**Key data flows:**
- Bank import: upload → parse → normalise to ImportedTransaction → persist → return row count preview
- OCR import: upload → async OCR → field extraction with confidence → persist → return extracted fields for accountant confirmation
- Reconciliation run: open SDO → fetch SageEntries[] → load ImportedTransactions[] → multi-pass match → persist MatchResult[] (status: pending_review) → close SDO
- Confirmation: accountant reviews → PATCH confirm/reject → open SDO → write reconciled flag → close SDO → update MatchResult status → append audit log

### Critical Pitfalls

1. **COM calls on the main event loop** — winax COM IDispatch calls are synchronous and block Node.js entirely. Every SDO call must be isolated in a `child_process.fork()` with IPC. This is the single most expensive architectural mistake to fix retroactively. Address in Phase 1 before any feature work.

2. **Floating-point currency amounts** — JavaScript Number representation of amounts like £1,105.55 causes matching false negatives. Parse all monetary values to integer pence immediately on input (`Math.round(raw * 100)`); use integer arithmetic throughout; only convert back for display. Establish as a convention in the data model before any matching code is written.

3. **Persistent SDO connections locking out Sage users** — SDO connections consume a Sage user licence slot. Holding a connection open as a singleton locks out real accountants from Sage. Open per-operation, close immediately after, with a 30-second hard timeout. Never store a connection as a module-level singleton.

4. **SDO DLL version mismatch on Sage upgrade** — each Sage 50 major version ships a version-specific DLL. The COM ProgID must be selected dynamically based on the Sage version read from the Windows registry at startup. Hard-coding the ProgID for one Sage version silently breaks on every upgrade.

5. **OCR extraction without confidence scoring** — treating all OCR output as ground truth silently introduces wrong amounts/dates into the matching engine. Always capture and propagate per-field confidence scores; visually flag fields below threshold in the UI; require image preprocessing (300 DPI, deskew, binarise via sharp) before Tesseract.

6. **Bank statement CSV format variants** — every UK bank exports CSV differently. Hard-coding column positions fails on the second bank tested. The parser must implement configurable column mapping (user selects date/amount/description columns on import).

7. **Over-confident auto-matching** — never write a reconciliation back to Sage without explicit accountant confirmation, regardless of confidence score. Build the confirmation gate as a non-negotiable constraint before writing any matching code.

---

## Implications for Roadmap

Based on the dependency graph, pitfall phase mapping, and feature complexity, the following phase structure is recommended:

### Phase 1: Foundation and COM Bridge Spike
**Rationale:** The Sage COM bridge is the highest-risk item and the root dependency for nearly every feature. It must be proven on the target Windows machine before any other feature work begins. This phase also establishes the data model conventions (integer pence, domain types) that all later phases depend on. Mistakes made here are the most expensive to fix.
**Delivers:** A working Sage SDO connection that can read transactions from a real company file, without blocking the HTTP server. Database schema established. Integer-pence convention enforced throughout.
**Addresses:** Sage 50 Read Integration, Multi-company support (SDO connection switching), LAN deployment model
**Avoids:**
- COM event loop blocking (child_process.fork architecture)
- Persistent connections locking Sage users (open-per-operation lifecycle)
- SDO co-location constraint (deployment docs and validation)
- SDO DLL version mismatch (registry-based ProgID selection)
- Floating-point currency bugs (integer-pence convention in schema)
**Research flag:** NEEDS RESEARCH — Sage SDO API specifics for reading transactions/bank entries and writing reconciled flags; SDO connection string format per company; exact registry key for version detection

### Phase 2: Bank Statement Import and Matching Engine
**Rationale:** With a working COM bridge, the two inputs to the matching engine (Sage data and bank data) are available. The matching engine is pure functions with no Sage dependency and can be developed and unit-tested on any OS. Bank statement parsing must be done before matching can be tested with real data.
**Delivers:** CSV and OFX import with configurable column mapping; multi-pass matching engine producing MatchResult[] with confidence tiers; unit test suite for matching logic.
**Addresses:** Bank statement import (CSV + OFX), Auto-matching engine, Unmatched items identification
**Avoids:**
- Bank CSV format variants (configurable column mapping from the start)
- Over-confident auto-matching (matching engine produces suggestions, no write-back yet)
- OFX SGML vs XML variants (use ofx-data-extractor which handles both)
**Research flag:** STANDARD PATTERNS — CSV parsing and OFX parsing are well-documented; TanStack Table and matching algorithm patterns are established

### Phase 3: Match Review UI and Reconciliation Write-Back
**Rationale:** The review UI and Sage write-back must ship together — write-back without a review UI is a safety violation. This phase delivers the full end-to-end reconciliation loop and the audit trail that makes the tool professionally usable.
**Delivers:** Match suggestion UI (side-by-side review, confidence tiers, bulk accept for exact matches); confirm/reject per pair; reconciliation write-back to Sage SDO; append-only audit log; unmatched items list with exception notes.
**Addresses:** Match suggestion UI, Confirm/mark reconciled in Sage, Audit trail, Unmatched items list + exception notes
**Avoids:**
- Auto-reconcile without confirmation (confirmation gate enforced as architectural constraint)
- Undo path missing (implement un-mark reconciled before session close)
**Research flag:** STANDARD PATTERNS — TanStack Table row selection and UI patterns are well-documented; Fastify SSE for progress streaming is standard

### Phase 4: OCR Document Pipeline
**Rationale:** OCR is a stated v1 requirement (paper-based clients are unsupported without it) but it does not block the core bank-vs-Sage workflow. Delivering it in Phase 4 allows the core loop to be validated first while OCR is developed in parallel, then merged. The async job ID pattern for OCR must be designed before implementation to avoid the synchronous-blocking anti-pattern.
**Delivers:** Document upload endpoint (PDF, JPG, PNG, TIFF); async OCR extraction with per-field confidence scores; image preprocessing pipeline (sharp: deskew, binarise, 300 DPI upscale); extracted fields returned for accountant confirmation before entering matching engine; OCR-sourced transactions merged into reconciliation workflow.
**Addresses:** Document upload, OCR for scanned documents, OCR confidence scoring (build alongside extraction, not later)
**Avoids:**
- OCR blocking the HTTP event loop (async job ID + polling pattern)
- OCR without confidence scores (confidence is captured at extraction time, not added later)
- Visual ambiguity between OCR-extracted values and CSV-parsed values (badge OCR fields in UI)
**Research flag:** NEEDS RESEARCH — tesseract.js v5 language data for UK financial documents; sharp preprocessing parameters for invoice quality; field extraction regex patterns for UK invoice formats (amount, date, VAT number, reference)

### Phase 5: Multi-Company Dashboard and Session Management
**Rationale:** Multi-company support is partly delivered by Phase 1 (SDO switching), but the company dashboard and session history UI are lower-priority work that should not block the core reconciliation loop. This phase completes the multi-company experience and adds the import session history needed for month-end workflows.
**Delivers:** Status dashboard per company (matched/unmatched/needs-attention counts); import session history; per-company reconciliation history ("last reconciled" dates); exception status labels (pending/escalated/write-off).
**Addresses:** Status dashboard, Import session history, Per-company reconciliation history, Exception status labels
**Research flag:** STANDARD PATTERNS — dashboard UI patterns and session management are well-documented

### Phase 6: Polish, Reporting, and v1 Hardening
**Rationale:** Before handoff to a real accounting firm, the product needs exportable reports (firms need to file reconciliation evidence), progress indicators for slow Sage operations, and security hygiene (Sage credential storage, audit log completeness).
**Delivers:** Exportable reconciliation report (PDF/CSV); progress streaming via SSE during SDO fetch; Sage credential storage via Windows DPAPI (not plaintext config); deployment validation checklist (data path locally accessible, COM ProgID selectable, licence count); "looks done but isn't" checklist verification against real Sage data.
**Addresses:** Exportable reconciliation report, Security hardening, UX polish (progress indicators, undo confirmation)
**Research flag:** STANDARD PATTERNS — SSE in Fastify is standard; Windows DPAPI from Node.js is documented

### Phase Ordering Rationale

- Phase 1 comes first because the COM bridge is the critical path root: every feature with meaningful value depends on it, and the three most expensive architectural mistakes (event loop blocking, persistent connections, hard-coded DLL version) must be prevented before any feature code is written.
- Phases 2 and 4 can be developed in parallel by different contributors: the matching engine (Phase 2) has zero Sage or OCR dependency and can be built on any OS; the OCR pipeline (Phase 4) has zero matching engine dependency. The merge point is Phase 3.
- Phase 3 (write-back) must wait for Phase 2 (matching engine) and Phase 1 (COM bridge) to be complete. The review UI and write-back ship together as a safety constraint — never separately.
- Phases 5 and 6 are lower-risk polish work that should not gate the core loop validation with a real accounting firm.

### Research Flags

Phases needing deeper research during planning (use `/gsd:research-phase`):
- **Phase 1 (COM Bridge):** Sage SDO API surface for reading transactions, bank entries, and writing reconciled flags; exact registry key path for version detection; SDO connection string format; licence consumption behaviour; error handling for "in use by another user"
- **Phase 4 (OCR Pipeline):** UK financial document field extraction patterns; sharp preprocessing parameters for low-quality invoice scans; tesseract.js language data configuration for UK invoice formats; OFX SGML vs XML handling edge cases

Phases with well-documented patterns (skip research-phase):
- **Phase 2 (Matching Engine + Bank Import):** Multi-pass matching with confidence tiers is established; CSV/OFX parsing with csv-parse and ofx-data-extractor is well-documented
- **Phase 3 (Match Review UI):** TanStack Table row selection + confirmation patterns; Fastify PATCH endpoints; audit log append patterns are all standard
- **Phase 5 (Dashboard):** Company session management and dashboard aggregation queries are standard patterns
- **Phase 6 (Polish):** SSE progress streaming in Fastify; Windows DPAPI integration are documented patterns

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Core web stack (Fastify, React, SQLite, Drizzle) is HIGH confidence — official docs, community consensus. winax COM bridge is MEDIUM — actively maintained but sparsely documented for Node 22 specifics. OCR accuracy on UK financial documents is MEDIUM — tesseract.js WASM limitations are known but UK invoice benchmarks are not. |
| Features | MEDIUM | Industry surveys and competitor analysis reviewed; no direct user interviews. MVP feature set is well-reasoned from stated constraints. Feature prioritisation is informed opinion, not validated with real accountants. |
| Architecture | MEDIUM | COM bridge isolation pattern (child process IPC) is confirmed by winax maintainers and Sage KB. Matching engine patterns are well-documented from reconciliation domain literature. SDO concurrent access limitations are confirmed from official Sage file-locking KB. |
| Pitfalls | MEDIUM | Most critical pitfalls are backed by official Sage KB, winax GitHub issues, and IEEE 754 financial arithmetic documentation. OCR and bank format pitfalls are backed by multiple community sources. All are corroborated across at least two sources. |

**Overall confidence:** MEDIUM — sufficient to proceed to roadmap and requirements definition. The main uncertainties (SDO API specifics, OCR accuracy on real UK invoices) should be resolved in Phase 1 and Phase 4 spikes before committing to delivery timelines.

### Gaps to Address

- **Sage SDO write-back API specifics:** Research confirmed that SDO can set reconciled flags, but the exact property name (SDO `TAX_FLAG` behaviour warning noted) and the correct approach to marking bank entries as reconciled requires a Phase 1 spike against a real Sage 50 installation. Do not design the write-back interface without this validation.
- **Sage user licence consumption model:** SDO connections consume a Sage user licence slot, but the exact count (does each child process consume one? does open/close per operation reset it?) needs verification against the target Sage installation's licence tier.
- **UK bank CSV format coverage:** The parser must handle Barclays, Lloyds, and HSBC exports as a minimum. Column mapping UI design should be validated against real export samples before building the parser.
- **OCR accuracy floor on UK invoices:** tesseract.js v5 accuracy on real UK accountancy firm document quality is unknown without a test set. If accuracy is insufficient, the fallback (native Tesseract 5 CLI via child_process, with LSTM fine-tuning) adds operational complexity. Test early in Phase 4.
- **Sage 50 bitness on target machine:** Whether Sage 50 SDO on the firm's machine is 32-bit or 64-bit determines Node.js build architecture (x86 vs x64). This must be confirmed before the COM bridge is built. Sage v30+ ships 64-bit SDO, but the firm's exact version is unconfirmed.

---

## Sources

### Primary (HIGH confidence)
- [Sage 50 v32.1.342.0 Developer Release — Sage GB KB](https://gb-kb.sage.com/portal/app/portlets/results/view2.jsp?k2dockey=250905100100277) — latest SDO release, 64-bit SDO confirmation
- [Sage 50 Accounts — 64-bit architecture KB](https://gb-kb.sage.com/portal/app/portlets/results/view2.jsp?k2dockey=231121114136893) — 32-bit vs 64-bit SDO decision criteria
- [Sage KB: File Locking in Sage 50 Accounts](https://ie-kb.sage.com/portal/app/portlets/results/view2.jsp?k2dockey=200427112155714) — partial zone locks, integration contention
- [Sage KB: Development Basics for Sage 50 Accounts (UK)](https://gb-kb.sage.com/portal/app/portlets/results/viewsolution.jsp?solutionid=200518071050312) — SDO capabilities, TAX_FLAG warning
- [better-sqlite3 GitHub — Node 22 core sqlite vs better-sqlite3](https://github.com/WiseLibs/better-sqlite3/discussions/1245) — production recommendation from library maintainer
- [tesseract.js GitHub](https://github.com/naptha/tesseract.js) — WASM-based, no native PDF support, v5 Node 22 support

### Secondary (MEDIUM confidence)
- [winax / node-activex GitHub](https://github.com/durs/node-activex) — COM IDispatch, Node 22 prebuilts, confirmed synchronous-only behaviour (issue #31)
- [Codat: Developer's Guide to Building a Sage 50 Integration](https://codat.io/blog/a-developers-guide-to-building-a-sage-50-integration/) — SDO architecture constraints, ODBC misuse warning
- [Sage Developer Community — Getting Started with SDO](https://developer-community.sage.com/topic/588-getting-started-with-sage-data-objectssage-50-integration/) — SDO access patterns, concurrent user limitations
- [Optimus Tech: Fuzzy Matching in Bank Reconciliation](https://optimus.tech/blog/fuzzy-matching-algorithms-in-bank-reconciliation-when-exact-match-fails) — confidence-tiered matching strategy
- [Medium: Floating Point Standard Breaking Financial Software](https://medium.com/@sohail_saifii/the-floating-point-standard-thats-silently-breaking-financial-software-7f7e93430dbb) — integer-pence storage
- [Tesseract OCR: Improving Quality](https://tesseract-ocr.github.io/tessdoc/ImproveQuality.html) — 300 DPI, preprocessing steps
- [Cube Software, DOKKA, Numeric, Ramp, Klippa — reconciliation software comparisons](https://www.cubesoftware.com/blog/account-reconciliation-software) — feature landscape, competitor positioning

### Tertiary (LOW confidence)
- [TanStack 2025 recommended React stack (Cory House)](https://x.com/housecor/status/1948105214017380774) — Vite + TanStack Query stack recommendation (single practitioner opinion, consistent with other sources)
- [Fastify vs Express 2025 — Medium/CodeToDeploy](https://medium.com/codetodeploy/express-or-fastify-in-2025-whats-the-right-node-js-framework-for-you-6ea247141a86) — framework comparison (community article)

---
*Research completed: 2026-03-17*
*Ready for roadmap: yes*
