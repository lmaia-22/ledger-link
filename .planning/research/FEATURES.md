# Feature Research

**Domain:** Accounting reconciliation automation (desktop accounting software, SMB/firm)
**Researched:** 2026-03-17
**Confidence:** MEDIUM — industry surveys, competitor analysis, and official Sage documentation reviewed. No direct user interviews; some claims inferred from product feature lists.

## Feature Landscape

### Table Stakes (Users Expect These)

Features accountants assume any reconciliation tool has. Missing one makes the product feel unfinished or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Bank statement import (CSV, OFX) | Primary workflow entry point; accountants already export statements in these formats | LOW | OFX is stricter/easier to parse than CSV. CSV requires column mapping UI or convention. Both are in scope per PROJECT.md. |
| Transaction auto-matching (amount + date + reference) | Every reconciliation tool does this; manually matching is the pain being replaced | MEDIUM | Must handle tolerance (e.g. ±1 day, ±0.01 for rounding). Fuzzy reference matching needed for partial invoice numbers. |
| Unmatched items list ("needs attention" queue) | Without this the tool has no clear output; accountants need to know what's left | LOW | Simple filtered view of unmatched rows from both sides. Critical for the workflow to have a clear end state. |
| Sage 50 read integration (transactions, invoices) | Ledger Link's entire value is against Sage data; without this it's just a file diff tool | HIGH | Windows-only, COM/SDO bridge. Only realistic approach for Sage 50 desktop. Biggest technical risk in the project. |
| Confirm/mark reconciled in Sage | Accountants expect changes to persist in Sage; a read-only tool forces manual re-entry | HIGH | Writes back to Sage via SDO. Reconcile-only (no auto-create) per PROJECT.md constraints. Must be atomic to avoid partial states. |
| Match suggestion UI (review before confirming) | Accountants are professionally liable; they need to review before committing | LOW | Display pairs side-by-side with amount/date/reference. Accept/reject per pair. Bulk accept for high-confidence matches. |
| Audit trail (who confirmed what, when) | Compliance and error recovery; if a reconciliation is questioned, there must be a record | MEDIUM | Log every confirm/reject action with timestamp and user. Queryable. Persisted independently of Sage. |
| Multi-company support (up to ~10 Sage datasets) | Firm has multiple clients in separate Sage companies; tool must switch between them cleanly | MEDIUM | Sage SDO supports switching dataset via connection string. Per-company state (reconciliation history, imports) must be isolated. |
| OCR for scanned documents (PDF, images) | Mixed document sources are a stated constraint; without OCR, paper-based clients are unsupported | HIGH | Highest implementation complexity in the feature set. Field extraction: amount, date, invoice/reference number. Confidence scoring required. |
| Document upload (PDF, image) | Prerequisite to OCR; accountants need to bring source documents into the tool | LOW | File upload endpoint. Acceptable formats: PDF, JPG, PNG, TIFF. Size limits needed. |
| LAN-accessible browser UI | Stated requirement: any machine on the LAN should be usable without per-machine installs | LOW | Standard Node.js HTTP server on a fixed LAN IP/hostname. No auth complexity for v1 (trusted LAN). |
| Status dashboard per company | Accountants managing multiple clients need a quick view of reconciliation completeness | LOW | Summary counts: matched, unmatched, needs attention. Per-company, per-import-session. |

### Differentiators (Competitive Advantage)

