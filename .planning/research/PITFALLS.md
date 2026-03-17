# Pitfalls Research

**Domain:** Accounting reconciliation automation with Sage 50 COM SDK integration
**Researched:** 2026-03-17
**Confidence:** MEDIUM (SDO specifics from official Sage KB + community; COM/Node.js from GitHub issues + official docs; OCR/matching from multiple verified sources)

## Critical Pitfalls

### Pitfall 1: Treating winax COM Calls as Async-Safe

**What goes wrong:**
Winax (and its fork node-activex) wraps COM objects in Node.js but every call is synchronous and blocks the event loop. Wrapping calls in `async/await` or promises does not make them non-blocking — they still execute on the main thread and freeze the entire HTTP server while waiting for Sage to respond. A slow SDO query (e.g., fetching all transactions for a large company file) can lock the server for seconds, causing all concurrent HTTP requests to queue.

**Why it happens:**
Developers assume that wrapping `winax` calls in promises converts them to async I/O. The npm package README does not prominently warn about this. The COM STA (Single-Threaded Apartment) model requires all calls to the object to happen on the thread that created it, which in Node.js is the main event loop thread.

**How to avoid:**
Isolate all COM/SDO interactions in a dedicated child process (using `child_process.fork()`), not a worker thread. The main Express/Fastify process communicates with the COM child via IPC messages. This is the only viable workaround confirmed by winax maintainers. The COM child process handles one Sage company at a time; concurrent company requests spawn separate children or queue through one.

**Warning signs:**
- HTTP endpoints that call SDO functions start timing out under any concurrent load
- `async/await` on winax calls feels fast in isolation but the server hangs when two requests arrive simultaneously
- Any use of `Promise.all([sageQuery1, sageQuery2])` silently serialises instead of parallelising

**Phase to address:**
Phase 1 (COM bridge / Sage connectivity spike). The architecture decision must be made before any feature work begins, because retrofitting IPC after the fact requires rewriting all SDO call sites.

---

### Pitfall 2: SDO DLL Version Must Exactly Match the Installed Sage 50 Version

**What goes wrong:**
Each major Sage 50 release ships a version-specific DLL (e.g., `SG50SdoEngine280.dll` for v28, `SG50SdoEngine320.dll` for v32). The project must reference the DLL matching the exact installed version. When the firm upgrades Sage, the integration silently breaks with a COM registration error until the new SDK DLL is installed and the COM object references are updated.

**Why it happens:**
Developers test against one Sage version and never plan for the upgrade lifecycle. The SDO DLL classes share identical names across versions but have no shared base type — there is no polymorphic `ISageCompany` interface to code against.

**How to avoid:**
- At startup, detect the installed Sage version by reading the registry key `HKLM\SOFTWARE\Sage\Accounts\CurrentVersion` (or equivalent) and dynamically select the correct COM ProgID.
- Document the DLL registration step (`regsvr32 sg50sdoengineXXX.dll`) in the deployment guide and test the version-detection logic before every Sage upgrade.
- Maintain a mapping table of Sage version → COM ProgID in config so updates require only a config change.

**Warning signs:**
- `Error creating COM object: Class not registered` on first run after a Sage update
- Integration works on the developer machine (one version) but fails on the firm's server (different version)
- No automated test that validates COM object instantiation succeeds

**Phase to address:**
Phase 1 (COM bridge spike). The version-detection and ProgID-selection logic must be part of the initial COM bridge, not an afterthought.

---

### Pitfall 3: Floating-Point Arithmetic for Currency Comparison

**What goes wrong:**
Amounts read from Sage SDO, parsed from CSV bank statements, and extracted via OCR all arrive as floating-point numbers. Comparing `115.10 === 115.10` fails because binary float representation of 0.10 is `0.10000000000000000555...`. This causes legitimate exact-amount matches to be missed, or worse, near-matches at different amounts to be incorrectly confirmed as exact matches.

