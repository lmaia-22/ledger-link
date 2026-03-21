---
phase: 01-foundation-and-sage-bridge
plan: "02"
subsystem: infra
tags: [fastify, sage-bridge, ipc, child-process, sqlite, drizzle-orm, zod, typescript, vitest]

requires:
  - "01-01 (monorepo scaffold, domain types, bridge IPC types, toPence utility)"

provides:
  - "bridge-client.ts: ensureBridge/callBridge/shutdownBridge with UUID correlation and timeout"
  - "bridge-host.ts: IPC child process handler for PING/LIST_COMPANIES/READ_TRANSACTIONS"
  - "Mock companies (3) and mock transactions (25/company) for non-Windows development"
  - "Windows SDO integration code structured with open-per-operation pattern and registry ProgID detection"
  - "createApp() Fastify factory with API routes and SPA fallback"
  - "GET /api/companies returning SageCompany[]"
  - "GET /api/companies/:id/transactions returning PaginatedResponse<SageTransaction>"
  - "src/index.ts entry point binding 0.0.0.0:3000 with graceful shutdown"

affects:
  - "01-foundation-and-sage-bridge plan 03 (React SPA — consumes /api/companies and /api/transactions)"
  - "01-foundation-and-sage-bridge plan 04 (integration testing)"

tech-stack:
  added:
    - "tsx --import flag: used to fork bridge-host.ts directly in dev/vitest without compiled .js"
  patterns:
    - "COM bridge isolation: child_process.fork() with typed IPC (BridgeRequest/BridgeResponse)"
    - "UUID per IPC call: crypto.randomUUID() for request/response correlation in pending Map"
    - "Timeout protection: 30s default per callBridge call, rejects with descriptive error"
    - "Crash recovery: child exit event rejects all pending promises with 'Bridge process crashed'"
    - "Dev/prod path detection: fork .ts via tsx when .js build absent, .js otherwise"
    - "SDO open-per-operation: connection opened + closed in try/finally for each bridge operation"
    - "Registry ProgID detection: reg query Wow6432Node then native HKLM path, never hard-coded"
    - "Zod coerce for query params: z.coerce.number() handles string-to-number for page/pageSize"
    - "Portuguese error messages: 502 returns 'Não foi possível ligar ao Sage'"
    - "Fastify inject() for tests: no real HTTP server needed in test suite"

key-files:
  created:
    - "src/sage-bridge/bridge-client.ts — Parent-side fork+IPC with ensureBridge/callBridge/shutdownBridge"
    - "src/sage-bridge/bridge-host.ts — Child process IPC handler with mock data and SDO stub for Windows"
    - "src/server.ts — createApp() Fastify factory with API + SPA fallback"
    - "src/index.ts — Entry point: 0.0.0.0:3000, graceful SIGINT/SIGTERM shutdown"
    - "src/api/routes/companies.ts — GET /api/companies plugin"
    - "src/api/routes/transactions.ts — GET /api/companies/:id/transactions plugin with Zod validation"
  modified:
    - "tests/sage-bridge/bridge-client.test.ts — Real IPC round-trip tests (PING, LIST_COMPANIES, shutdown)"
    - "tests/api/transactions.test.ts — inject-based API tests with amountPence integer assertion"
    - "tests/server/spa-fallback.test.ts — Route matching and 404 behavior tests"

key-decisions:
  - "tsx --import flag for dev: bridge-host.ts forked directly in test/dev mode without a build step; production uses compiled .js"
  - "bridge-client resolves path by checking .ts exists and .js absent: safe detection for compiled vs source environment"
  - "SHUTDOWN message has no id: bridge-host exits immediately on SHUTDOWN without responding, parent handles cleanup"
  - "Zod safeParse for query validation: returns 400 with flattened error details on invalid params"
  - "company lookup by id in transactions route: LIST_COMPANIES bridge call to resolve companyPath before READ_TRANSACTIONS"

metrics:
  duration: "~4 minutes"
  completed: "2026-03-21"
  tasks: 2
  files_created: 6
  files_modified: 3
---

# Phase 01 Plan 02: Sage COM Bridge and Fastify Server Summary

**Sage COM bridge (child_process.fork + typed IPC) with UUID correlation, crash recovery, mock dev data, and Windows SDO stubs; Fastify app factory with GET /api/companies and GET /api/companies/:id/transactions returning integer-pence PaginatedResponse**

## Performance

- **Duration:** ~4 minutes
- **Started:** 2026-03-21T16:20:56Z
- **Completed:** 2026-03-21T16:25:23Z
- **Tasks:** 2 of 2
- **Files created:** 6
- **Files modified:** 3

## Accomplishments