Features that make Ledger Link stand out against manual workflows and generic reconciliation tools. Given the niche (Sage 50 + LAN + SMB accountancy firms), differentiation is mostly about depth of Sage integration and workflow fit rather than AI sophistication.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Sage 50-native reconciliation write-back | Most third-party tools are read-only or require cloud Sage versions; direct SDO write-back for desktop Sage 50 is rare | HIGH | Directly marks Sage transactions as reconciled via SDO. Only possible because we run on the LAN alongside Sage. Cloud tools cannot do this. |
| OCR confidence scoring with manual override | Prevents silent OCR errors — accountants see extraction confidence and can correct before matching | MEDIUM | Per-field confidence percentage. Fields below threshold highlighted for review. Correction stored for audit trail. |
| Tolerance-based matching rules (configurable) | Bank charges, rounding, and partial payments cause mismatches in simple tools; configurable tolerance reduces false negatives | MEDIUM | Per-company or global rules. Amount tolerance (absolute or %). Date window (±N days). Reference partial-match (contains/starts-with). |
| Import session history and re-reconciliation | If an error is found post-close, accountants need to replay a session; most tools make this painful | MEDIUM | Store each import as a session with full state. Allow re-opening a closed session to view/audit. Do not re-write to Sage automatically on re-open. |
| Clear exception workflow with notes | When an item can't be matched, accountants need to annotate why (e.g. "client to provide invoice"); tools that just list exceptions waste time | LOW | Per-exception notes field. Status labels: "pending", "escalated", "write-off". Exportable exception report. |
| Exportable reconciliation report (PDF/CSV) | Firms need to file evidence of reconciliation; most tools target enterprise audit systems, not simple print-and-file workflows | LOW | Per-session report: matched pairs, unmatched items, exceptions with notes. Firm branding optional. |
| Per-company reconciliation history | Firms return to the same client each month; showing last reconciliation date and outstanding items from prior sessions saves re-work | LOW | Persist session metadata per company. Show "last reconciled" dates by account type. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem valuable but create disproportionate cost, risk, or scope creep for this product and user base.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Auto-create missing transactions in Sage | "If the invoice is in the PDF but not in Sage, just create it" | Accountants are responsible for every Sage entry; auto-creation bypasses their review, creates liability, and risks corrupting Sage data. Explicitly out of scope in PROJECT.md. | Surface the gap clearly in the unmatched list with the extracted document details, so the accountant can create the transaction in Sage manually and then re-run matching. |
| Real-time / live Sage sync | "Show me live Sage data as I work" | Sage 50 SDO does not support concurrent read/write well; live polling creates file-lock risks and degrades Sage performance. Sage itself is not designed for concurrent COM access during active use. | Batch import model: accountant triggers a Sage data pull at the start of a session. Clearly show the "as of" timestamp so staleness is visible. |
| Cloud hosting / remote access | "I want to access from home" | Requires Sage SDO COM bridge to be reachable externally, which is a Windows-only, LAN-bound component. Punches a hole in the network security perimeter. Out of scope per PROJECT.md. | LAN-only is the correct boundary. If remote access is ever required, VPN to the LAN is the accountant's own concern, not the tool's. |
| Mobile UI | "I want to check status on my phone" | Reconciliation requires careful review of paired transactions; a small screen makes this error-prone. The user base (accounting firm) works at desks. Building mobile adds significant CSS/UX cost for negligible benefit in v1. | Responsive web layout for desktop browsers is sufficient. Revisit if usage data shows mobile demand. |
| Full AP/AR workflow (purchase orders, approvals) | "While you're in Sage, can you also handle approvals?" | Sage already handles AP/AR. Duplicating workflow creates sync conflicts and undermines Sage as the system of record. | Ledger Link's role is reconciliation verification, not transaction origination. Keep the boundary clear. |
| Multi-currency reconciliation engine | "Our clients have foreign currency transactions" | Multi-currency matching requires exchange-rate lookups, date-of-transaction FX rates, and gain/loss handling. Adds significant algorithmic complexity. Sage SDO exposes currency data but matching logic becomes non-trivial. | Support single-currency matching in v1. Surface multi-currency transactions in the unmatched list with a "foreign currency — manual review" label. |
| AI / ML auto-match learning | "The tool should learn from my corrections" | Training a model requires labelled data volume the tool won't have in early use. Off-the-shelf ML for matching is over-engineering when rules-based matching with configurable tolerance solves 90%+ of cases for this domain. | Rules-based matching with user-configurable tolerance covers the real variance. Add pattern-learning only if post-launch data shows rules are insufficient. |
| User authentication and role-based access | "Different accountants should see different clients" | For a LAN-only tool used within a single trusted firm, authentication adds friction (lost passwords, session management) with minimal security gain. The threat model is internal, not external. | LAN trust model for v1. If the firm grows or adds external contractors, add simple password protection then. Keep the v1 deployment friction low. |

## Feature Dependencies

