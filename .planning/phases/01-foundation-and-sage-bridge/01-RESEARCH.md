# Phase 1: Foundation and Sage Bridge - Research

**Researched:** 2026-03-17
**Domain:** Node.js LAN server + Sage 50 SDO COM bridge + React SPA scaffold
**Confidence:** MEDIUM — Core web stack is HIGH. Sage SDO specifics are MEDIUM (community + official Sage KB, not live testing). winax IPC pattern confirmed by maintainer.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**App Shell Layout**
- Sidebar + content layout (left sidebar, main content area on the right)
- Sidebar is collapsible to icons only for maximum content area width
- Phase 1 sidebar shows: company list (always visible), Transacções nav item, Sage connection status footer
- Dashboard/Documents/Settings nav items hidden until their phases ship — only show what Phase 1 delivers
- Sage connection status indicator at sidebar footer: "Sage: Ligado" (green) or "Sage: Desligado" (red)

**Visual Style & Theming**
- Clean & professional aesthetic — neutral colors, subtle borders, good typography (Linear/Notion feel)
- shadcn/ui component library (Radix-based, Tailwind-styled, copy-paste ownership)
- Light + dark mode, system-preference-aware (shadcn/ui CSS variables)
- UI language is Portuguese (PT-PT) — all labels, headings, messages, and field names in Portuguese

**Frontend Stack Decisions**
- TanStack Router for client-side routing (type-safe, file-based routes, pairs with TanStack Query)
- TanStack Table for the transactions data grid
- TanStack Query for server-state management

