# Architecture Research

**Domain:** LAN-hosted accounting reconciliation tool with COM/SDK integration (Sage 50 SDO)
**Researched:** 2026-03-17
**Confidence:** MEDIUM — Sage SDO COM constraints from official docs and developer community; Node.js COM bridge from npm/GitHub; matching patterns from reconciliation domain literature

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Browser Clients (LAN)                       │
│   Accountant workstation 1        Accountant workstation 2           │
│        Chrome / Edge                   Chrome / Edge                 │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ HTTP (LAN only)
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Windows Server Machine (LAN)                      │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    Express HTTP Server                       │    │
│  │  ┌──────────────┐  ┌───────────────┐  ┌─────────────────┐  │    │
│  │  │  REST API    │  │  File Upload  │  │  Auth / Session │  │    │
│  │  │  Routes      │  │  Handler      │  │  Middleware     │  │    │
│  │  └──────┬───────┘  └──────┬────────┘  └─────────────────┘  │    │
│  └─────────┼─────────────────┼───────────────────────────────-─┘    │
│            │                 │                                       │
│  ┌─────────▼─────────────────▼───────────────────────────────────┐  │
│  │                      Service Layer                             │  │
│  │  ┌───────────────┐  ┌───────────────┐  ┌──────────────────┐  │  │
│  │  │  Reconcile    │  │  Document     │  │  Sage Connector  │  │  │
│  │  │  Service      │  │  Service      │  │  Service         │  │  │
│  │  └──────┬────────┘  └──────┬────────┘  └────────┬─────────┘  │  │
│  └─────────┼─────────────────-┼──────────────────--┼────────────┘  │
│            │                  │                     │               │
│  ┌─────────▼──────────┐  ┌───▼──────────┐  ┌──────▼─────────────┐  │
│  │  Matching Engine   │  │  OCR Worker  │  │  COM Bridge         │  │
│  │  (amount/date/ref) │  │  (tesseract) │  │  (winax → SDO DLL) │  │
│  └─────────┬──────────┘  └──────────────┘  └──────┬─────────────┘  │
│            │                                       │                │
│  ┌─────────▼───────────────────────────────────────▼─────────────┐  │
│  │                     Data Layer                                  │  │
│  │  ┌───────────────┐  ┌──────────────┐  ┌─────────────────────┐ │  │
│  │  │  SQLite / PG  │  │  File Store  │  │  Sage 50 Dataset    │ │  │
│  │  │  (app state)  │  │  (uploads)   │  │  (proprietary .sdf) │ │  │
│  │  └───────────────┘  └──────────────┘  └─────────────────────┘ │  │
│  └────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Express HTTP Server | Receives HTTP requests from browser clients, routes to services, returns JSON | Node.js + Express |
| REST API Routes | Exposes endpoints for sessions, companies, documents, matches, reconciliation | Express Router + validation (zod) |
| File Upload Handler | Receives PDF/image/CSV uploads, stores to disk, enqueues processing | Multer middleware |
| Auth / Session Middleware | Identifies which accountant is acting; protects endpoints | express-session + bcrypt |
| Reconcile Service | Orchestrates a full reconciliation run: fetch Sage data → load imports → run matching → persist results | Plain service module |
| Document Service | Coordinates OCR extraction and bank statement parsing, returns normalised transaction records | Plain service module |
| Sage Connector Service | Manages COM lifecycle: open dataset, read transactions/invoices, write reconcile flag, close | Thin wrapper around COM bridge |
| Matching Engine | Compares imported records against Sage entries using multi-pass strategy; assigns confidence scores | In-process module (no queue needed) |
| OCR Worker | Extracts text from PDF/image files; hands structured fields back to Document Service | tesseract.js (in-process) or node-tesseract-ocr (CLI) |
| COM Bridge | Opens the Sage SDO COM object via winax; serialises all SDO calls onto a single-thread context | winax on Node.js (Windows only) |
| SQLite / Postgres | Persists app-owned state: sessions, document metadata, match results, reconciliation status | better-sqlite3 (SQLite) |
| File Store | Holds uploaded files on local disk during processing lifetime | Local filesystem path, configurable |
| Sage 50 Dataset | Source of truth for accounting entries; read/write via SDO; never touched directly | Sage proprietary .sdf database |

---

## Recommended Project Structure