```
[Sage 50 Read Integration]
    └──required-by──> [Auto-matching engine]
    └──required-by──> [Confirm/mark reconciled in Sage]
    └──required-by──> [Multi-company support]

[Bank Statement Import (CSV/OFX)]
    └──required-by──> [Auto-matching engine]

[Document Upload]
    └──required-by──> [OCR extraction]
                          └──required-by──> [Auto-matching engine (document side)]
                          └──enhances──>   [OCR confidence scoring + override]

[Auto-matching engine]
    └──required-by──> [Match suggestion UI]
    └──required-by──> [Unmatched items list]
    └──enhances──>    [Tolerance-based matching rules]

[Match suggestion UI]
    └──required-by──> [Confirm/mark reconciled in Sage]
    └──required-by──> [Audit trail]

[Unmatched items list]
    └──enhances──>    [Exception workflow with notes]
    └──enhances──>    [Exportable reconciliation report]

[Import session history]
    └──enhances──>    [Per-company reconciliation history]
    └──enhances──>    [Status dashboard per company]
```

### Dependency Notes

- **Sage 50 Read Integration is the critical path root:** Nearly every feature depends on it. This is the highest-risk item and must be proven in Phase 1 before other features are built on top of it.
- **Auto-matching engine has two independent inputs:** bank statement rows and OCR-extracted document rows. Both paths converge at the matching engine, but they can be developed in parallel — bank statement matching first, OCR second.
- **Confirm/mark reconciled requires match suggestion UI:** Write-back to Sage must only happen after accountant review. These two features must ship together; write-back without review UI is dangerous.
- **OCR enhances but does not block matching:** The engine can match bank lines against Sage without OCR. OCR is additive for the document side of the workflow. This allows phased delivery: bank-vs-Sage matching first, document matching second.
- **Exception workflow notes enrich but don't block unmatched list:** The unmatched list is table stakes; notes/labels are a differentiator that can be added in v1.x.

## MVP Definition

### Launch With (v1)

Minimum viable product — validates that the Sage 50 integration works and delivers real time savings.

- [ ] Sage 50 Read Integration (SDO/COM) — proves the core technical bet; everything else is blocked on this
- [ ] Bank statement import (CSV + OFX) — primary document source for most accountants
- [ ] Auto-matching engine (amount, date, reference; configurable tolerance) — core value proposition
- [ ] Match suggestion UI (side-by-side review, accept/reject per pair, bulk accept) — required before write-back
- [ ] Confirm/mark reconciled in Sage via SDO — completes the loop; without this it's a report, not a tool
- [ ] Unmatched items list with exception notes — clear output state for accountants to act on
- [ ] Audit trail (action log per session) — professional liability requirement
- [ ] Multi-company support (up to 10 Sage datasets) — firms won't adopt a single-client tool
- [ ] LAN browser UI — deployment model per PROJECT.md
- [ ] OCR for PDFs and scanned images — mixed document sources are a stated constraint; deferring OCR means paper-based clients are unsupported from day one
- [ ] Document upload (PDF, JPG, PNG) — prerequisite to OCR
- [ ] Status dashboard per company — gives accountants a starting-point view without digging into sessions

### Add After Validation (v1.x)

Features to add once core workflow is proven and user feedback collected.

