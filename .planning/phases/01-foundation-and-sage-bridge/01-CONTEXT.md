# Phase 1: Foundation and Sage Bridge - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

LAN server scaffold + Sage SDO COM bridge running in an isolated child process + browser UI shell that reads transactions from a real Sage company dataset. The server remains responsive during COM calls. Users can switch between multiple Sage company datasets and view transactions in the browser.

</domain>

<decisions>
## Implementation Decisions

### App Shell Layout
- Sidebar + content layout (left sidebar, main content area on the right)
- Sidebar is collapsible to icons only for maximum content area width
- Phase 1 sidebar shows: company list (always visible), Transacções nav item, Sage connection status footer
- Dashboard/Documents/Settings nav items hidden until their phases ship — only show what Phase 1 delivers
- Sage connection status indicator at sidebar footer: "Sage: Ligado" (green) or "Sage: Desligado" (red)

### Visual Style & Theming
- Clean & professional aesthetic — neutral colors, subtle borders, good typography (Linear/Notion feel)
- shadcn/ui component library (Radix-based, Tailwind-styled, copy-paste ownership)
- Light + dark mode, system-preference-aware (shadcn/ui CSS variables)
- UI language is Portuguese (PT-PT) — all labels, headings, messages, and field names in Portuguese

### Frontend Stack Decisions
- TanStack Router for client-side routing (type-safe, file-based routes, pairs with TanStack Query)
- TanStack Table for the transactions data grid
- TanStack Query for server-state management

### Company Switching
- Company list always visible in sidebar (no dropdown — with ≤10 companies, all fit)
- Click to select, active company highlighted with visual indicator
- Green dot = connected to Sage, gray dot = not connected — per-company connection status in the list
- Switching companies preserves the current view (e.g., stay on transactions, show new company's data)
- Company list auto-discovered from Sage on startup — no manual configuration needed

### Sage Data Display
- Phase 1 shows transactions list only (date, reference, description, amount, type)
- TanStack Table with column sorting (click headers) + date range filter + search box for reference/description
- Server-side pagination, 50 rows per page, page controls at bottom
- Monetary amounts in Portuguese format: 1.234,56 € (comma decimal, dot thousands, euro symbol)
- Integer-pence convention enforced in database schema — all amounts stored as integers

### Connection Feedback
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project specs
- `.planning/PROJECT.md` — Core value, constraints (Windows platform, LAN-only, Node.js backend), key decisions table
- `.planning/REQUIREMENTS.md` — SAGE-01 (SDK connection), SAGE-02 (read transactions), SAGE-04 (multi-company), DASH-01 (browser UI)

### Architecture & stack
- `.planning/research/ARCHITECTURE.md` — System architecture diagram, COM bridge isolation pattern, project structure, data flows
- `.planning/research/STACK.md` — Recommended stack (Fastify, React, SQLite, winax, drizzle-orm), version compatibility, installation

### Sage integration
- `.planning/research/PITFALLS.md` — COM bridge pitfalls, SDO connection lifecycle, bitness considerations

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing code

### Established Patterns
- None yet — Phase 1 establishes the foundational patterns

### Integration Points
- Sage 50 SDO COM via winax in child_process.fork()
- SQLite via better-sqlite3 + drizzle-orm for app state
- Fastify HTTP server serving React SPA via Vite

</code_context>

<specifics>
## Specific Ideas

- Sidebar layout inspired by Linear/Notion — clean professional business tool feel
- Company list similar to Slack workspace switcher but always-visible (not a popup)
- Sage connection status always visible at sidebar footer — accountants need to know at a glance if Sage is reachable
- Portuguese locale formatting throughout (1.234,56 €) matching what accountants see in Sage itself

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation-and-sage-bridge*
*Context gathered: 2026-03-17*
