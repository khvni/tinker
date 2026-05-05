# MVP verification — identity scoping

End-to-end proof that Tinker scopes sessions, chat history, and memory per user. Pairs M8 (identity) with M2 (folder-scoped sessions) + M6 (per-user memory).

## Automated test

The six-step scenario is encoded as a Vitest integration test:

```
apps/desktop/src/renderer/identityScopingIntegration.test.ts
```

Run it locally:

```bash
pnpm --filter @tinker/desktop exec vitest run src/renderer/identityScopingIntegration.test.ts
```

The test exercises real `@tinker/memory` (`upsertUser`, `createSession`, `listSessionsForUser`, `findLatestSessionForFolder`, `syncActiveMemoryPath`) and real `@tinker/bridge` (`createChatHistoryWriter`, `readChatHistory`) modules against a Node-fs-backed `@tauri-apps/plugin-fs` mock and an in-memory `@tauri-apps/plugin-sql` Database fake. The Tauri shell, OAuth flow, and OpenCode sidecar are out of scope — those layers are exercised by the manual smoke test in `docs/development.md`.

## Scenario

| # | Step | Verified by |
|---|------|-------------|
| 1 | User A signs in, picks folder `F`, sends a message, app closes. | `upsertUser(A)` + `createSession(sessionA)` + `createChatHistoryWriter({ folderPath: F, userId: A })` writes to `<F>/.tinker/chats/<A>/<sessionA>.jsonl`. |
| 2 | Sign out → sign in as User B. | `syncActiveMemoryPath(B)` emits `memory.path-changed` with `previousUserId=A`, `nextUserId=B`. |
| 3 | Folder `F` session NOT visible in User B's switcher. | `listSessionsForUser(B)` is empty; `findLatestSessionForFolder(B, F)` is null; A's session list still contains `sessionA`. |
| 4 | User B picks folder `F` → new JSONL at `<F>/.tinker/chats/<B>/<sessionB>.jsonl`. | New per-user JSONL exists; A's JSONL is byte-identical to step 1; B's chats dir contains only `<sessionB>.jsonl`. |
| 5 | User B's memory subdir is empty (no leak from A). | `<memory_root>/<B>/` does not contain A's marker file; `<memory_root>/<A>/` still does. |
| 6 | Sign out → sign back in as User A → old session resumes + hydrates. | `syncActiveMemoryPath(A)` returns A's original path; `listSessionsForUser(A)` returns `[sessionA]`; `readChatHistory({ folderPath: F, userId: A, sessionId: sessionA })` returns the original events; `getUser(A)` round-trips. |

## What the test does NOT cover

- The Better Auth sidecar's HTTP/PKCE flow (covered by `packages/auth-sidecar` tests).
- The OpenCode sidecar respawn on user switch (`SMART_VAULT_PATH` plumbing in `apps/desktop/src-tauri`).
- Renderer UI hydration ordering (covered by `apps/desktop/src/renderer/panes/Chat/Chat.test.tsx` + `historyReplay.test.ts`).

For a full-stack manual pass — including OAuth, MCP startup, and the live Chat pane — run the steps in [`docs/development.md`](./development.md).