**Company Switching**
- Company list always visible in sidebar (no dropdown — with ≤10 companies, all fit)
- Click to select, active company highlighted with visual indicator
- Green dot = connected to Sage, gray dot = not connected — per-company connection status in the list
- Switching companies preserves the current view (e.g., stay on transactions, show new company's data)
- Company list auto-discovered from Sage on startup — no manual configuration needed

**Sage Data Display**
- Phase 1 shows transactions list only (date, reference, description, amount, type)
- TanStack Table with column sorting (click headers) + date range filter + search box for reference/description
- Server-side pagination, 50 rows per page, page controls at bottom
- Monetary amounts in Portuguese format: 1.234,56 € (comma decimal, dot thousands, euro symbol)
- Integer-pence convention enforced in database schema — all amounts stored as integers

**Connection Feedback**
- Skeleton table while Sage data is loading (animated placeholder rows mimicking table layout)
- Inline error with retry button when Sage connection fails — error appears where data would be, company stays selected
- User-friendly Portuguese error messages with expandable "Detalhes" toggle for technical details (COM error codes)
- Manual retry only — no automatic retries. User clicks "Tentar novamente" to retry
- Technical details logged to server console/file for troubleshooting

### Claude's Discretion
- Exact sidebar width and collapse animation
- Skeleton row count and animation style
- Specific shade palette for light/dark themes
- Table empty state design
- Exact filter control placement and styling
- Server-side pagination implementation details

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SAGE-01 | System connects to Sage 50 via official .NET/Interops SDK from the LAN server | winax + child_process.fork() IPC bridge; SDO ProgID version detection from registry |
| SAGE-02 | System reads transactions, invoices, and bank entries from Sage | SDO Workspace/DataSet object model; read fields: date, reference, description, amount (integer pence), type |
| SAGE-04 | System supports switching between multiple Sage company datasets (up to ~10) | SDO DataSets enumeration on startup; per-company connection lifecycle pattern |
| DASH-01 | Browser-based UI accessible from any machine on the LAN | Fastify serving React SPA via @fastify/static; LAN binding on 0.0.0.0; TanStack Router file-based routing |
</phase_requirements>

---

## Summary

Phase 1 establishes the complete technical foundation: a Fastify HTTP server on Windows that serves a React SPA to any browser on the LAN, a Sage 50 SDO COM bridge running in an isolated child process (to avoid blocking the event loop), and a SQLite database schema enforcing integer-pence amounts from day one.

The most critical decision already made — and confirmed by the winax maintainer — is that all COM/SDO calls must live in a `child_process.fork()` subprocess. This is not optional and cannot be retrofitted. Every SDO call is synchronous and blocks the Node.js main thread; without the fork isolation the HTTP server freezes during any Sage operation. Phase 1 must implement this architecture before any feature work.

The second critical constraint is integer-pence from the schema. Sage SDO returns monetary values as floats; they must be converted to integer pence (`Math.round(rawFloat * 100)`) at the COM bridge boundary and stored as SQLite `INTEGER` columns. All downstream code, including TanStack Table display, works only with integers until the UI formatting layer converts to Portuguese locale (`Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' })`).

**Primary recommendation:** Build in this order: (1) SQLite schema + Drizzle setup, (2) COM bridge child process with IPC, (3) Fastify server + routes, (4) React SPA scaffold with TanStack Router + shadcn/ui init, (5) wire API to UI with TanStack Query.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | 22.x LTS | Backend runtime | LTS until April 2027; winax and better-sqlite3 publish prebuilt binaries for v22 — no native recompile on Windows |
| TypeScript | 5.x | Language | First-class support in Fastify, Drizzle, TanStack; critical for integer-pence type enforcement |
| Fastify | 5.x | HTTP server | Built-in TypeScript + JSON schema validation; `@fastify/static` for SPA serving; `@fastify/multipart` for file uploads in later phases |
| React | 19.x | Frontend UI | TanStack Table/Query/Router are first-class React libraries; required by locked decisions |
| Vite | 6.x | Frontend build + dev server | De facto standard for React SPAs; fast HMR; produces `dist/` that Fastify serves in production |
| SQLite via better-sqlite3 | ^11.x | Local persistence | Zero-server, single-file; WAL mode for light concurrent reads from LAN clients |
| winax (node-activex) | ^3.x | Sage 50 SDO COM bridge | Only actively maintained pure-Node COM IDispatch wrapper; Node 22 prebuilts available |
| drizzle-orm | ^0.40.x | SQLite query builder/ORM | Type-safe schema; no Rust binary; migrates with `drizzle-kit push`; wraps better-sqlite3 directly |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@fastify/static` | ^8.x | Serve Vite `dist/` as SPA | Production serving of React app; `setNotFoundHandler` catches all non-API routes for client-side routing |
| `drizzle-kit` | ^0.30.x | Drizzle migrations CLI | Schema changes during development: `npx drizzle-kit push` |
| TanStack Router | ^1.x | File-based client routing | Locked decision; `@tanstack/router-plugin` Vite plugin auto-generates `routeTree.gen.ts` |
| TanStack Query | ^5.x | Server-state caching | Locked decision; `useQuery` for transactions + company list; handles loading/error states |
| TanStack Table | ^8.x | Headless data grid | Locked decision; server-side pagination + column sorting + filter integration |
| shadcn/ui | latest | Component library | Locked decision; Radix-based; copy-paste to `src/components/ui/`; init with `npx shadcn@latest init -t vite` |
| lucide-react | ^0.4x | Icon library | Included with shadcn init; used for sidebar collapse, nav icons, status dots |
| Zod | ^3.x | API input validation | Validates query params (page, companyId, dateFrom, dateTo, search); integrates with Fastify via `fastify-type-provider-zod` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `winax` | `edge-js` | edge-js requires .NET SDK, adds .NET compile step; winax handles COM IDispatch directly with no extra runtime |
| `better-sqlite3` | `node:sqlite` (built-in) | node:sqlite is experimental in Node 22 (`--experimental-sqlite`); not production-ready |
| `drizzle-orm` | Knex.js | Knex is pre-TypeScript in design; Drizzle's inference surfaces schema changes as type errors before runtime |
| `@fastify/static` | `@fastify/vite` | @fastify/vite is heavier; @fastify/static with setNotFoundHandler is sufficient for a pure SPA with no SSR |

**Installation:**
```bash
# Backend
npm install fastify @fastify/static better-sqlite3 drizzle-orm winax zod

# Frontend
npm install react react-dom @tanstack/react-query @tanstack/react-router @tanstack/react-table

# Dev
npm install -D typescript vite @vitejs/plugin-react @tanstack/router-plugin drizzle-kit @types/better-sqlite3 tsx tailwindcss postcss autoprefixer

# shadcn (run after Vite project exists)
npx shadcn@latest init -t vite
npx shadcn@latest add button skeleton badge separator input select table tooltip scroll-area
```

> **Windows deployment note:** `winax` builds a native Node.js addon. Run `npm install` on the deployment Windows machine directly. Never copy `node_modules` from a Mac/Linux dev machine — the prebuilt binary will be wrong platform.

---

## Architecture Patterns

### Recommended Project Structure

```
ledger-link/
├── src/                          # Backend source
│   ├── server.ts                 # Fastify app factory, register plugins + routes
│   ├── index.ts                  # Entry point: start server, bind LAN
│   ├── api/
│   │   └── routes/
│   │       ├── companies.ts      # GET /api/companies
│   │       └── transactions.ts   # GET /api/companies/:id/transactions
│   ├── sage-bridge/
│   │   ├── bridge-host.ts        # child_process script: receives IPC, calls SDO, sends reply
│   │   ├── bridge-client.ts      # Parent-side: spawn fork, send messages, return Promises
│   │   └── types.ts              # BridgeRequest / BridgeResponse discriminated unions
│   ├── db/
│   │   ├── schema.ts             # Drizzle table definitions (integer pence for amounts)
│   │   ├── migrate.ts            # Run drizzle-kit push on startup
│   │   └── client.ts             # Singleton better-sqlite3 + drizzle instance
│   └── types/
│       └── domain.ts             # SageCompany, SageTransaction shared types
├── client/                       # React SPA source
│   ├── src/
│   │   ├── main.tsx              # React root, QueryClientProvider, RouterProvider
│   │   ├── routes/
│   │   │   ├── __root.tsx        # Root layout: AppShell (sidebar + outlet)
│   │   │   └── companies/
│   │   │       └── $companyId/
│   │   │           └── transactions.tsx   # Transactions page
│   │   ├── components/
│   │   │   ├── ui/               # shadcn copy-paste components
│   │   │   ├── AppSidebar.tsx    # Company list + nav + Sage status footer
│   │   │   └── TransactionsTable.tsx  # TanStack Table + skeleton + error state
│   │   └── lib/
│   │       ├── api.ts            # fetch wrappers for /api/* endpoints
│   │       └── utils.ts          # cn() from shadcn, formatAmount (integer → pt-PT)
│   ├── index.html
│   └── vite.config.ts
├── drizzle/                      # Generated migrations
├── drizzle.config.ts
├── package.json
└── tsconfig.json
```

### Pattern 1: COM Bridge in Isolated Child Process

**What:** All winax/SDO calls live in `src/sage-bridge/bridge-host.ts`, a script spawned via `child_process.fork()`. The parent process (`bridge-client.ts`) sends typed IPC messages and receives responses as Promises. Zero winax imports outside `bridge-host.ts`.

**When to use:** Always — this is the only viable pattern. winax calls are synchronous and block the Node.js event loop. Any direct SDO call in the main process freezes all HTTP handlers.

**Why `fork()` over `worker_threads`:** COM STA (Single-Threaded Apartment) requires all calls to a COM object happen on the thread that created it. Worker threads share the same process and their threading model is incompatible with COM STA. A fork creates a separate process with its own event loop.

**Example:**
```typescript
// src/sage-bridge/types.ts
export type BridgeRequest =
  | { id: string; type: 'LIST_COMPANIES' }
  | { id: string; type: 'READ_TRANSACTIONS'; companyPath: string; page: number; pageSize: number; from?: string; to?: string; search?: string };

export type BridgeResponse =
  | { id: string; ok: true; data: SageCompany[] }
  | { id: string; ok: true; data: SageTransaction[] }
  | { id: string; ok: false; error: string; code?: string };
```

```typescript
// src/sage-bridge/bridge-client.ts
import { fork, ChildProcess } from 'node:child_process';
import { BridgeRequest, BridgeResponse } from './types.js';

let child: ChildProcess | null = null;
const pending = new Map<string, { resolve: Function; reject: Function }>();

export function ensureBridge(): ChildProcess {
  if (!child || child.exitCode !== null) {
    child = fork(new URL('./bridge-host.js', import.meta.url).pathname);
    child.on('message', (msg: BridgeResponse) => {
      const p = pending.get(msg.id);
      if (!p) return;
      pending.delete(msg.id);
      if (msg.ok) p.resolve(msg.data);
      else p.reject(Object.assign(new Error(msg.error), { code: msg.code }));
    });
  }
  return child;
}

export function callBridge<T>(req: Omit<BridgeRequest, 'id'>): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    pending.set(id, { resolve, reject });
    ensureBridge().send({ ...req, id });
  });
}
```

```typescript
// src/sage-bridge/bridge-host.ts
// This file runs in the child process ONLY. winax import is safe here.
import * as winax from 'winax';
import { BridgeRequest, BridgeResponse } from './types.js';