**Why it happens:**
JavaScript's `Number` type is IEEE 754 double-precision float. It is the default for all parsed numeric values. The issue is invisible in small tests but surfaces with amounts like `£1,105.55` that accumulate representation error.

**How to avoid:**
Store and compare all monetary amounts as integers in minor currency units (pence, cents). Convert immediately on input: `Math.round(parseFloat(value) * 100)`. Use integer arithmetic throughout matching. Only convert back to display-formatted decimals for the UI layer. Never use `===` or `>` comparisons on raw float amounts.

**Warning signs:**
- Match confidence scores have unexpected near-misses on amounts that look identical
- Unit tests for matching pass but integration tests against real data produce spurious failures
- Any code that does `amount1 === amount2` or `Math.abs(amount1 - amount2) < 0.01` with raw floats

**Phase to address:**
Phase 1 (data model / import parsing). Must be established as a convention before any matching logic is written.

---

### Pitfall 4: Assuming Sage SDO Is Accessible from Any Machine on the LAN

**What goes wrong:**
SDO is a COM-based ActiveX DLL that requires the Sage 50 data files to be locally accessible. The Node.js backend cannot call SDO over the network — both the backend process and the Sage data directory must be on the same machine (or the data directory must be on a network share accessible to the machine running the backend). Running the Node.js backend on a separate LAN machine from the Sage data server and expecting SDO calls to work transparently is a deployment failure.

**Why it happens:**
Developers familiar with HTTP APIs assume COM objects behave like remote services. The architecture docs describe a "LAN deployment" without clarifying that the Node.js process must co-locate with Sage (or at least have local/UNC path access to the Sage data directory).

**How to avoid:**
The Node.js backend must run as a Windows service on the machine that hosts the Sage data. Deployment documentation must state this explicitly. If the firm wants the UI served from a different machine, only the frontend (static files) can move — the backend stays on the Sage host.

**Warning signs:**
- Deployment instructions say "install the backend on any machine"
- No validation step in the installer that checks whether the Sage data path is locally accessible
- The COM object instantiates but company-open calls fail with "unable to connect to Sage Data Service"

**Phase to address:**
Phase 1 (COM bridge spike) and deployment documentation. The architecture diagram must show the co-location constraint before any other phases proceed.

---

### Pitfall 5: Over-Confident Auto-Matching Leading to Silent Mis-Reconciliation

**What goes wrong:**
The reconciliation tool matches bank statement lines to Sage transactions and automatically marks them reconciled without requiring accountant review. When the matching algorithm produces false positives — two transactions with the same amount and approximate date but different payees — the reconciliation record in Sage is wrong. Accountants only discover this during year-end audit when discrepancies are time-consuming to unwind.

**Why it happens:**
Developers optimise for "fewer clicks" and treat high match-confidence scores as sufficient authorisation. Matching by amount+date alone is insufficient — many transactions share these fields (e.g., monthly direct debits of identical amounts, split invoices).

**How to avoid:**
- Never auto-reconcile without an explicit human confirmation step, even at 99% confidence. The UI presents suggestions; the accountant clicks "confirm" per match.
- Use three independent signals: amount (exact integer pence), date (within configurable tolerance, e.g., ±3 days), and reference/description (fuzzy string similarity). Require all three to flag as high-confidence.
- Store confidence score breakdown (amount match, date match, reference match) in the match record so accountants can understand why a suggestion was made.
- Provide a tiered UI: exact matches prominently listed first, fuzzy matches below with their score breakdown.

**Warning signs:**
- The codebase has a "auto_reconcile_threshold" config that, if set high, bypasses the confirmation step
- Matching only uses amount + date (missing the reference/description signal)
- No audit trail recording which user confirmed which match at what time

**Phase to address:**
Phase 2 (matching algorithm) and Phase 3 (review UI). The confirmation-required rule must be a stated non-negotiable before matching is built.

---

### Pitfall 6: OCR Extracting Amounts and Dates Silently Without Confidence Scoring

