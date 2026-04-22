---
type: session
date: 2026-04-22
topic: Merge latest origin/main into khvni/tin-193-195
---

# Session — merge `origin/main` into `khvni/tin-193-195`

## Conflict

- `packages/design/src/styles/tokens.css`

## Resolution

- Kept the branch's D28 Paper 9J-0 light-surface values:
  - `--color-bg-primary: #fefcf8`
  - `--color-bg-elevated: #ffffff`
  - `--color-bg-panel: #f9f5ec`
  - `--color-bg-input: #fefcf8`
  - `--color-bg-hover: #f4efe4`
- Preserved the newer `origin/main` addition of `--color-bg-sidebar` in both themes because `MemorySidebar.css` consumes it.

## Verification

- `pnpm --filter @tinker/desktop typecheck`