```
src/
├── api/                   # Express app, routers, middleware
│   ├── routes/            # One file per resource (companies, documents, matches, reconcile)
│   ├── middleware/        # Auth, error handling, file upload
│   └── server.ts          # Creates and exports Express app
├── services/              # Business logic, orchestration
│   ├── reconcile.ts       # Main reconciliation workflow
│   ├── document.ts        # Document ingestion + extraction
│   └── sage.ts            # All Sage read/write operations
├── matching/              # Matching engine (pure functions, testable)
│   ├── engine.ts          # Orchestrates multi-pass matching
│   ├── strategies.ts      # Exact, fuzzy, tolerance-window strategies
│   └── scoring.ts         # Confidence scoring
├── ocr/                   # OCR abstraction
│   ├── index.ts           # Public interface (extract fields from file path)
│   └── tesseract.ts       # Tesseract.js or CLI adapter
├── sage-bridge/           # COM isolation layer (Windows-only)
│   ├── connection.ts      # SDO lifecycle: open/close dataset
│   ├── reader.ts          # Read transactions, invoices, bank entries
│   └── writer.ts          # Write reconcile flags back to Sage
├── parsers/               # Bank statement format parsers
│   ├── csv.ts             # CSV column mapping + normalisation
│   └── ofx.ts             # OFX/QFX parser
├── db/                    # Database access (SQLite)
│   ├── schema.ts          # Table definitions (drizzle or knex)
│   ├── migrations/        # Migration files
│   └── queries.ts         # Typed query helpers
├── types/                 # Shared TypeScript types
│   └── domain.ts          # Transaction, MatchResult, ReconcileSession, etc.
└── index.ts               # Entry point: starts server
```

### Structure Rationale

- **sage-bridge/:** Isolated because COM interop is Windows-specific and fragile. Keeping it behind a typed interface allows the rest of the codebase to be tested without a live Sage installation.
- **matching/:** Pure functions with no side effects. Easily unit-tested with fixtures. Decoupled from both the HTTP layer and Sage.
- **ocr/:** Behind an interface so the underlying engine (tesseract.js vs CLI) can be swapped without touching Document Service.
- **parsers/:** CSV and OFX have very different formats. Separate files prevent a single bloated parser module.

---

## Architectural Patterns

### Pattern 1: COM Bridge Isolation (Single-Responsibility Wrapper)

**What:** All Sage SDO calls are routed through a single `sage-bridge/` module. No other module imports `winax` or constructs COM objects. The bridge exposes a typed, promise-based API.

**When to use:** Always. COM interop is platform-specific, version-sensitive, and difficult to test. Isolation contains the blast radius of any SDO API changes.

**Trade-offs:** Adds a small indirection layer; worth it because it allows mocking Sage in tests and makes future migration (e.g., to a REST-based Sage API) a contained change.

**Example:**
```typescript
// sage-bridge/connection.ts
import * as winax from 'winax';

export class SageConnection {
  private sdo: any;

  open(dataPath: string, username: string, password: string): void {
    this.sdo = new winax.Object('SageDataObjects.SDOEngine');
    this.sdo.Logon(dataPath, username, password);
  }

  close(): void {
    if (this.sdo) {
      this.sdo.Logoff();
      this.sdo = null;
    }
  }

  getEngine(): any {
    if (!this.sdo) throw new Error('Sage connection not open');
    return this.sdo;
  }
}
```

### Pattern 2: Multi-Pass Matching with Confidence Tiers

**What:** The matching engine runs candidates through passes in ascending complexity order. Cheap exact-match runs first and removes candidates. Expensive fuzzy-match only processes the remainder.

**When to use:** When transaction volumes are moderate (hundreds to low thousands per reconciliation run). For the target firm size (<10 companies, batch workflow), in-process matching is sufficient — no queue needed.

**Trade-offs:** Simpler than a ML-based approach; lower accuracy on ambiguous descriptions, but adequate for this domain where amounts are deterministic.

**Example:**
```typescript
// matching/engine.ts
export function matchTransactions(
  imported: ImportedTransaction[],
  sageEntries: SageEntry[]
): MatchResult[] {
  const results: MatchResult[] = [];
  const unmatched = [...imported];

  // Pass 1: Exact (reference + amount + date)
  for (const tx of [...unmatched]) {
    const exact = sageEntries.find(e =>
      e.reference === tx.reference &&
      e.amount === tx.amount &&
      isSameDay(e.date, tx.date)
    );
    if (exact) {
      results.push({ tx, match: exact, confidence: 1.0, strategy: 'exact' });
      unmatched.splice(unmatched.indexOf(tx), 1);
    }
  }

  // Pass 2: Amount + date window (±3 days), no reference required
  for (const tx of [...unmatched]) {
    const fuzzy = sageEntries.find(e =>
      e.amount === tx.amount &&
      withinDays(e.date, tx.date, 3)
    );
    if (fuzzy) {
      results.push({ tx, match: fuzzy, confidence: 0.75, strategy: 'amount+date' });
      unmatched.splice(unmatched.indexOf(tx), 1);
    }
  }

  // Unmatched → flagged for manual review
  for (const tx of unmatched) {
    results.push({ tx, match: null, confidence: 0, strategy: 'unmatched' });
  }

  return results;
}
```