**What goes wrong:**
OCR runs on a scanned invoice, extracts `£1,105.55` and `12/03/2026`, and the system treats these as ground truth. In reality, a smudged document may have been read as `£1,105.55` when the actual amount was `£1,005.55` (the `1` misread). The mis-extracted amount then fails to match the correct Sage entry, sending it to the "needs attention" list — but the accountant sees no indication that the OCR itself may be wrong.

**Why it happens:**
OCR libraries (Tesseract, cloud APIs) return extracted text but their per-character confidence scores are often ignored by integrating code. The system treats all OCR output as equally reliable.

**How to avoid:**
- Always capture and propagate the OCR confidence score for each extracted field (amount, date, reference) alongside the value.
- In the UI, visually flag any extracted field with confidence below a configurable threshold (e.g., < 85%) with a "verify this value" indicator.
- For scanned documents (as opposed to digital PDFs), require image preprocessing before OCR: 300 DPI minimum, deskew, binarisation, noise removal using `sharp` before passing to Tesseract.
- Treat OCR output as a hypothesis, not a fact. Display the source image region alongside the extracted field so accountants can visually verify when confidence is low.

**Warning signs:**
- OCR extraction returns only the extracted text string, no confidence metadata
- No image preprocessing step before Tesseract
- The UI shows extracted amounts with the same styling as user-entered or CSV-parsed data (no visual distinction)

**Phase to address:**
Phase 2 (document ingestion / OCR pipeline). The confidence-flagging mechanism must be built alongside the extraction, not as a later enhancement.

---

### Pitfall 7: Bank Statement Parsing Failing on Format Variants

**What goes wrong:**
The tool advertises CSV and OFX import. The first bank tested works. The second bank uses a non-standard CSV column order, a different date format (`DD-MMM-YYYY` vs `YYYY-MM-DD`), or a Windows-1252 encoding instead of UTF-8. The parser throws a silent error or produces wrong dates and amounts, which then fail to match anything in Sage. The accountant sees everything as "unmatched" and assumes the tool is broken.

**Why it happens:**
There is no universal CSV bank statement format. Every UK bank exports differently. OFX has two sub-formats: SGML-style (no closing tags, used by most UK banks) and XML-style. Developers test with one bank's export and ship.

**How to avoid:**
- Build the CSV parser with configurable column mapping (user selects which column is "date", "amount", "description") rather than hard-coding positions.
- Normalise all dates to ISO 8601 immediately on parse; test against at least three UK bank formats (Barclays, Lloyds, HSBC export formats are publicly documented).
- Detect and handle both OFX SGML and XML variants; use a library that handles both (e.g., `ofx-js`).
- On parse failure or anomaly (e.g., zero transactions parsed, negative count, date range inconsistency), surface a specific error message rather than an empty import.
- Store the original raw parsed row alongside the normalised record for debugging.

**Warning signs:**
- The CSV parser hard-codes column indices (`row[0]`, `row[3]`) rather than using header names
- No test fixtures from multiple bank formats
- Parse errors are caught and swallowed, resulting in empty transaction lists

**Phase to address:**
Phase 1 (bank statement import). Column-mapping flexibility must be designed in from the start; retrofitting is tedious.

---

### Pitfall 8: Sage Locking Out Users During Integration Operations

**What goes wrong:**
The SDO connection to a Sage company file acquires a partial zone lock (similar to an active Sage user session). If the integration holds the connection open for an extended batch operation (e.g., reading all transactions for a large company), users trying to perform operations in the same Sage zone (bank reconciliation, customer receipts) receive "Waiting to lock files" messages or are blocked entirely. In extreme cases, the integration triggers an exclusive lock scenario that locks out all Sage users.

**Why it happens:**
Developers write integration code that opens the SDO company connection at server startup and keeps it open indefinitely for performance. Sage's locking mechanism treats this as an active user session competing with real users.