process.on('message', async (req: BridgeRequest) => {
  try {
    // Open SDO connection, execute operation, close immediately
    const result = await handleRequest(req);
    process.send!({ id: req.id, ok: true, data: result } as BridgeResponse);
  } catch (err: any) {
    process.send!({ id: req.id, ok: false, error: err.message, code: err.code });
  }
});

function handleRequest(req: BridgeRequest) {
  // All SDO calls here — open connection, read, close
}
```

### Pattern 2: SDO Open-Per-Operation Lifecycle

**What:** Open the SDO connection, execute all reads for one API request, close. Never hold a connection across idle time. Never store the SDO object as a module singleton.

**When to use:** Always. Open connections consume a Sage user licence slot and trigger file zone locks that block real Sage users.

**Example (inside bridge-host.ts):**
```typescript
// Source: Sage PITFALLS.md + Sage KB locking documentation
function readTransactions(companyPath: string, opts: ReadOptions): SageTransaction[] {
  const engine = new winax.Object('SDOEngine.XX'); // XX from registry detection
  try {
    const ws = engine.Workspaces.Add('LedgerLink');
    ws.Connect(companyPath, '', '', 'LedgerLink');
    const ds = ws.DataSets.Item('AUDIT_JOURNAL');  // or TRANSACTION, verify against real SDO
    // ... iterate records, convert amounts to pence ...
    ws.Disconnect();
    return transactions;
  } finally {
    // Ensure close even on error
    try { engine.Workspaces.Remove('LedgerLink'); } catch {}
  }
}
```

### Pattern 3: Integer-Pence Convention at the Bridge Boundary

**What:** All monetary values from SDO are converted from float to integer pence at the COM bridge before crossing the IPC boundary. No float amounts ever reach the database or the matching engine.

**When to use:** Always, for every amount field from Sage.

**Example:**
```typescript
// At the SDO read boundary in bridge-host.ts
const amountPence = Math.round(parseFloat(record.NET_AMOUNT) * 100);
// Stored as INTEGER in SQLite, sent over IPC as number