### Pattern 3: Request-Scoped Sage Sessions (per reconciliation run, not per HTTP request)

**What:** A Sage dataset connection is opened at the start of a reconciliation job, used for all reads and writes within that job, then closed. Connections are NOT held open across idle HTTP requests.

**When to use:** Always for this architecture. SDO connections consume Sage user licences. Holding connections indefinitely blocks other users from accessing Sage interactively.

**Trade-offs:** Small overhead per reconciliation run (open/close cycle). Worth it to avoid licence exhaustion and connection leaks.

---

## Data Flow

### Flow 1: Bank Statement Import

```
Accountant uploads CSV/OFX
    ↓
POST /api/documents/upload
    ↓ (multer saves file to disk)
Document Service
    ↓
Parser (csv.ts or ofx.ts)
    ↓ (normalised ImportedTransaction[])
Database (document_imports table)
    ↓
Response: import ID + row count preview
```

### Flow 2: Invoice / Receipt OCR

```
Accountant uploads PDF/image
    ↓
POST /api/documents/upload  (type=invoice)
    ↓ (multer saves file to disk)
Document Service
    ↓
OCR Worker (tesseract.js)
    ↓ (raw text)
Field Extractor (regex + heuristics for amount, date, ref)
    ↓ (normalised ImportedTransaction)
Database (document_imports table)
    ↓
Response: extracted fields for accountant confirmation
```

### Flow 3: Reconciliation Run

```
Accountant selects company + import set → clicks "Reconcile"
    ↓
POST /api/reconcile  { companyId, importIds }
    ↓
Reconcile Service
    ├── (1) sage-bridge opens SDO connection to company dataset
    ├── (2) reader.ts fetches SageEntry[] for date range
    ├── (3) db queries ImportedTransaction[] for selected imports
    ├── (4) Matching Engine runs multi-pass → MatchResult[]
    ├── (5) db persists MatchResult[] (status: pending_review)
    └── (6) sage-bridge closes connection
    ↓
Response: reconciliation session ID + summary counts
    ↓ (accountant reviews match suggestions in UI)
PATCH /api/reconcile/:sessionId/matches/:matchId  { action: confirm | reject }
    ↓
Reconcile Service
    ├── (1) sage-bridge opens connection
    ├── (2) writer.ts sets reconcile flag on SageEntry
    ├── (3) db updates MatchResult status → reconciled
    └── (4) sage-bridge closes connection
    ↓
Response: updated match status
```

### Flow 4: Manual Review Queue

```
GET /api/reconcile/:sessionId/unmatched
    ↓
Database query (MatchResult WHERE strategy='unmatched')
    ↓
Response: unmatched ImportedTransaction[] with context
```

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Sage 50 SDO (COM) | winax COM object wrapper — synchronous calls, must run on Windows | SDO requires Sage 50 installed on same machine; must Logon/Logoff per session; consumes a Sage user licence slot |
| Tesseract OCR | tesseract.js (WASM, no install) or node-tesseract-ocr (wraps Tesseract CLI) | tesseract.js preferred for zero-dependency install; CLI wrapper gives better accuracy for production quality scans |
| Filesystem | Local disk for uploaded documents | Keep uploads directory outside src/; configurable path; clean up files after processing or on a schedule |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| API Routes ↔ Services | Direct function call (same process) | Services return typed domain objects; routes handle HTTP serialisation |
| Services ↔ Matching Engine | Direct function call; matching engine is pure (no I/O) | Keeps matching testable without database or Sage |
| Services ↔ Sage Bridge | Async function calls via typed bridge interface | Bridge is the only place that touches winax; mock this interface in tests |
| Services ↔ OCR | Async function call via ocr/index.ts interface | Swap tesseract.js ↔ CLI adapter here without touching Document Service |
| Services ↔ Database | Query helpers from db/queries.ts | No raw SQL outside db/ folder |

---

## Scaling Considerations

This is a LAN tool for a small accounting firm (~10 companies, a few accountants). Scaling to millions is not a concern. The relevant scaling axis is: number of transactions per reconciliation run.

| Scale | Architecture Adjustments |
|-------|--------------------------|
| < 1,000 tx per run | In-process matching is fine; synchronous SDO calls are fine |
| 1,000–10,000 tx per run | Add progress streaming (SSE or WebSocket) so the UI doesn't appear frozen during a long match; matching engine still in-process |
| > 10,000 tx per run | Move OCR and matching to a job queue (BullMQ + Redis) with a worker process; unlikely needed for this firm size |

### Scaling Priorities

1. **First bottleneck — SDO call latency:** Fetching thousands of Sage entries via COM is slow (COM IDispatch calls are synchronous). Batch-fetch by date range rather than per-transaction. Cache Sage data for the duration of a reconciliation run; don't re-query per match.
2. **Second bottleneck — OCR throughput:** Tesseract.js processes one page at a time. For high-volume invoice batches, processing multiple files concurrently (Promise.all with concurrency limit) is the first optimisation, before introducing a queue.

