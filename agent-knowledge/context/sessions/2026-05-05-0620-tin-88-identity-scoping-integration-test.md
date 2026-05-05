---
type: session
date: 2026-05-05
topic: TIN-88 — End-to-end identity-scoping integration test (M8.15)
---

# Session — TIN-88 identity-scoping integration test

## Summary

Closed the M8 milestone's verification gate (M8.15) by automating the six-step ticket scenario as a Vitest integration test. No production code changes — all identity-scoping infrastructure already shipped in M8.1–M8.14, M8.16. This PR proves the contract holds end-to-end.

## What shipped

- `apps/desktop/src/renderer/identityScopingIntegration.test.ts` — single integration test that walks all six ticket steps:
  1. User A signs in → picks folder F → writes a chat message → app "closes".
  2. Sign-out + sign-in as User B emits `memory.path-changed` (`previousUserId=A`, `nextUserId=B`).
  3. `listSessionsForUser(B)` is empty; A's session is still present in A's list only.
  4. User B picks F → JSONL lands at `<F>/.tinker/chats/<B>/<sessionB>.jsonl`; A's JSONL is byte-identical.
  5. `<memory_root>/<B>/` does not contain A's marker file; A's subdir still does.
  6. Sign-back-in as A → `listSessionsForUser(A)` returns `[sessionA]`; `readChatHistory` rehydrates the original events; `getUser(A)` round-trips.
- `docs/mvp-verification.md` — short scenario doc pointing at the automated test as the canonical verification, with the table mapping each ticket step to the assertion that proves it.
- `agent-knowledge/context/tasks.md` row 8.15 → `review`.

## Scope discipline

- The test mocks **only** the Tauri runtime primitives (`@tauri-apps/api/path`, `@tauri-apps/plugin-fs`, `@tauri-apps/plugin-sql`) so it can run in pure Node. `@tinker/memory` (`upsertUser`, `createSession`, `listSessionsForUser`, `findLatestSessionForFolder`, `syncActiveMemoryPath`, `getActiveMemoryPath`, `subscribeMemoryPathChanged`) and `@tinker/bridge` (`createChatHistoryWriter`, `readChatHistory`) run for real against a Node-fs-backed plugin-fs and an in-memory SQL fake that handles only the queries the scenario exercises.
- Out of scope: Better Auth sidecar HTTP/PKCE flow, OpenCode sidecar respawn / `SMART_VAULT_PATH` plumbing, renderer Chat-pane hydration ordering. Those layers each have their own targeted tests; M8.15 is the seam test that proves the per-user data model holds when the active user changes mid-app.
- No new dependencies. The fake SQL Database is ~150 lines of dispatch and matches the same hand-rolled style already used in `packages/memory/src/session-store.test.ts`.

## Files

- `apps/desktop/src/renderer/identityScopingIntegration.test.ts` (new)
- `docs/mvp-verification.md` (new)
- `agent-knowledge/context/tasks.md` (row 8.15 → review)

## Verification

- `pnpm --filter @tinker/desktop exec vitest run src/renderer/identityScopingIntegration.test.ts` — green.
- `pnpm -r typecheck && pnpm -r --parallel lint && pnpm -r --parallel test` — green (62 desktop test files / 303 tests; no new lint warnings introduced).

## Links

- Linear: TIN-88 → In Review on PR open.
- Related rows: tasks.md M8.15 (this), M2.7 (still `not started` — per-user session list filter is wired through `Chat.tsx`; flagged on the Linear comment for a separate clean-up).

## Next

- Human walkthrough of `docs/development.md` to clear the manual MVP smoke checklist (steps 8 + 9 cover the same scope as this automated test against a live Tauri shell).
- Optional follow-up: extend the seam test to also assert OpenCode sidecar respawn on user switch once the sidecar gains a deterministic test harness.