// At the UI display boundary in client/src/lib/utils.ts
export function formatAmount(pence: number): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
  }).format(pence / 100);
  // Outputs: "1.234,56 €"
}
```

### Pattern 4: SDO ProgID Version Detection from Registry

**What:** At bridge startup, read the Windows registry to determine the installed Sage version and construct the correct ProgID string (e.g., `SDOEngine.32`). Never hard-code a version number.

**Why:** Each Sage 50 release ships a version-specific DLL. After a Sage upgrade, a hard-coded ProgID throws `Class not registered` errors silently.

**Example:**
```typescript
// src/sage-bridge/bridge-host.ts
import { execSync } from 'node:child_process';

function detectSageProgId(): string {
  // Registry path for 32-bit SDO (works on 64-bit Windows under Wow6432Node)
  const regPath = 'HKLM\\SOFTWARE\\Wow6432Node\\Sage\\Line 50\\SDO';
  try {
    const out = execSync(`reg query "${regPath}" /v Current`, { encoding: 'utf8' });
    const match = out.match(/Current\s+REG_SZ\s+SDOEngine\.(\d+)/i);
    if (match) return `SDOEngine.${match[1]}`;
  } catch {}
  // Fallback: try 64-bit path
  try {
    const out = execSync(`reg query "HKLM\\SOFTWARE\\Sage\\Line 50\\SDO" /v Current`, { encoding: 'utf8' });
    const match = out.match(/Current\s+REG_SZ\s+SDOEngine\.(\d+)/i);
    if (match) return `SDOEngine.${match[1]}`;
  } catch {}
  throw new Error('Sage SDO not found in registry. Is Sage 50 Accounts installed?');
}
```

> **MEDIUM confidence** — Registry key path `HKLM\SOFTWARE\Wow6432Node\Sage\Line 50\SDO` inferred from Sage KB articles referencing `SDOEngine.XX` ProgID format and the Sage v32 developer release notes. Must be validated against real installation.

### Pattern 5: Fastify Serving React SPA

**What:** Fastify registers `@fastify/static` with `dist/` root, then a `setNotFoundHandler` catches all non-API routes and returns `index.html`. API routes registered under `/api/` prefix are matched first by Fastify's router and never reach the static handler.

**Example:**
```typescript
// src/server.ts
import Fastify from 'fastify';
import staticPlugin from '@fastify/static';
import path from 'node:path';

export async function createApp() {
  const app = Fastify({ logger: true });

  // API routes (registered first — matched before static wildcard)
  app.register(companiesRoutes, { prefix: '/api' });
  app.register(transactionsRoutes, { prefix: '/api' });

  // Serve Vite build output
  await app.register(staticPlugin, {
    root: path.join(import.meta.dirname, '../../client/dist'),
    wildcard: false,  // Disable wildcard; use setNotFoundHandler for SPA fallback
  });

  // SPA catch-all — sends index.html for all unmatched routes (client-side routing)
  app.setNotFoundHandler((_req, reply) => {
    reply.sendFile('index.html');
  });

  return app;
}
```

```typescript
// src/index.ts
const app = await createApp();
await app.listen({ port: 3000, host: '0.0.0.0' }); // 0.0.0.0 = all LAN interfaces
```

### Pattern 6: TanStack Router File-Based Routing Setup

**What:** `@tanstack/router-plugin` Vite plugin watches `src/routes/` and auto-generates `src/routeTree.gen.ts`. Routes are TypeScript files with a naming convention.

**Example:**
```typescript
// client/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { tanstackRouter } from '@tanstack/router-plugin/vite';

export default defineConfig({
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }), // MUST be before react()
    react(),
  ],
});
```

Route file conventions:
- `src/routes/__root.tsx` — root layout (AppShell with sidebar)
- `src/routes/index.tsx` — `/` route (redirect to first company)
- `src/routes/companies/$companyId/transactions.tsx` — `/companies/123/transactions`

```typescript
// client/src/main.tsx
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();
const router = createRouter({ routeTree });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <RouterProvider router={router} />
  </QueryClientProvider>
);
```

### Pattern 7: Drizzle Schema with Integer Pence

**Example:**
```typescript
// src/db/schema.ts
import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';