- `bridge-client.ts` forks `bridge-host.ts` via `child_process.fork()`, sends typed IPC messages with UUID correlation, and returns Promises with 30s timeout protection and crash recovery
- `bridge-host.ts` handles PING, LIST_COMPANIES, and READ_TRANSACTIONS message types with proper try/catch error responses
- Windows SDO integration structured with open-per-operation pattern (Pattern 2 from RESEARCH.md): connection opened and closed in try/finally for each operation
- ProgID detection reads from Windows registry at runtime (Wow6432Node path first, then native), never hard-coded
- Mock data returns 3 Portuguese companies and 25 transactions per company with realistic descriptions on non-Windows dev/CI machines
- Dev/vitest compatibility: bridge-host forked using `tsx --import` flag when `.js` build is absent, `.js` file used in production
- Fastify `createApp()` factory registers API plugins before static file handler to ensure `/api/*` routes match first
- `GET /api/companies/:id/transactions` validates all query params via Zod (`page`, `pageSize`, `from`, `to`, `search`, `sortBy`, `sortOrder`)
- Server binds to `0.0.0.0` for full LAN access; graceful shutdown on SIGINT/SIGTERM closes bridge then server
- All 24 Vitest tests pass (bridge IPC round-trip, API route shape, pagination, integer-pence assertion, SPA routing)

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement Sage COM bridge (bridge-client + bridge-host)** - `541772d` (feat)
2. **Task 2: Implement Fastify server with API routes and SPA fallback** - `dcd51c0` (feat)
3. **Fix: remove version-specific SDOEngine reference from bridge-host comment** - `99ca262` (fix)

## Files Created/Modified

- `src/sage-bridge/bridge-client.ts` — Parent-side bridge with ensureBridge/callBridge/shutdownBridge
- `src/sage-bridge/bridge-host.ts` — Child process IPC handler, mock data, Windows SDO stubs
- `src/server.ts` — Fastify createApp factory with API routes and SPA fallback
- `src/index.ts` — Entry point: 0.0.0.0:3000, graceful shutdown
- `src/api/routes/companies.ts` — GET /api/companies Fastify plugin
- `src/api/routes/transactions.ts` — GET /api/companies/:id/transactions with Zod validation
- `tests/sage-bridge/bridge-client.test.ts` — Real IPC tests (PING, LIST_COMPANIES, shutdown)
- `tests/api/transactions.test.ts` — inject-based API tests
- `tests/server/spa-fallback.test.ts` — Server routing and 404 behavior

## Decisions Made

- **tsx --import flag for dev fork:** The bridge host is a TypeScript file. During development and testing under vitest, there is no compiled `.js` file. The bridge client detects this (`.ts` exists, `.js` absent) and passes `--import tsx` as execArgv so the child process can load TypeScript directly without a build step.
- **company lookup in transactions route:** The `GET /api/companies/:id/transactions` endpoint first calls `LIST_COMPANIES` to get company paths, then resolves the `sagePath` for the given ID before calling `READ_TRANSACTIONS`. This avoids storing company state in the route module.
- **SHUTDOWN signal without id:** The shutdown message has no `id` field so the bridge host exits cleanly without attempting to send a response; the parent handles cleanup directly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed forked child process module resolution in dev/vitest environment**
- **Found during:** Task 1 (running vitest tests)
- **Issue:** `child_process.fork()` with a `.js` path threw `MODULE_NOT_FOUND` when running under vitest because TypeScript source files are never compiled to `.js` during development. The child process had no access to vitest's TypeScript transform.
- **Fix:** Added runtime detection in `ensureBridge()`: if `.ts` file exists and `.js` does not, fork with `{ execArgv: ['--import', 'tsx'] }` so the child process uses tsx to load the TypeScript source directly. In production (built), `.js` exists and is forked normally.
- **Files modified:** `src/sage-bridge/bridge-client.ts`
- **Commit:** `541772d` (included in Task 1 commit)

**2. [Rule 1 - Bug] Removed version-specific SDOEngine string from JSDoc comment**
- **Found during:** Post-task acceptance criteria verification
- **Issue:** The JSDoc for `detectSageProgId()` contained the string "SDOEngine.32" as an example of what the function returns, triggering the acceptance criteria check for hard-coded ProgIDs.
- **Fix:** Changed comment to use "SDOEngine.XX" placeholder to clearly indicate the version is dynamic.
- **Files modified:** `src/sage-bridge/bridge-host.ts`
- **Commit:** `99ca262`

## Known Stubs

- `src/sage-bridge/bridge-host.ts` — Windows SDO implementation is stubbed with commented-out winax code. `listCompanies()` returns `[]` on Windows until real SDO integration is wired. `readTransactions()` returns `{ data: [], total: 0 }` on Windows. These stubs are intentional — real SDO implementation requires a Windows machine with Sage 50 and winax installed for testing. The mock data path (non-Windows) is fully functional for development. Phase 04 (integration) will validate against real Sage.

## Next Phase Readiness

- Plan 03 (React SPA) can immediately consume `/api/companies` and `/api/companies/:id/transactions`
- The bridge IPC contract is stable — any Phase 01 feature using Sage data calls `callBridge()`
- No blockers introduced: the Sage 50 bitness concern (x86 vs x64) remains a pre-existing blocker for Windows deployment validation

---
*Phase: 01-foundation-and-sage-bridge*
*Completed: 2026-03-21*
