---
type: session
date: 2026-04-22
topic: TIN-60 memory pane list
---

# Session — TIN-60 memory pane list

## What landed

- Replaced the `kind: 'memory'` placeholder with a real `apps/desktop/src/renderer/panes/MemoryPane/` component.
- Added `packages/memory/src/memory-files.ts` to resolve the active memory path, walk markdown files recursively, stat them, and return newest-first metadata.
- Wired workspace runtime context so the Memory pane can read `currentUserId` and open markdown files through FilePane.
- Subscribed the pane to `subscribeMemoryPathChanged()` so memory-root moves trigger a reload.

## Verification

- `pnpm -r typecheck`
- `pnpm -r lint`
- `pnpm -r test`
- Targeted desktop tests cover empty state, click-to-open, and path-change refresh.

## PR

- PR #85 — `feat(memory): add memory pane list (TIN-60)`

## Follow-ups / notes

- Paper MCP was not available in this Codex workspace, so UI review used existing `@tinker/design` tokens/primitives only.
- Live file-system watch for new `.md` files is still out of scope for TIN-60; current refresh triggers are initial load, user change/remount, and `memory.path-changed`.