// Companies cached from Sage on startup
export const companies = sqliteTable('companies', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sagePath: text('sage_path').notNull().unique(),
  name: text('name').notNull(),
  connectedAt: integer('connected_at', { mode: 'timestamp' }),
});

// Transactions read from Sage, cached per company
export const transactions = sqliteTable('transactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  companyId: integer('company_id').notNull().references(() => companies.id),
  sageTxRef: text('sage_tx_ref').notNull(),
  txDate: integer('tx_date', { mode: 'timestamp' }).notNull(),
  reference: text('reference'),
  description: text('description'),
  amountPence: integer('amount_pence').notNull(), // CRITICAL: integer pence, never float
  txType: text('tx_type'),
  importedAt: integer('imported_at', { mode: 'timestamp' }).notNull(),
});
```

```typescript
// src/db/client.ts
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';

const sqlite = new Database(process.env.DB_PATH ?? './data/ledger-link.db');
sqlite.pragma('journal_mode = WAL');
export const db = drizzle(sqlite, { schema });
```

```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DB_PATH ?? './data/ledger-link.db' },
});
```

### Anti-Patterns to Avoid

- **Importing winax outside bridge-host.ts:** Breaks the codebase on any non-Windows machine (CI, dev Mac/Linux), prevents mocking in tests.
- **Storing SDO object as module singleton:** Consumes a Sage licence slot indefinitely; triggers file zone locks that block real Sage users.
- **Calling bridge functions without `await` and ignoring the Promise:** COM errors are swallowed; the UI shows stale data.
- **Storing amount as `REAL` in SQLite:** Floating-point representation errors cause legitimate amount matches to fail.
- **Hard-coding ProgID `SDOEngine.26`:** Breaks silently after every Sage upgrade.
- **Binding Fastify to `127.0.0.1` in production:** Prevents any LAN machine other than localhost from reaching the app.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| COM object wrapping in Node.js | Custom C++ addon or DLL | `winax` | Already solves COM IDispatch with Node 22 prebuilts; writing a C++ N-API addon is weeks of work |
| SQLite ORM + migrations | Custom query functions + migration scripts | `drizzle-orm` + `drizzle-kit` | Type-safe schema inference; `push` command for dev; generated SQL migrations for deploy |
| File-based routing code generation | Custom router with manual route registration | `@tanstack/router-plugin` auto-generation | Route tree gen is complex; the plugin handles code splitting + type safety automatically |
| Component primitives (Button, Input, Select, Skeleton) | Custom React components | shadcn/ui (via `npx shadcn@latest add`) | Radix accessibility primitives; dark mode via CSS variables; copy-paste means no version lock |
| Portuguese number formatting | Custom formatter | `Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' })` | Handles all locale edge cases; no library needed |
| Process IPC serialisation | Custom binary protocol | `child_process.fork()` IPC with JSON messages | Node.js built-in; handles serialisation automatically; sufficient for small SDO payloads |

**Key insight:** The COM bridge is the hardest part of this phase. winax already solves the hard problem (COM IDispatch wrapping with N-API). The work is the architectural wiring: the fork + IPC + typed message protocol. Don't re-invent the COM layer.

---

## Common Pitfalls

### Pitfall 1: winax Calls on the Main Event Loop Thread