**How to avoid:**
- Open the SDO company connection only for the duration of a discrete operation (open → query/write → close). Do not hold connections open between user requests.
- Build connection pooling with a maximum hold time (e.g., 30-second timeout) that forces connection release.
- Schedule background Sage reads (if any) during off-hours or implement a configurable "maintenance window" where the integration runs bulk operations.
- Document in the user guide that the integration counts as a Sage user session and the firm must have sufficient Sage licences.

**Warning signs:**
- The SDO connection is opened once at application startup and stored as a module-level singleton
- No connection timeout or explicit close on operation completion
- Firm reports Sage users being randomly locked out or seeing "waiting" messages

**Phase to address:**
Phase 1 (COM bridge). Connection lifecycle management must be a first-class concern in the COM bridge design.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hard-code Sage version DLL path | Avoids version-detection code | Breaks silently on every Sage upgrade | Never — firm will upgrade Sage |
| Store amounts as floats (JavaScript Number) | No conversion code needed | Matching produces false negatives on common amounts | Never for monetary comparisons |
| Keep SDO connection open permanently | Avoids per-request open overhead | Locks Sage users out during operations | Never |
| Skip OCR confidence scores | Simpler extraction pipeline | Silently wrong data enters the matching engine | Never |
| Auto-confirm high-confidence matches | Fewer clicks for accountants | Silent mis-reconciliation, hard to unwind | Never for v1 — introduce only after trust is established |
| Hard-code CSV column positions | Faster initial parser | Fails on any bank other than the test bank | Only if supporting exactly one bank format, explicitly documented |
| Run COM calls directly on main event loop thread | Simpler code, no IPC | Server freezes under any concurrent load | Prototyping/spikes only, never in production |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Sage SDO COM | Calling SDO from main Node.js event loop thread | Isolate SDO in a dedicated child process; use IPC for all calls |
| Sage SDO COM | Hardcoding the COM ProgID for one Sage version | Read Sage version from registry at startup; select ProgID dynamically |
| Sage SDO COM | Keeping company connection open indefinitely | Open connection per operation; close immediately after; enforce timeout |
| Sage SDO COM | Assuming SDO works remotely over a network | Backend must run on the same machine that hosts the Sage data files |
| Sage SDO COM | Not handling the "in use by another user" error | Implement retry logic with backoff; surface a user-readable error on persistent failure |
| Bank statement CSV | Assuming all banks use the same column format | Implement user-configurable column mapping at import time |
| Bank statement OFX | Only handling XML-OFX | Handle both SGML-OFX (no closing tags) and XML-OFX variants |
| OCR extraction | Discarding confidence scores | Store and propagate per-field confidence; flag low-confidence fields in UI |
| Currency amounts | Using `parseFloat()` for monetary values | Parse to integer pence (`Math.round(raw * 100)`) at the system boundary |
| Reconciliation write-back | Writing reconciled flag without understanding Sage's VAT business logic | Study SDO TAX_FLAG behaviour; v1 write-back should only set reconciled status, not modify transaction amounts |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Fetching all Sage transactions on every reconciliation run | Slow import for large company files (5+ seconds) | Cache transaction reads with a short TTL; allow incremental date-range queries | Any company file with > 2 years of history |
| Synchronous OCR on the main request thread | Upload endpoint hangs for 10–30 seconds per document | Process OCR in the COM child process or a separate worker; return job ID immediately, poll for result | Any document > 1 page or scan at < 200 DPI |
| Loading all match candidates into memory for comparison | Node.js heap exhaustion with large statement files (500+ lines vs. 5000+ Sage entries) | Page results; process statement lines in batches; use indexed in-memory structures (Map by amount bucket) | Statement files > 200 lines against Sage files with > 1,000 transactions |
| Holding SDO company connection open between requests | Sage user lock contention | Connection-per-operation pattern with explicit close | Any operation where Sage users are concurrently active |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Exposing the LAN service on 0.0.0.0 without authentication | Anyone on the LAN can access all client accounting data | Bind to specific interface; require session authentication even on LAN |
| Storing Sage credentials (username/password for SDO) in plaintext config file | Credentials compromised if file is shared or backed up to cloud | Use Windows DPAPI or OS credential store; never plaintext in config |
| Passing client company names or data in URL query parameters | Data appears in server logs and browser history | Use POST body for company selection; treat company names as sensitive |
| No audit log of reconciliation confirmations | Inability to answer "who confirmed this match, when, and why?" | Append-only audit log: user, timestamp, matched pairs, confidence score, action taken |
| Using ODBC direct connection to Sage database as a fallback | Bypasses Sage business logic; can corrupt data; not officially supported | Use SDO only; never ODBC for writes; document this constraint explicitly |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing all match suggestions in a flat list without grouping by confidence | Accountant must manually evaluate every suggestion equally | Group into "Exact matches" (confirm in bulk) and "Review required" (one by one) |
| No visual distinction between OCR-extracted values and CSV/user-entered values | Accountant trusts a wrong OCR-extracted amount; mis-reconciles | Visually badge OCR-extracted fields; show source image thumbnail for low-confidence fields |
| Hiding the "unmatched" list behind multiple clicks | Accountant forgets to address exceptions; month-end is incomplete | Surface unmatched item count prominently; make it the default view after matching runs |
| No way to undo a confirmed reconciliation | Accountant confirms a wrong match; cannot reverse without manual Sage intervention | Implement an "undo confirmation" that un-marks the Sage reconciled flag before session close |
| Requiring re-import when a single match needs correction | Frustrating workflow disruption | Allow individual match corrections without re-running full import |
| No progress indicator during Sage data fetch | Accountant thinks the app has hung during a slow SDO query | Show a spinner with elapsed time; provide a cancel option that safely closes the SDO connection |

