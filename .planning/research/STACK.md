# Stack Research

**Domain:** LAN-hosted browser-based accounting reconciliation tool (Sage 50 COM, OCR, Node.js)
**Researched:** 2026-03-17
**Confidence:** MEDIUM — Core web stack is HIGH confidence. Sage COM bridge is MEDIUM (sparse Node.js-specific examples exist). OCR accuracy for financial documents is MEDIUM (known Tesseract limitations apply).

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js | 22.x LTS | Backend runtime | LTS until April 2027. winax and better-sqlite3 publish prebuilt binaries for v22, avoiding native compilation pain on Windows. |
| TypeScript | 5.x | Language | Reduces runtime errors in financial logic. Drizzle ORM and Fastify have first-class TypeScript support — the type safety pays off when matching amounts and dates across schemas. |
| Fastify | 5.x | HTTP server | 2–3x higher throughput than Express. Built-in TypeScript, JSON schema validation, and `@fastify/multipart` (v9.x) for file uploads. For a LAN app with <10 concurrent users the perf difference is secondary, but the built-in schema validation catches bad API calls early. |
| React | 19.x | Frontend UI | Larger ecosystem than Vue for data-heavy table/review UIs. TanStack Table (for the match review grid) and TanStack Query are first-class React libraries. Vue is a legitimate alternative for a small internal tool but React wins here on available data-grid tooling. |
| Vite | 6.x | Frontend build | De facto standard for React SPAs in 2025. Fast HMR. No config needed for a LAN SPA. |
| SQLite via better-sqlite3 | ^11.x | Local persistence | One file, zero server process, no install burden on the LAN machine. Multiple accountants read concurrently, one writes at a time — WAL mode handles this fine for <10 users. The Node.js v22 built-in `node:sqlite` is still experimental and not recommended for production (requires `--experimental-sqlite` flag). |
| winax (node-activex) | ^3.x | Sage 50 SDO COM bridge | The only actively maintained pure-Node COM IDispatch wrapper. Supports Node 22 x64 with prebuilt binaries. The npm package is `winax`; the GitHub repo is `durs/node-activex`. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@fastify/multipart` | ^9.x | File uploads (PDF, images, CSV, OFX) | Always — handles PDF and image uploads for OCR pipeline and CSV/OFX bank statement imports. |
| `tesseract.js` | ^5.x | OCR for scanned documents | For scanned paper invoices and receipts. Pure-JS, runs entirely offline on the LAN server. No PDF support — pre-extract images from scanned PDFs first using `pdfjs-dist`. |
| `pdfjs-dist` | ^4.x | Text extraction from digital PDFs | Use for digitally-born PDFs (the majority of e-invoices). Falls through to tesseract.js when a PDF page has no embedded text. Mozilla-maintained, actively developed. |
| `ofx-data-extractor` | ^2.x | OFX bank statement parsing | TypeScript-native, handles both SGML-format and modern OFX/QFX. Use for bank statement imports alongside CSV parsing. |
| `csv-parse` | ^5.x | CSV bank statement parsing | The most robust CSV parser for Node.js. Streaming API, handles varied delimiters and encodings from different UK bank exports. Part of the `csv` monorepo. |
| `drizzle-orm` | ^0.40.x | SQLite query builder / ORM | Type-safe schema definitions with TypeScript inference. No separate codegen step. Generates migrations. Lighter and faster than Prisma for a single-file SQLite setup. |
| `drizzle-kit` | ^0.30.x | Drizzle migrations CLI | Push schema changes during development; generate SQL migrations for deployment. |
| TanStack Query | ^5.x | Frontend server-state management | Handles polling/refetch for match results, caching reconciliation state, and deduplicating concurrent API calls. Standard in the 2025 React ecosystem for this workload. |
| TanStack Table | ^8.x | Match review data grid | Purpose-built for large, sortable, filterable tables with row selection. This is the core UI interaction — an unmatched-items list and a matches review grid. |
| Zod | ^3.x | API input validation | Validates bank statement rows, OCR-extracted fields, and match candidates before they touch the database. Integrates with Fastify's JSON schema validation via `fastify-type-provider-zod`. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vitest | Unit and integration testing | Jest-compatible, runs in the Vite ecosystem. Use for matching algorithm tests — this is the most logic-dense part of the app. |
| Playwright | End-to-end tests | Tests the browser UI against a real Fastify server. Important for the match review workflow where accountant confirmation triggers Sage writes. |
| tsx | TypeScript execution for scripts | Runs `.ts` files directly without compilation. Use for seed scripts, migration runners, and COM bridge smoke tests. |
| PM2 | Windows process management | Keeps the Fastify server running as a background service on the LAN machine. Handles restarts on crash and provides logs. Alternative to NSSM for Node.js specifically. |

---

## Installation

```bash
# Core backend
npm install fastify @fastify/multipart winax better-sqlite3 drizzle-orm