**What goes wrong:** Any winax call in the main Fastify process — even wrapped in `async/await` — blocks the entire HTTP server. Two concurrent requests each waiting for SDO will serialise and both hang. This is confirmed by the winax maintainer (GitHub Issue #31).

**Why it happens:** COM STA requires all calls to a COM object to happen on the thread that created it. In Node.js, that's the main event loop thread. There is no async COM IDispatch wrapper.

**How to avoid:** All SDO code in `bridge-host.ts` only. The main process never imports winax.

**Warning signs:** Adding `async` or `Promise.resolve()` around winax calls and thinking it's now non-blocking.

### Pitfall 2: SDO ProgID Version Mismatch After Sage Upgrade

**What goes wrong:** Hard-coded `new winax.Object('SDOEngine.26')` throws `Class not registered` after the firm upgrades Sage from v26 to v32.

**Why it happens:** Each Sage major release ships a new version-numbered DLL. The ProgID must match exactly.

**How to avoid:** Detect version from Windows registry at bridge startup. See Pattern 4 above.

**Warning signs:** Error `Class not registered (-2147221164 / 0x80040154)` on the first startup after a Sage upgrade.

### Pitfall 3: Floating-Point Currency Comparison

**What goes wrong:** `115.10 === 115.10` can fail due to IEEE 754 binary float representation. Amounts read from SDO as `REAL` stored in SQLite will accumulate errors.

**Why it happens:** JavaScript `Number` is a 64-bit float. The value `0.10` cannot be represented exactly in binary.

**How to avoid:** Convert to integer pence at the COM bridge boundary. Use `INTEGER` columns in SQLite. Never store or compare raw floats.

**Warning signs:** `amount_pence REAL` in any SQLite schema. Any `===` comparison on raw float amounts.

### Pitfall 4: Sage Licence Lock from Long-Held Connections

**What goes wrong:** An SDO connection held open between user requests blocks one Sage user licence. Real Sage users get "Waiting to lock files" messages or are blocked from certain operations.

**Why it happens:** SDO treats an open connection the same as an active Sage interactive session.

**How to avoid:** Open → operate → close in every bridge operation. Use `try/finally` to ensure close even on error.

**Warning signs:** SDO object instantiated at module load time or stored as a module-level variable.

### Pitfall 5: shadcn Init Before Tailwind Is Configured

**What goes wrong:** Running `npx shadcn@latest add button` before `npx shadcn@latest init -t vite` creates components with broken CSS variable references. shadcn CSS variables are declared by the init command in `globals.css`.

**Why it happens:** shadcn components reference `hsl(var(--primary))` etc. which only exist after init populates `globals.css` and `tailwind.config.js`.

**How to avoid:** Run `npx shadcn@latest init -t vite` first, confirm `components.json` and `globals.css` exist, then add components.

**Warning signs:** Components render without color/theming; all buttons appear unstyled.

### Pitfall 6: Vite Dev Server vs Production Serving Confusion

**What goes wrong:** In development, the React SPA is served by the Vite dev server on port 5173. The Fastify server runs on port 3000. In production, Fastify serves the built `client/dist/`. Mixing these up causes CORS errors, broken hot reload, or missing API routes.

**Why it happens:** Monorepo setup with two servers requires a Vite proxy config during development.

**How to avoid:** In `vite.config.ts`, add a proxy for `/api` to Fastify:
```typescript
server: {
  proxy: {
    '/api': 'http://localhost:3000',
  },
}
```
In production, Fastify serves both the static files and the API from the same port.

---

## Code Examples

Verified patterns from official sources:

### TanStack Query useQuery for Transactions

```typescript
// Source: TanStack Query v5 official docs — tanstack.com/query/v5/docs/framework/react/guides/queries
import { useQuery } from '@tanstack/react-query';

function useTransactions(companyId: string, page: number, filters: Filters) {
  return useQuery({
    queryKey: ['transactions', companyId, page, filters],
    queryFn: () => fetchTransactions(companyId, { page, pageSize: 50, ...filters }),
    enabled: !!companyId,
    placeholderData: (prev) => prev, // Keep previous data while fetching next page
  });
}
```

### TanStack Table with Server-Side Pagination

```typescript
// Source: TanStack Table v8 official docs — tanstack.com/table/v8/docs/guide/pagination
import { useReactTable, getCoreRowModel, getSortedRowModel } from '@tanstack/react-table';

const table = useReactTable({
  data: transactions ?? [],
  columns,
  manualPagination: true,      // Server handles pagination
  manualSorting: true,         // Server handles sorting
  pageCount: Math.ceil(total / 50),
  state: { pagination: { pageIndex: page, pageSize: 50 }, sorting },
  onPaginationChange: setPage,
  onSortingChange: setSorting,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
});
```

### Drizzle Query with Pagination

```typescript
// Source: drizzle-orm official docs — orm.drizzle.team/docs/get-started-sqlite
import { db } from '../db/client.js';
import { transactions } from '../db/schema.js';
import { eq, and, between, like, sql } from 'drizzle-orm';

async function getTransactions(companyId: number, opts: QueryOpts) {
  const where = and(
    eq(transactions.companyId, companyId),
    opts.from ? between(transactions.txDate, new Date(opts.from), new Date(opts.to!)) : undefined,
    opts.search ? like(transactions.reference, `%${opts.search}%`) : undefined,
  );
  const [rows, [{ count }]] = await Promise.all([
    db.select().from(transactions).where(where)
      .limit(50).offset((opts.page - 1) * 50),
    db.select({ count: sql<number>`count(*)` }).from(transactions).where(where),
  ]);
  return { rows, total: count };
}
```

### Fastify Route with Zod Validation

```typescript
// Source: Fastify docs + fastify-type-provider-zod
import { z } from 'zod';
import { serializerCompiler, validatorCompiler } from 'fastify-zod-type-provider';

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  search: z.string().max(200).optional(),
});

app.get('/api/companies/:companyId/transactions',
  { schema: { querystring: querySchema } },
  async (req, reply) => {
    const { companyId } = req.params as { companyId: string };
    const data = await callBridge<SageTransaction[]>({
      type: 'READ_TRANSACTIONS',
      companyPath: await getCompanyPath(Number(companyId)),
      ...req.query,
    });
    return reply.send(data);
  }
);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Express as default Node HTTP server | Fastify 5.x for new projects | 2023-2025 | Better built-in TypeScript + schema validation |
| React Router v6 for client routing | TanStack Router v1 for type-safe routing | 2024 | Full TypeScript path params; file-based routing codegen |
| Manual fetch in useEffect | TanStack Query v5 for server state | 2024 | Deduplication, caching, background refetch built-in |
| Prisma for TypeScript ORM | Drizzle ORM for lightweight SQLite | 2024 | No Rust binary; pure TypeScript; faster on LAN machines without internet |
| `winax` called directly on main thread | `winax` isolated in child_process.fork() | Known from winax issue #31 | Only way to keep HTTP server responsive during COM calls |

**Deprecated/outdated:**
- `node-win32ole`: Last meaningful commit 2018; does not support Node 22. Use `winax` instead.
- `node:sqlite` (Node 22 built-in): Experimental behind `--experimental-sqlite` flag; API may change. Use `better-sqlite3`.
- Tailwind CSS v4 with shadcn: As of early 2026, `npx shadcn@canary init` is required for v4. Locked decision uses Tailwind v3 — use `npx shadcn@latest init -t vite` (stable).

---

## Open Questions

1. **SDO Registry Key Exact Path on Target Machine**
   - What we know: The pattern `HKLM\SOFTWARE\Wow6432Node\Sage\Line 50\SDO` with value `Current = SDOEngine.XX` is inferred from Sage KB articles and community posts showing ProgIDs like `SDOEngine.26`, `SDOEngine.32`.
   - What's unclear: The exact registry path may differ between Sage editions or between Sage 50 and Sage for Accountants (PT). Needs validation on the actual deployment machine.
   - Recommendation: Build a `detect-sage.ts` spike script that runs `reg query` and logs what it finds before any SDO object instantiation.

2. **SDO Dataset/Object Name for Transactions**
   - What we know: Sage SDO provides a `DataSets` collection; common dataset names include `AUDIT_JOURNAL`, `TRANSACTION`, `BANK_ACCOUNT`.
   - What's unclear: The exact DataSet name and field names (`NET_AMOUNT`, `REFERENCE`, `DATE`, `TYPE`) for the Portuguese Sage for Accountants edition. Sage 50 UK and PT editions may use different field names.
   - Recommendation: Write a bridge spike that connects to a real company file, dumps the available DataSet names and fields to the console, and use those as ground truth for the reader implementation.

3. **Sage for Accountants vs Sage 50 UK — SDO Compatibility**
   - What we know: Research is based on Sage 50 Accounts UK. The project targets Sage for Accountants (Portuguese edition).
   - What's unclear: Whether the SDO DLL ProgID, registry key path, and DataSet field names differ in the Portuguese edition.
   - Recommendation: Treat all SDO object/field names as unverified until tested on the actual PT installation. Use configuration constants (not hard-coded strings) for all dataset and field names so they can be updated without code changes.

4. **Node.js Architecture (x86 vs x64) for SDO**
   - What we know: A search result from the STACK research confirmed that SDO x86 is available alongside x64 for third-party add-ons. One source noted `SDO is a 32-bit COM server and as such can only be loaded via a 32-bit process`.
   - What's unclear: Whether the target deployment has 32-bit SDO (requiring Node x86) or 64-bit SDO. Sage 50 v30+ ships 64-bit but the x86 SDO is available for third-party integrations.
   - Recommendation: This is the STATE.md blocker: "Sage 50 bitness on target machine must be confirmed before building the COM bridge." If only 32-bit SDO is available, the Node.js process in the fork must be x86 — run `node --version` and check architecture, or use `process.arch` in the bridge host startup.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (^2.x) — Jest-compatible, Vite ecosystem |
| Config file | `vitest.config.ts` — Wave 0 gap (does not exist yet) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SAGE-01 | COM bridge child process starts and responds to IPC ping | unit | `npx vitest run tests/sage-bridge/bridge-client.test.ts` | Wave 0 gap |
| SAGE-01 | ProgID detection reads registry and returns `SDOEngine.XX` format | unit (with mock `execSync`) | `npx vitest run tests/sage-bridge/detect-progid.test.ts` | Wave 0 gap |
| SAGE-02 | `amountPence` is always an integer (Math.round applied) | unit | `npx vitest run tests/sage-bridge/pence-conversion.test.ts` | Wave 0 gap |
| SAGE-02 | GET `/api/companies/:id/transactions` returns `{ rows, total }` shape | integration (stub bridge) | `npx vitest run tests/api/transactions.test.ts` | Wave 0 gap |
| SAGE-04 | Switching companyId returns different transaction rows | integration (stub bridge) | `npx vitest run tests/api/company-switch.test.ts` | Wave 0 gap |
| DASH-01 | Fastify returns `index.html` for non-API routes (SPA fallback) | integration | `npx vitest run tests/server/spa-fallback.test.ts` | Wave 0 gap |
| DASH-01 | `formatAmount(123456)` returns `"1.234,56 €"` | unit | `npx vitest run tests/utils/format-amount.test.ts` | Wave 0 gap |

> Note: SAGE-01 and SAGE-02 SDO read tests against a real Sage installation are **manual-only** — they require a Windows machine with Sage installed and cannot be automated in CI. The automated tests above use a stub bridge that returns fixture data.

### Sampling Rate
- **Per task commit:** `npx vitest run tests/utils/ tests/sage-bridge/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `vitest.config.ts` — Vitest config with alias for `@/` (mirrors Vite path aliases)
- [ ] `tests/sage-bridge/bridge-client.test.ts` — Covers SAGE-01 IPC round-trip with mock child
- [ ] `tests/sage-bridge/detect-progid.test.ts` — Covers SAGE-01 registry detection with mocked `execSync`
- [ ] `tests/sage-bridge/pence-conversion.test.ts` — Covers SAGE-02 integer-pence invariant
- [ ] `tests/api/transactions.test.ts` — Covers SAGE-02 API shape with stub bridge
- [ ] `tests/api/company-switch.test.ts` — Covers SAGE-04 company switching
- [ ] `tests/server/spa-fallback.test.ts` — Covers DASH-01 SPA routing fallback
- [ ] `tests/utils/format-amount.test.ts` — Covers DASH-01 Portuguese amount formatting
- [ ] Install: `npm install -D vitest @vitest/coverage-v8`

---

## Sources

### Primary (HIGH confidence)
- [winax GitHub Issue #31](https://github.com/durs/node-activex/issues/31) — Confirmed synchronous-only, multi-process workaround recommended by maintainer
- [drizzle-orm/get-started-sqlite](https://orm.drizzle.team/docs/get-started-sqlite) — better-sqlite3 setup, schema definition, drizzle-kit push
- [TanStack Router v1 docs](https://tanstack.com/router/v1/docs/framework/react/installation/with-vite) — @tanstack/router-plugin Vite setup, file naming convention
- [shadcn/ui Vite installation](https://ui.shadcn.com/docs/installation/vite) — `npx shadcn@latest init -t vite`, component add commands
- [TanStack Query v5 useQuery reference](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery) — options including `placeholderData`, `enabled`, `refetchInterval`
- [Node.js child_process docs](https://nodejs.org/api/child_process.html) — fork() + IPC message passing API

### Secondary (MEDIUM confidence)
- [Sage KB: Development Basics](https://gb-kb.sage.com/portal/app/portlets/results/viewsolution.jsp?solutionid=200518071050312) — SDO overview, COM-based architecture confirmed
- [Sage KB: Download and install SDO update](https://gb-kb.sage.com/portal/app/portlets/results/view2.jsp?k2dockey=201224120012523) — SDO versions aligned to Sage 50 versions; both 32-bit and 64-bit available
- [fastify-static README](https://github.com/fastify/fastify-static) — `setNotFoundHandler` pattern for SPA catch-all
- [Sage v32 Developer Release notes](https://gb-kb.sage.com/portal/app/portlets/results/view2.jsp?k2dockey=250905100100277) — Latest SDO release; 64-bit SDO availability confirmed
- ARCHITECTURE.md, STACK.md, PITFALLS.md in `.planning/research/` — Project-specific research from 2026-03-17

### Tertiary (LOW confidence — flag for validation)
- SDO registry key path `HKLM\SOFTWARE\Wow6432Node\Sage\Line 50\SDO` — inferred from community posts; must be verified on real installation
- SDO DataSet names (`AUDIT_JOURNAL`, field names) — from community examples; must be validated against real Sage for Accountants (PT) company file

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Core web stack (Fastify, React, Vite, Drizzle, better-sqlite3) well-documented; versions verified against official sources
- COM bridge architecture: MEDIUM — winax synchronous behavior and multi-process pattern confirmed by maintainer; SDO object model specifics need real-machine validation
- SDO ProgID/registry: LOW-MEDIUM — Pattern inferred from Sage KB + community; exact registry path and PT edition field names are open questions
- Architecture patterns: HIGH — COM bridge in child_process.fork() is the only viable pattern; confirmed by official Node.js docs + winax maintainer
- Pitfalls: HIGH — Sourced from project PITFALLS.md which cited official Sage KB locking docs and winax GitHub issues

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (stable stack; 30-day window before re-checking TanStack/shadcn/Drizzle versions)