- [ ] OCR confidence scoring with manual override — add once OCR is live and field-level error patterns are understood
- [ ] Import session history and re-reconciliation — add when accountants report needing to revisit closed sessions
- [ ] Exportable reconciliation report (PDF/CSV) — add when firms ask for filing evidence; validate format preference first
- [ ] Per-company reconciliation history — add once multi-company usage is established and "last reconciled" queries appear
- [ ] Exception status labels (pending / escalated / write-off) — add once exception notes are in use and patterns emerge

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] Tolerance-based matching rules UI (configurable per company) — v1 can ship with sensible defaults baked in; UI for tuning adds UX complexity; defer until users hit rule limits
- [ ] Multi-currency support — defer until a client with foreign currency transactions is actively onboarded; the matching logic is substantially more complex
- [ ] User authentication / role-based access — defer unless the firm adds staff beyond the initial team or the LAN trust model is questioned
- [ ] Email or notification alerts for exception queues — defer; accountants work batch, not real-time; alerts may create noise without demand signal

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Sage 50 Read Integration (SDO/COM) | HIGH | HIGH | P1 — gates everything |
| Bank statement import (CSV/OFX) | HIGH | LOW | P1 |
| Auto-matching engine | HIGH | MEDIUM | P1 |
| Match suggestion UI | HIGH | LOW | P1 |
| Confirm/mark reconciled in Sage | HIGH | HIGH | P1 |
| Unmatched items list + exception notes | HIGH | LOW | P1 |
| Audit trail | HIGH | MEDIUM | P1 |
| Multi-company support | HIGH | MEDIUM | P1 |
| OCR (PDF + scanned images) | HIGH | HIGH | P1 — stated constraint |
| Document upload | HIGH | LOW | P1 — prereq to OCR |
| Status dashboard | MEDIUM | LOW | P1 |
| OCR confidence scoring + override | MEDIUM | MEDIUM | P2 |
| Import session history | MEDIUM | MEDIUM | P2 |
| Exportable reconciliation report | MEDIUM | LOW | P2 |
| Per-company reconciliation history | MEDIUM | LOW | P2 |
| Exception status labels | LOW | LOW | P2 |
| Configurable tolerance rules UI | MEDIUM | MEDIUM | P3 |
| Multi-currency matching | LOW | HIGH | P3 |
| User auth / RBAC | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

Context: Ledger Link is in a niche not well-served by existing tools. General reconciliation tools (BlackLine, Numeric, Trintech) target enterprise cloud ERP. Tools that support Sage are mostly Sage's own cloud products. No identified competitor does LAN-local reconciliation against Sage 50 desktop via SDO with OCR.

| Feature | General SaaS tools (BlackLine, Numeric) | Sage Bank Reconciliation (built-in) | Ledger Link (planned) |
|---------|----------------------------------------|--------------------------------------|----------------------|
| Sage 50 desktop (COM/SDO) write-back | No — cloud ERP only | Yes (native) | Yes — key differentiator |
| Bank statement import (CSV/OFX) | Yes | Yes | Yes |
| OCR for scanned documents | Some (Nanonets, DOKKA) | No | Yes |
| Multi-company (firm model) | Yes (enterprise) | Limited (single dataset at a time) | Yes |
| LAN-local deployment | No — cloud-hosted | No — requires Sage cloud or hosted | Yes |
| Configurable matching tolerance | Yes (enterprise) | Limited | Yes (v1 defaults, v1.x UI) |
| Audit trail | Yes | Limited | Yes |
| Price / access model | Enterprise pricing | Bundled with Sage | Custom / firm licence |

## Sources

- [Best Account Reconciliation Software Solutions for 2026 — Cube Software](https://www.cubesoftware.com/blog/account-reconciliation-software)
- [12 Best Account Reconciliation Software — DOKKA](https://dokka.com/best-account-reconciliation-software/)
- [10 Best Account Reconciliation Software Options for 2025 — Numeric](https://www.numeric.io/blog/account-reconciliation-software)
- [Account Reconciliation Software: Best Tools & How to Choose — Ramp](https://ramp.com/blog/accounting-reconciliation-software)
- [The 7 Best Reconciliation Software for 2026 — Klippa](https://www.klippa.com/en/blog/information/reconciliation-software/)
- [Sage 50 Bank Reconciliation — Cointab](https://www.cointab.net/us/sage-50-bank-reconciliation-streamlining-your-financial-processes/)
- [Bank reconciliation software — Sage US](https://www.sage.com/en-us/integrated-payment-solutions/bank-reconciliation-software/)
- [OCR Invoice Processing — Tipalti](https://tipalti.com/resources/learn/ocr-invoice-processing/)
- [Invoice data extraction — Microsoft Azure Document Intelligence](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/prebuilt/invoice)
- [Sage Intacct Bank Reconciliation Automation — Rand Group](https://www.randgroup.com/insights/sage/sage-intacct-bank-reconciliation-automation-makes-life-easier/)

---
*Feature research for: Accounting reconciliation automation with Sage 50 (Ledger Link)*
*Researched: 2026-03-17*