---

## "Looks Done But Isn't" Checklist

- [ ] **COM bridge:** Works in unit tests but uses a mock SDO — verify against real Sage company file with > 100 transactions
- [ ] **Bank statement import:** Tested with one bank's CSV — verify with at least Barclays, Lloyds, and HSBC export formats plus one OFX file
- [ ] **OCR pipeline:** Returns extracted text — verify that confidence scores are stored and propagated to the UI layer, not just logged
- [ ] **Amount matching:** Matches on demo data — verify that `£1,105.55` round-trips correctly through parse → integer store → comparison without floating-point error
- [ ] **Reconciliation write-back:** Sets reconciled flag — verify the Sage transaction is actually marked in Sage UI after the write-back, not just in the local database
- [ ] **Multi-company support:** Works for company 1 — verify SDO connection lifecycle correctly closes and re-opens when switching between client companies
- [ ] **Concurrent users:** Works for one browser tab — verify a second accountant accessing a different client company simultaneously does not trigger Sage lock contention
- [ ] **Sage version detection:** Works for current Sage version — verify the COM ProgID selection handles a version mismatch gracefully (error message, not crash)
- [ ] **Unmatched list:** Shows after matching — verify items remain visible and counted after partial confirmations, not silently cleared

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Event loop blocking from synchronous COM calls | HIGH — requires architectural change | Refactor all SDO calls into a child process; update all call sites to use IPC; regression test all Sage operations |
| Floating-point currency comparison bugs | MEDIUM — data migration needed | Migrate stored amounts to integer pence; regenerate all existing match records; re-run matching on historical data |
| Silent mis-reconciliations from auto-confirm | HIGH — manual audit required | Build admin view to list all auto-confirmed matches; accountant manually reviews and reverses in Sage; add mandatory confirmation gate going forward |
| DLL version mismatch after Sage upgrade | LOW — config change | Update the COM ProgID mapping in config; re-register the new SDO DLL; restart the Node.js service |
| Wrong OCR extraction silently in database | MEDIUM — partial re-import | Re-OCR the affected documents; compare with stored values; flag discrepancies for accountant review |
| Bank statement parse failure swallowed | LOW — add error surfacing | Add parse validation that errors on zero-transaction result; surface raw parse errors to import UI |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| COM event loop blocking (winax synchronous) | Phase 1: COM bridge spike | Run two concurrent HTTP requests both requiring SDO; verify neither blocks the other |
| SDO DLL version mismatch on Sage upgrade | Phase 1: COM bridge spike | Test version-detection logic with a mismatched DLL; verify graceful error |
| Floating-point currency comparison | Phase 1: Data model / import | Unit test: parse `£1,105.55` → store → compare → confirm integer pence throughout |
| SDO requires co-location with Sage data | Phase 1: Deployment design | Deployment checklist validates data path is locally accessible before first run |
| Over-confident auto-matching | Phase 2: Matching algorithm | Code review: confirm no reconciliation write-back path exists without explicit user confirmation |
| OCR without confidence scores | Phase 2: Document ingestion | Unit test: OCR output object always contains confidence field; UI test: low-confidence fields are visually flagged |
| Bank statement format variants | Phase 1: Bank statement import | Integration tests with 3+ real bank CSV/OFX formats before shipping the import feature |
| Sage lock contention from long-held connections | Phase 1: COM bridge spike | Stress test: open and hold connection while a Sage user performs bank reconciliation; confirm no lockout |

