---
type: session
date: 2026-04-22
topic: TIN-205 exact memory folder parity
---

# Session — TIN-205 exact memory folder parity

## Shipped

- Deleted the lowercase / hyphenated Memory folder mapping layer in `packages/memory/src/memory-categories.ts`. Canonical folders are now exact UI names: `Pending`, `People`, `Active Work`, `Capabilities`, `Preferences`, `Organization`.
- Updated per-user memory bootstrap in `packages/memory/src/memory-paths.ts` so every active memory root creates those six folders automatically.
- Reworked categorised file bucketing, MemoryPane previews, design-system playground data, and Rust approve-path validation to use the exact on-disk folder names.
- Updated tests across `packages/memory`, `apps/desktop`, and Rust so counts, bucket keys, and move flows all assert the exact folder contract.
- Documented the contract in `agent-knowledge/features/26-mvp-memory-filesystem.md` and added task row `6.11` in `agent-knowledge/context/tasks.md`.

## Verification

- `pnpm -r typecheck`
- `pnpm -r lint`
- `pnpm -r test`
- `cd apps/desktop/src-tauri && cargo test --lib`

All green on `khvni/tin-205`.

## Ship state

- Commit: `64751c5` — `feat(memory): exact folder parity (TIN-205)`
- PR: #123 — https://github.com/khvni/tinker/pull/123

## Notes

- Memory sidebar/category discovery is now filesystem-first only. No slug aliasing remains.
- Pending approval still expects an exact category folder name in `kind:` frontmatter when choosing the destination folder. The lookup is exact-match only; no lowercase / hyphen normalization remains.