# Document processing
npm install tesseract.js pdfjs-dist ofx-data-extractor csv-parse

# Validation
npm install zod

# Frontend
npm install react react-dom @tanstack/react-query @tanstack/react-table

# Dev dependencies
npm install -D typescript vite @vitejs/plugin-react drizzle-kit vitest playwright tsx
```

> **Windows note:** `winax` builds a native Node.js addon. The target machine needs Visual C++ Build Tools installed, or you can use the prebuilt binaries shipped with the package. Run `npm install winax` on the deployment machine directly rather than copying `node_modules` from a Mac/Linux development machine.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Fastify | Express | If the team has deep Express expertise or needs a specific Express-only middleware. Express is more battle-tested for complex middleware chains. Performance difference is negligible at <10 concurrent LAN users. |
| React | Vue 3 | Vue is a valid choice for small internal tools. Pick Vue if the team is already Vue-fluent — the core React advantage here is TanStack Table's richer data-grid API. |
| better-sqlite3 | PostgreSQL | Upgrade to PostgreSQL if the firm scales beyond ~10 concurrent accountants writing simultaneously, or if they need multi-machine database access. PostgreSQL requires a separate server install on the LAN. |
| winax | edge-js | edge-js runs .NET in-process and is an option if the team prefers writing the COM bridge in C# with a thin JSON IPC to Node. More robust isolation but requires .NET SDK and adds operational complexity. |
| tesseract.js | System Tesseract CLI via child_process | If accuracy is insufficient on financial documents, invoking the native Tesseract binary (version 5.x) via child_process gives better language model control and LSTM fine-tuning options. tesseract.js is the Tesseract 4.x LSTM engine compiled to WASM — functionally equivalent but the native CLI allows easier model swapping. |
| pdfjs-dist | pdf-parse | pdf-parse is simpler but less maintained (last major update 2021). pdfjs-dist is actively maintained by Mozilla and handles complex PDF structures more reliably. |
| drizzle-orm | Knex.js | Knex is a solid query builder but pre-TypeScript in design. Drizzle's type inference is significantly better — schema changes surface as type errors before runtime. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `node-win32ole` | Last meaningful commit 2018. 16 weekly downloads. Does not support Node.js 22. Will fail to build against modern Node. | `winax` (same COM interop concept, actively maintained, Node 22 prebuilts available) |
| `edge-js` (as primary Sage bridge) | Requires .NET SDK on the LAN server. Adds a .NET compile step to the build pipeline. Overkill when winax handles COM IDispatch directly. | `winax` for simple SDO calls; edge-js only if you need complex .NET interop beyond COM |
| `node:sqlite` (built-in) | Experimental in Node 22, requires `--experimental-sqlite` flag, not recommended for production. API may change before stabilisation. | `better-sqlite3` |
| Electron | Out of scope for a LAN browser-based tool. Adds per-machine install burden that the project explicitly avoids. | Fastify + browser SPA |
| Cloud OCR APIs (AWS Textract, Google Vision) | The project runs on a LAN with no external connectivity. These would require routing financial documents off-premises, which is a compliance risk for accounting data. | `tesseract.js` (offline, LAN-local) |
| NestJS | Heavy opinionated framework with extensive DI boilerplate. Good for large teams but overengineered for a single-server LAN tool with one or two developers. | Fastify with explicit module structure |
| Prisma | Generates a Rust-based query engine binary that must be downloaded at install time. Fragile on Windows LAN without internet access. Drizzle ships as pure TypeScript with no runtime binary dependency. | `drizzle-orm` |

---

## Stack Patterns by Variant

**If the Sage 50 SDO COM objects are 32-bit (older Sage installations):**
- Run Node.js as x86 (32-bit) rather than x64, because winax uses the same bitness as Node
- Sage 50 v30+ ships 64-bit SDO. Confirm the installed Sage version before choosing Node architecture
- Sage KB confirms 32-bit SDO is available alongside 64-bit Sage for third-party add-ons

**If OCR accuracy on financial documents is inadequate:**
- Add image pre-processing before tesseract.js: deskew, binarise, upscale to 300dpi minimum
- Use `sharp` (libvips-based) for image pre-processing before passing to tesseract.js
- If still insufficient, switch to native Tesseract 5.x binary invocation via `child_process.execFile` with LSTM fine-tuning on UK invoice samples

**If multiple client accountants need to write simultaneously:**
- SQLite WAL mode handles light concurrent writes, but if two accountants confirm matches at the same moment against the same Sage dataset, queue writes through a single in-process job queue
- Use `fastq` or Node's built-in async queue to serialise Sage SDO writes — the COM object is not thread-safe

**If the firm outgrows one LAN machine:**
- Migrate from SQLite to PostgreSQL; Drizzle ORM supports both with minimal schema changes
- The Fastify server can be moved to a Windows Server VM; winax still runs as a Windows native addon

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `winax ^3.x` | Node.js 22 x64 (or x86) | Prebuilt binaries published for Node 22. Do not mix Node x64 with 32-bit COM objects — see "32-bit" variant above. |
| `better-sqlite3 ^11.x` | Node.js 22 LTS | Prebuilt binaries for LTS versions. Requires native rebuild if using non-LTS Node versions. |
| `tesseract.js ^5.x` | Node.js 18, 20, 22 | WASM-based, no native build required. Language data files must be present on the server — download `eng.traineddata` during deployment, not at runtime. |
| `pdfjs-dist ^4.x` | Node.js 18+ | Uses ES module syntax. Requires `"type": "module"` or `.mjs` extension for the extraction wrapper, or use dynamic `import()` from CommonJS. |
| `drizzle-orm ^0.40.x` | `better-sqlite3 ^11.x` | Drizzle's SQLite adapter wraps better-sqlite3 directly. Keep both in sync — the Drizzle release notes call out breaking changes in the adapter layer. |

---

## Sources

- [winax / node-activex GitHub](https://github.com/durs/node-activex) — Node.js version support matrix, COM IDispatch implementation, confirmed Node 22 prebuilts. MEDIUM confidence (project is maintained but sparsely documented).
- [Sage 50 v32.1.342.0 Developer Release](https://gb-kb.sage.com/portal/app/portlets/results/view2.jsp?k2dockey=250905100100277) — Latest SDO release (August 2025), confirmed 64-bit SDO availability. HIGH confidence (official Sage KB).
- [Sage 50 Accounts — 64-bit architecture KB](https://gb-kb.sage.com/portal/app/portlets/results/view2.jsp?k2dockey=231121114136893) — 32-bit vs 64-bit SDO context. HIGH confidence (official Sage KB).
- [better-sqlite3 GitHub discussion — Node 22 core sqlite vs better-sqlite3](https://github.com/WiseLibs/better-sqlite3/discussions/1245) — Confirmed `node:sqlite` is experimental in Node 22, better-sqlite3 recommended for production. HIGH confidence (library maintainer thread).
- [Fastify vs Express 2025 — Medium/CodeToDeploy](https://medium.com/codetodeploy/express-or-fastify-in-2025-whats-the-right-node-js-framework-for-you-6ea247141a86) — Framework comparison, Fastify recommendation for greenfield. MEDIUM confidence (community article, corroborated by multiple sources).
- [tesseract.js GitHub](https://github.com/naptha/tesseract.js) — Confirmed no native PDF support; WASM-based; v5 supports Node 22. HIGH confidence (official repository).
- [win32ole vs winax npm trends](https://npmtrends.com/win32ole-vs-winax) — Download and maintenance comparison. MEDIUM confidence (trend data, reflects ecosystem activity).
- [pdfjs-dist (Mozilla PDF.js)](https://github.com/unjs/unpdf) — Active maintenance, recommended over pdf-parse for invoice extraction. MEDIUM confidence (community sources, corroborated by multiple articles).
- [Drizzle ORM vs Knex — community comparison 2025](https://thedataguy.pro/blog/2025/12/nodejs-orm-comparison-2025/) — Type safety and SQLite adapter assessment. MEDIUM confidence (community blog, aligns with official Drizzle docs).
- [TanStack 2025 recommended React stack (Cory House)](https://x.com/housecor/status/1948105214017380774) — Vite + TanStack Query + TanStack Router as 2025 preferred stack. LOW confidence (single practitioner opinion, but consistent with multiple other sources).

---

*Stack research for: Ledger Link — Sage 50 reconciliation tool*
*Researched: 2026-03-17*