---

## Anti-Patterns

### Anti-Pattern 1: Holding Sage Connections Open Across Idle Time

**What people do:** Open a SDO connection at server startup and reuse it for all requests.

**Why it's wrong:** SDO connections consume a Sage user licence slot. If the server holds it indefinitely, real accountants may be locked out of Sage. SDO objects also have session state that can corrupt if two requests interleave through the same connection.

**Do this instead:** Open a connection at the start of each reconciliation job and close it when the job ends. For read-only lookups (company list, etc.), open and close within the single request handler.

### Anti-Pattern 2: Calling SDO from Multiple Concurrent Requests

**What people do:** Allow two simultaneous POST /reconcile requests to both open SDO connections and read/write the same Sage dataset concurrently.

**Why it's wrong:** Sage 50's SDO is not designed for concurrent multi-writer access to the same dataset. The underlying proprietary database uses file-level locking. Concurrent writes risk data corruption or silent errors.

**Do this instead:** Serialize reconciliation jobs per company dataset using an in-process mutex or a simple per-company job lock stored in the database. Multiple companies can run concurrently; the same company cannot.

### Anti-Pattern 3: Importing winax Directly Across the Codebase

**What people do:** `import * as winax from 'winax'` scattered across service files.

**Why it's wrong:** Makes the codebase unrunnable on non-Windows machines (CI, developer Mac/Linux), breaks unit tests, and couples business logic to a COM implementation detail.

**Do this instead:** All winax usage lives exclusively in `src/sage-bridge/`. Every other module depends on the bridge's TypeScript interface, which can be mocked.

### Anti-Pattern 4: Synchronous OCR Blocking the HTTP Event Loop

**What people do:** Call `tesseract.js` in a request handler and `await` the result before responding.

**Why it's wrong:** OCR of a multi-page PDF can take 5-30 seconds. This ties up the Node.js event loop, making the server unresponsive to other requests during processing.

**Do this instead:** Return a job ID immediately and process OCR asynchronously. Poll or use SSE to deliver the result when extraction is complete. For early MVP, a simple async queue (p-queue) with concurrency=1 is sufficient before introducing Redis/BullMQ.

---

## Build Order Implications

Components have clear dependency ordering:

```
1. Database schema + types (domain.ts)
         ↓
2. Sage Bridge (sage-bridge/) — can be stubbed with mock data early
         ↓
3. Parsers (CSV/OFX) + OCR wrapper — no Sage dependency
         ↓
4. Matching Engine — depends on types only; fully unit-testable
         ↓
5. Services layer — wires bridge + parsers + engine + db together
         ↓
6. API routes — thin HTTP wrapper over services
         ↓
7. Frontend UI — connects to API
```

**Critical dependency:** The Sage Bridge must work on the target Windows machine before end-to-end testing is possible. Build and validate it early (Phase 1 or 2). Use a stubbed/mock bridge to develop and test the matching engine and UI in parallel on any OS.

---

## Sources

- [How to build a Sage 50 integration — Codat](https://codat.io/blog/a-developers-guide-to-building-a-sage-50-integration/) — SDO architecture constraints, on-premise connector requirements
- [Sage Developer Community — Getting Started with SDO](https://developer-community.sage.com/topic/588-getting-started-with-sage-data-objectssage-50-integration/) — SDO access patterns and concurrent user limitations
- [winax — GitHub (runbotics/winax)](https://github.com/runbotics/winax) — Node.js COM bridge supported versions (Node 10–23, x86/x64)
- [edge-js — GitHub (agracio/edge-js)](https://github.com/agracio/edge-js) — .NET/Node.js in-process alternative to winax
- [Fuzzy Matching Algorithms in Bank Reconciliation — Optimus.tech](https://optimus.tech/blog/fuzzy-matching-algorithms-in-bank-reconciliation-when-exact-match-fails) — Confidence-tiered matching strategy
- [How Transaction Reconciliation Works — Actual Budget / Medium](https://medium.com/actualbudget/how-transaction-reconciliation-works-8dc5749bbd21) — Multi-pass matching pattern
- [tesseract.js — GitHub (naptha/tesseract.js)](https://github.com/naptha/tesseract.js) — Pure JS OCR, offline, WASM-based
- [node-tesseract-ocr — npm](https://www.npmjs.com/package/node-tesseract-ocr) — CLI wrapper for local Tesseract binary
- [BullMQ](https://bullmq.io/) — Background job queue for Node.js (referenced as future scaling option)

---
*Architecture research for: LAN-hosted accounting reconciliation with Sage 50 COM/SDO integration*
*Researched: 2026-03-17*
