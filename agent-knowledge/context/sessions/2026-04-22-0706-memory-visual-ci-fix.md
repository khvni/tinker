---
type: session
date: 2026-04-22
topic: Memory visual CI fix on TIN-196 branch
---

# Session — Memory visual CI fix

## Problem

- PR #116 failed GitHub Actions job `Visual parity`.
- Root cause was twofold:
  - `apps/desktop/playwright/visual/memory.spec.ts` still waited for legacy flat-pane text `Memory files`.
  - In browser-preview visual mode (`dev:web`), `MemoryPane` tried to call Tauri-backed memory/fs commands and rendered an error state: `Cannot read properties of undefined (reading 'invoke')`.

## Shipped

- Cherry-picked TIN-201 visual-parity harness onto `khvni/memory-categorised` so the branch can run the same Playwright gate locally.
- Added `MemoryPane` browser-preview fixtures gated strictly behind `import.meta.env.VITE_E2E === '1'`.
- Added preview-safe markdown/diff handling for the selected memory entry so the visual harness renders the categorised pane instead of a Tauri error state.
- Froze preview relative-time reference for deterministic snapshots.
- Updated the memory visual spec to wait for the current selected-entry heading instead of removed legacy copy.
- Reused the same preview sidebar buckets in the design-system playground to avoid drift between preview data sets.

## Verification

- `pnpm -r typecheck`
- `pnpm -r lint`
- `pnpm -r test`
- `pnpm --filter @tinker/desktop test:visual`

All green locally after the fix.
