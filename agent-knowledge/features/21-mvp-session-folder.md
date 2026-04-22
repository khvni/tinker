---
type: feature
status: not started
priority: p0
pillar: M2
depends_on: ["M1.7 (Workspace uses @tinker/panes)"]
supersedes: []
mvp: true
---

# M2 — Folder-scoped session

## Goal

Every chat session is bound to a local folder the user explicitly picks. The OpenCode sidecar runs inside that folder (`--cwd <folder>`), so file references, tool calls, and working context are folder-scoped by default.

This is the MVP's identity model: no sign-in, no account, no OAuth — just "which folder are you working in right now."

## Scope

- `Session` type: `{ id, folderPath, createdAt, lastActiveAt, modelId?: string }`. Persisted in SQLite `sessions` table.
- Tauri commands: `open_folder_picker`, `start_opencode(folder_path)`, `stop_opencode(pid)`.
- **No first-run screen** (per [[decisions]] D26 / TIN-187). App boots directly into a single Chat pane. Folder selection happens from a button next to ModelPicker in the Chat composer.
- "New session" anywhere in the app = folder picker → spawn sidecar → bind to active Chat pane.
- Session switcher on cold launch shows recent sessions ordered by `lastActiveAt`.
- On app quit, all running sidecars are stopped (best-effort per D22 coordinator pattern).
- `user_id` defaults to `'local-user'` placeholder until Better Auth (M8) is reached via Settings; rows migrate to the real user-id on first sign-in.

## Out of scope

- Identity / sign-in (Better Auth deferred; [[01-sso-connector-layer]]).
- Multi-session parallelism. MVP allows switching between sessions but only one is "active" (only one sidecar running) at a time.
- Session sharing / multi-user access to the same folder.
- Remote sessions / cloud folders.

## Acceptance

- Opening the app with an empty SQLite → workspace opens to a single Chat pane with an inline "Pick a folder to start" hint; the composer's folder-picker button is the only call to action.
- Picking a folder via that button → `opencode serve --cwd <folder>` spawns → Chat pane is bound to the new session once health check passes (no route change, no full-window screen).
- Quitting + reopening the app → session switcher shows the previous session at the top.
- "New session" button → folder picker → second session row appears.
- Switching between sessions stops the previous sidecar and starts a new one for the picked session's folder.
- Titlebar shows the active session's folder basename.

## Atomic tasks

See `agent-knowledge/context/tasks.md` §M2.

## Notes for agents

- Do NOT introduce a "default" session or a hidden global folder. Every session is explicit.
- Sidecar lifecycle follows the coordinator pattern from [[decisions]] D17/D22: spawn → health-poll → record `{pid, port, secret}` → `unref` → adopt via manifest across restarts. Manifests live in `~/.tinker/manifests/<session-id>.json`.
- `start_opencode` takes config per call (D22). No mutate-then-call.
- Session-switch race: if user clicks a second session while the first is still starting, cancel the first spawn, stop if health-poll already succeeded, then start the second. Keep this logic in Rust; the renderer just calls `stop_opencode` then `start_opencode`.