---

## Sources

- [Codat: Developer's Guide to Building a Sage 50 Integration](https://codat.io/blog/a-developers-guide-to-building-a-sage-50-integration/) — version management, accounting knowledge gaps, ODBC misuse warning
- [Sage KB: Development Basics for Sage 50 Accounts (UK)](https://gb-kb.sage.com/portal/app/portlets/results/viewsolution.jsp?solutionid=200518071050312) — SDO capabilities, supported languages, TAX_FLAG gotcha
- [Sage KB: File Locking in Sage 50 Accounts](https://ie-kb.sage.com/portal/app/portlets/results/view2.jsp?k2dockey=200427112155714) — exclusive lock types, partial zone locks, integration contention
- [winax/node-activex GitHub Issue #31: Is winax entirely blocking and synchronous?](https://github.com/durs/node-activex/issues/31) — confirmed synchronous-only behaviour, multi-process workaround
- [winax on npm](https://www.npmjs.com/package/winax) — bitness requirements, supported Node.js versions
- [Sage KB: SDO Setup Error Fix](https://www.accountingadvice.co/fix-sage-error-sdo-setup/) — DLL registration failures, version-specific filenames
- [Sage Developer Community: SDK Type Library Registration Problem](https://developer-community.sage.com/topic/848-sage-50-sdk-type-library-registration-problem/) — real-world DLL registration failures
- [Optimus Tech: Fuzzy Matching Algorithms in Bank Reconciliation](https://optimus.tech/blog/fuzzy-matching-algorithms-in-bank-reconciliation-when-exact-match-fails) — tiered confidence approach, false positive/negative tradeoffs
- [Medium: The Floating Point Standard Breaking Financial Software](https://medium.com/@sohail_saifii/the-floating-point-standard-thats-silently-breaking-financial-software-7f7e93430dbb) — integer-pence storage recommendation
- [Tesseract OCR: Improving Quality](https://tesseract-ocr.github.io/tessdoc/ImproveQuality.html) — 300 DPI requirement, preprocessing steps, skew correction
- [OFX Guide: Open Financial Exchange Format](https://www.financialconvert.com/ofx-guide.html) — SGML vs XML OFX variants, FITID deduplication
- [AutoEntry Help: How to install the Sage Data Object component (SDO)](https://help.autoentry.com/en/articles/11995730-how-to-install-the-sage-data-object-component-sdo) — SDO must be installed on the machine holding accounts data

---
*Pitfalls research for: Ledger Link — Sage 50 reconciliation automation*
*Researched: 2026-03-17*
