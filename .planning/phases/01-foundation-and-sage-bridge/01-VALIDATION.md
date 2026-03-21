---
phase: 1
slug: foundation-and-sage-bridge
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-17
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.x |
| **Config file** | `vitest.config.ts` — Wave 0 installs |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | SAGE-01 | unit | `npx vitest run tests/sage-bridge/bridge-client.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | SAGE-01 | unit | `npx vitest run tests/sage-bridge/detect-progid.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 1 | SAGE-02 | unit | `npx vitest run tests/sage-bridge/pence-conversion.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | SAGE-02 | integration | `npx vitest run tests/api/transactions.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 1 | SAGE-04 | integration | `npx vitest run tests/api/company-switch.test.ts` | ❌ W0 | ⬜ pending |
| 01-03-01 | 03 | 1 | DASH-01 | integration | `npx vitest run tests/server/spa-fallback.test.ts` | ❌ W0 | ⬜ pending |
| 01-03-02 | 03 | 1 | DASH-01 | unit | `npx vitest run tests/utils/format-amount.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

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

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SDO connects to real Sage company file | SAGE-01 | Requires Windows + Sage installed | 1. Run bridge-host.ts on Windows with Sage 2. Send LIST_COMPANIES IPC message 3. Verify companies returned |
| SDO reads transactions from real dataset | SAGE-02 | Requires Windows + Sage with data | 1. Connect to test company 2. Send READ_TRANSACTIONS 3. Verify rows with correct fields |
| Company switching returns distinct data | SAGE-04 | Requires two Sage company files | 1. Read from company A 2. Switch to company B 3. Verify different transaction data |
| Browser on LAN machine loads UI | DASH-01 | Requires LAN network access | 1. Start server on Windows machine 2. Open browser on different LAN machine 3. Navigate to server IP:3000 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
