---
type: concept
tags: [tasks, status, tracking, mvp]
---

# Tinker Tasks

Open work + status + priorities. Agents update this file when starting, progressing, or closing work. PRs reference the task line they close.

> **[2026-04-21] Refocus.** Scope cut to seven MVP pillars per [[decisions]] D25. All prior in-flight features (01–15) deferred to post-MVP. MVP tasks below are atomic: one PR, one acceptance criterion, ≤1 day of work. Async agents can claim any `not started` row whose dependencies are `done`.

## Priority Legend
- **p0** — MVP ship-blocker
- **p1** — MVP quality bar
- **p2** — post-MVP v1
- **p3** — backlog / maybe-never

## Status Legend
- `not started` — claimable
- `claimed` — an agent has claimed; add session ID + ETA
- `in progress` — code being written
- `review` — PR open, awaiting merge
- `done` — merged + verified on main

## Size Legend
- **S** — <100 LOC, single file, <2hr
- **M** — 100–300 LOC, 1–3 files, half-day
- **L** — 300–500 LOC, research + impl, full day (if larger → subdivide)

## Claim rules (async agents, read this first)

1. Pick any `not started` row whose dependencies are all `done`.
2. Edit this file: set status `claimed`, add `[<agent-id> · ETA YYYY-MM-DD]` in the Notes column. Commit.
3. Open a branch `feat/<pillar>/<task-id>-<short-slug>` (e.g. `feat/M1/1.2-chat-pane-register`).
4. Open a draft PR immediately titled `feat(<scope>): <task summary>` referencing the matching spec `[[20-mvp-panes-workspace]]` etc.
5. On merge: update status to `done`. Do not delete the row.
6. **Atomicity rule**: if your task exceeds the stated size, stop and split it in this file before writing more code. Don't inflate a PR beyond its slice.

---

## M0 — MVP (v0.1 ship target)

Eight pillars (seven product surfaces + Better Auth identity for per-user chat-history persistence). Atomic tasks per pillar. Pillars are the TOP-LEVEL goals from [[decisions]] D25.

### M1 — Panes+tabs workspace (cohesive layout)
Spec: [[20-mvp-panes-workspace]] · Depends on: `@tinker/panes` (done) · D16

| ID | Task | Size | Depends on | Status | Notes |
|----|------|------|------------|--------|-------|
| 1.1 | Define `TinkerPaneKind` union in `@tinker/shared-types`: `'chat' \| 'file' \| 'settings' \| 'memory'`. Typed `TinkerPaneData` discriminated union. | S | — | done | TIN-5 · PR #14 merged 2026-04-21. |
| 1.2 | Create `workspace/pane-registry.ts` implementing `PaneRegistry<TinkerPaneKind>`. Export `registerPane(kind, render)` + `getRenderer(kind)`. | S | 1.1 | review | TIN-6 · PR #21. Legacy Dockview surface kept until M1.7/M1.8. |
| 1.3 | Register `{ kind: 'chat' }` → existing `<Chat>` component. No Chat-component internals change. | S | 1.2 | not started | Pure registration. |
| 1.4 | Register `{ kind: 'file', data: { path, mime } }` → single dispatch component that reads `mime` and picks renderer. | S | 1.2 | not started | Unifies 6 file-renderer panes. |
| 1.5 | Register `{ kind: 'settings' }` + `{ kind: 'memory' }` placeholders (render empty `<EmptyPane/>` until filled by M5/M6). | S | 1.2 | not started | Clears registry surface. |
| 1.6 | Rewrite `layout.default.ts` → returns `WorkspaceState<TinkerPaneData>` with a single Chat pane. No split, no secondary pane. | S | 1.3 | not started | MVP default = just Chat. |
| 1.7 | Swap `Workspace.tsx` internals: replace `<DockviewReact>` with `<Workspace>` from `@tinker/panes/react`. Read + write `WorkspaceState` via `@tinker/memory/layout-store` (already exists). | M | 1.3, 1.4, 1.5, 1.6 | not started | Dockview gone from the render tree. |
| 1.8 | Delete `workspace/DockviewContext.ts`, `workspace/chat-panels.ts` + callers. Delete Dockview CSS imports. | S | 1.7 | not started | Quarantine cleanup. |
| 1.9 | Remove `dockview-react` from `apps/desktop/package.json`. Run `pnpm install`. Verify `pnpm typecheck` passes. | S | 1.8 | not started | Kills the dep. |
| 1.10 | Layout snapshot migration: detect old Dockview-shaped JSON in SQLite `layouts` table → delete + re-seed default. Log once. | S | 1.9 | not started | One-shot. Acceptable data loss on upgrade (pre-v1). |

### M2 — Folder-scoped session (every chat starts in a local directory, per-user)
Spec: [[21-mvp-session-folder]] · Depends on: M1.7 · Sessions are bound to current user from M8.

| ID | Task | Size | Depends on | Status | Notes |
|----|------|------|------------|--------|-------|
| 2.1 | Add `Session` type in `@tinker/shared-types`: `{ id, userId, folderPath, createdAt, lastActiveAt, modelId?: string }`. Also export `User` type placeholder (expanded in M8.1). | S | — | done | TIN-15 · PR #17 merged 2026-04-21. |
| 2.2 | SQLite `sessions` table + migrations in `@tinker/memory/database.ts` (columns: `id, user_id, folder_path, created_at, last_active_at, model_id`; FK `user_id → users(id)` once M8.3 lands — add the FK in the same PR if possible, else gate behind a follow-up). CRUD helpers in new `packages/memory/src/session-store.ts`. | M | 2.1, 8.3 | not started | Mirrors existing `scheduler-store` shape. |
| 2.3 | Rust Tauri command `open_folder_picker() -> Result<String, Error>` using `tauri-plugin-dialog`. | S | — | done | TIN-17 · PR #19 merged 2026-04-21. |
| 2.4 | Rust Tauri command `start_opencode(folder_path, user_id, memory_subdir) -> Result<OpencodeHandle, Error>` that spawns `opencode serve --cwd <folder>` with `SMART_VAULT_PATH=<memory_subdir>`. Health-poll until ready. Returns `{ baseUrl, pid }`. | M | — | done | TIN-18 · PR #20 merged 2026-04-21. 0600 manifest + detached drain task for D17 unref. Follow-up: TIN-108 to delete legacy bootstrap path. |
| 2.5 | Rust Tauri command `stop_opencode(pid: u32)` for session close. | S | 2.4 | review | TIN-19 · PR #25. SIGTERM → 2s grace → SIGKILL → manifest removed. Idempotent. Legacy `stop_opencode(&AppHandle)` renamed to `terminate_legacy_opencode`; full replacement follow-up TIN-108. |
| 2.6 | First-run screen (post-sign-in): full-window "Pick a folder to start" → `<Button>Choose folder…</Button>` → folder picker → creates session bound to current user → navigates into workspace. | M | 2.2, 2.3, 2.4, 8.5 | not started | Replaces existing FirstRun.tsx. Lives in `routes/first-run.tsx`. |
| 2.7 | Session restore: on app launch (post-auth), list sessions from SQLite **filtered by `user_id = currentUser.id`** ordered by `lastActiveAt`. If ≥1, show session switcher; if 0, show folder picker. | M | 2.2, 8.5 | not started | Simple list UI using `@tinker/design`. |
| 2.8 | "New session" button in session switcher → folder picker → spawn OpenCode → open new Chat pane tab. | S | 2.6 | not started | Same code path as first-run. |
| 2.9 | Active session indicator in workspace titlebar: shows folder basename + monospace short path + current user's avatar (avatar from M8.10). | S | 2.7, 8.10 | not started | Purely cosmetic surface. |
| 2.10 | On app quit, stop all running OpenCode instances (best-effort; survive kill -9 via manifest). | S | 2.5 | not started | Per D22 coordinator pattern. |
| 2.11 | Chat history JSONL writer: every OpenCode SSE event from the active session appends one line to `<folder>/.tinker/chats/<user-id>/<session-id>.jsonl`. Buffered + flushed per event. Create dirs on first write. | M | 2.2, 4.2 | not started | Stream-persistence bridge. Lives in `packages/bridge/src/chat-history.ts`. |
| 2.12 | Chat history hydration: on session open, read JSONL (if exists) and seed Chat pane with prior messages before the SSE subscription resumes. | M | 2.11 | not started | Hydrate-before-stream. Render from JSONL via same markdown path as live events. |

### M3 — In-line document renderer
Spec: [[22-mvp-inline-renderer]] · Depends on: M1.4 (file pane registration)

| ID | Task | Size | Depends on | Status | Notes |
|----|------|------|------------|--------|-------|
| 3.1 | **Research**: pick libraries for pdf / xlsx / docx / pptx / html / code / markdown. Deliverable: `agent-knowledge/reference/inline-renderers.md` with lib name + license + bundle size + rationale per format. Criterion: no paid libs, no copyleft licenses (MIT/Apache/ISC/BSD only). | M | — | done | TIN-27 · PR #18 merged 2026-04-21. |
| 3.2 | Unified `FilePane` component: accepts `{ path, mime }`, looks up renderer in `mimeToRenderer` map, renders. Fallback = "unsupported, open externally" with Tauri `shell.open`. | S | 1.4, 3.1 | not started | Dispatcher. |
| 3.3 | PDF renderer integration per 3.1 choice. Accepts file path → embedded viewer. Keyboard navigation (PgUp/PgDn). | M | 3.1, 3.2 | not started | Probably `react-pdf`. |
| 3.4 | XLSX renderer per 3.1. First-sheet-by-default + `<SegmentedControl>` sheet switcher. Read-only table. | M | 3.1, 3.2 | not started | Probably SheetJS. |
| 3.5 | DOCX renderer per 3.1. Converts → sanitized HTML → renders. No editing. | M | 3.1, 3.2 | not started | Probably `mammoth`. |
| 3.6 | PPTX renderer per 3.1. Slide carousel w/ next/prev + thumbnail strip. | M | 3.1, 3.2 | not started | Stretch if 3.1 flags as risky. |
| 3.7 | HTML renderer: sandbox iframe (`sandbox="allow-same-origin"` only, no scripts). Verify against existing `HtmlRenderer.tsx`. | S | 3.2 | not started | Already exists; move behind FilePane dispatch. |
| 3.8 | Code renderer: move existing `CodeRenderer.tsx` behind FilePane dispatch; add language autodetect via existing `code-highlighter`. | S | 3.2 | not started | Repackaging. |
| 3.9 | Markdown renderer: move existing `MarkdownRenderer.tsx` behind FilePane dispatch. Confirm GFM + code highlighting. | S | 3.2 | not started | Repackaging. |
| 3.10 | "Open file" from Chat: when OpenCode output includes a file path link, clicking opens a new FilePane tab. | M | 3.2, M1.7 | not started | Requires link handler in Chat message renderer. |
| 3.11 | Remove `panes/Today.tsx`, `panes/SchedulerPane.tsx`, `panes/Playbook.tsx`, `panes/VaultBrowser.tsx` from build. Either delete or move to `apps/desktop/_deferred/` with git mv. Per D25 only chat/file/settings/memory ship. | S | 1.10 | not started | Dead-code cleanup. |

### M4 — Chat interface (markdown rendering, input, model picker)
Spec: [[23-mvp-chat-markdown]] + [[24-mvp-model-picker]] · Depends on: M1.3

| ID | Task | Size | Depends on | Status | Notes |
|----|------|------|------------|--------|-------|
| 4.1 | **Research**: clone/browse OpenCode Desktop (sst/opencode) model-picker UI. Document open/close behavior, keyboard nav, filter semantics, grouping (provider/model/context-window display). Deliverable: `agent-knowledge/reference/opencode-desktop-model-picker.md`. | M | — | done | TIN-38 · PR #15 merged 2026-04-21. Source commit pinned `d2181e9273`. |
| 4.2 | Chat message list renders markdown via `react-markdown` + `remark-gfm` + `rehype-shiki` (match existing code-highlighter choice). Covers: headings, bold/italic, lists, tables, blockquotes, inline code, fenced code, links. | M | 1.3 | not started | Core chat requirement. |
| 4.3 | Code block renderer: uses existing `code-highlighter.ts`. Copy button per block. Language label. | S | 4.2 | not started | Reuses code. |
| 4.4 | Streaming render: SSE chunks → incremental markdown parse. Debounce re-render to 60fps max (requestAnimationFrame). No full re-parse per chunk. | M | 4.2 | not started | Perf-sensitive. |
| 4.5 | Tool-call blocks: parse OpenCode event stream for `tool.use` events. Render as collapsed `▸ used <tool-name>` disclosure. Expands on click. Hidden by default. | M | 4.2 | not started | Matches OpenCode Desktop behavior. |
| 4.6 | Thinking/reasoning blocks: same disclosure pattern. Hidden by default. Keyboard shortcut `⌥T` toggles all. | S | 4.5 | not started | Parity feature. |
| 4.7 | `<ModelPicker>` primitive in `@tinker/design` per 4.1 findings. Dropdown + search input + keyboard nav + provider/model/context-window rows. | L | 4.1 | review | TIN-44 · PR #32. Folder `ModelPicker/` (Trigger + Panel + CSS + tests). Substring filter; fuzzysort deferred. Follow-up tickets: Ctrl+N/P + click-outside scrollbar gap + ARIA combobox upgrade. |
| 4.8 | Wire ModelPicker to `opencode.config.providers()` SDK call. Group by provider. | M | 4.7 | not started | Data binding. |
| 4.9 | Persist selected model per-session in SQLite `sessions.model_id`. New session inherits last-used model. | S | 4.8, 2.2 | not started | Cross-pillar touch. |
| 4.10 | Parity verification: side-by-side with OpenCode Desktop from 4.1. Checklist in PR description. | S | 4.9 | not started | Review-as-task. |
| 4.11 | Input box: multi-line `<Textarea>` (already shipped). `Enter` submits, `Shift+Enter` newline, disabled while streaming, `Escape` calls `session.abort()`. Auto-resize up to 10 lines. | M | 4.2 | not started | Composer. |
| 4.12 | Stop button: visible only while streaming, calls `session.abort()`. Replaces send button during stream. | S | 4.11 | not started | Inline with composer. |
| 4.13 | Auto-scroll: stick to bottom during streaming unless user scrolled up. `[New messages]` pill appears when user is scrolled up + new content arrives. | M | 4.4 | not started | UX polish. |
| 4.14 | Copy-message button on each assistant message. Hover-reveal. | S | 4.2 | not started | Polish. |
| 4.15 | Clear existing tool-call / thinking UI from `Chat.tsx` that doesn't match 4.5/4.6 semantics. | S | 4.5, 4.6 | not started | Cleanup. |

### M5 — Context usage badge
Spec: [[25-mvp-context-badge]] · Depends on: M4.2

| ID | Task | Size | Depends on | Status | Notes |
|----|------|------|------------|--------|-------|
| 5.1 | **Research**: locate OpenCode SDK field for per-session token usage + model context window. Deliverable: 1-page `agent-knowledge/reference/opencode-sdk-usage.md` with exact field paths + example payload. | S | — | done | TIN-53 · PR #16 merged 2026-04-21. |
| 5.2 | `<ContextBadge percent={n} tokens={used} windowSize={max} model={name} />` primitive in `@tinker/design`. Pill w/ percent. Color: green <50%, amber 50–80%, red >80%. Tooltip w/ exact counts. | M | 5.1 | review | TIN-54 · PR #22. Pure visual + playground. |
| 5.3 | Wire badge into Chat pane header. Subscribes to same SSE stream as chat; recomputes on each message. | S | 5.2, 4.4 | not started | One call site. |
| 5.4 | Playground entry in `routes/design-system.tsx` with three states (low/mid/high). Per D14 canonical rule. | S | 5.2 | not started | Design-system hygiene. |

### M6 — Memory as desktop-native filesystem (per-user subdir)
Spec: [[26-mvp-memory-filesystem]] · Depends on: M1.5, M8.3 (current user resolved)

| ID | Task | Size | Depends on | Status | Notes |
|----|------|------|------------|--------|-------|
| 6.1 | Add `app_settings` SQLite table (key/value JSON) in `@tinker/memory/database.ts`. CRUD helpers in new `packages/memory/src/settings-store.ts`. | S | — | review | TIN-57 · PR #24 · branch `khvni/tin-57-app-settings`. |
| 6.2 | Default memory root resolver (TS): macOS `~/Library/Application Support/Tinker/memory`, Linux `~/.local/share/tinker/memory`, Windows `%APPDATA%\Tinker\memory`. Create dir if missing via Tauri fs plugin. | S | — | review | TIN-58 · PR #30 opened 2026-04-21. |
| 6.3 | On first run: seed `app_settings.memory_root` with resolved default. Per-user active path resolves to `<memory_root>/<current-user-id>/` — created if missing on sign-in. | S | 6.1, 6.2, 8.3 | not started | Init hook. |
| 6.4 | Memory pane (register in M1.5): list `.md` files in the current user's subdir. Click → opens as FilePane tab w/ Markdown renderer (3.9). | M | 6.3, 3.9 | not started | Reuses renderer. |
| 6.5 | Settings pane: "Memory folder" row with current root path + `<Button>Change location…</Button>`. Opens Tauri folder picker → validates writable → updates setting. | M | 6.3 | not started | Single setting surface for MVP. |
| 6.6 | On memory-root change: move folder contents (including all `<user-id>/` subdirs) to new location via Tauri fs plugin. Show `<Progress>` modal. On completion, reload memory pane + emit path-changed event. | M | 6.5 | not started | Filesystem move. |
| 6.7 | Simple memory injection (MVP): before `session.prompt()`, read up to N most recent `.md` files (default N=5) from `<memory_root>/<current-user-id>/`, prepend as `noReply` system context. Existing `bridge/memory-injector.ts` scaffold extended. | M | 6.3, 4.2 | not started | Recency-only. No semantic ranking. |
| 6.8 | Simple memory append (MVP, toggleable): after assistant response finishes streaming, write `<memory_root>/<user-id>/sessions/YYYY-MM-DD-HHMM-<session-id>.md` with the user prompt + final assistant message. Setting `app_settings.memory_auto_append` default `true`. | M | 6.3, 4.4 | not started | Append-only. No summarization yet. |
| 6.9 | Path-change / user-switch propagation: 6.6 AND M8.8 both trigger 6.7/6.8 to re-resolve path + trigger M7.7 (MCP env var refresh). | S | 6.6, 6.7, 6.8, 7.7, 8.8 | not started | Cross-pillar hook. |

### M7 — Built-in MCP servers (qmd, smart-connections, exa)
Spec: [[27-mvp-builtin-mcp]] · Depends on: M6.3 (memory path resolved)

| ID | Task | Size | Depends on | Status | Notes |
|----|------|------|------------|--------|-------|
| 7.1 | Strip `opencode.json` → only `qmd`, `smart-connections`, `exa`. Remove `github`, `linear` (additional MCP integrations deferred). Keep `better-auth` entry ONLY if the Better Auth sidecar needs it — otherwise remove (Better Auth in MVP is a local sidecar, not an MCP). | S | — | review | TIN-66 · PR #26. |
| 7.2 | Ensure `exa` works zero-config: it's remote, no env needed. Add boot-time check that calls exa's health MCP. | S | 7.1 | not started | Verify. |
| 7.3 | `qmd` env wiring: `SMART_VAULT_PATH` = `<memory_root>/<current-user-id>/` from M6.3. Passed to OpenCode at sidecar spawn. | S | 7.1, 6.3 | not started | Env var injection at spawn. |
| 7.4 | `smart-connections` env wiring: `SMART_VAULT_PATH` = same per-user subdir from M6.3. Same spawn-time injection as 7.3. | S | 7.1, 6.3 | not started | Mirror of 7.3. |
| 7.5 | Settings pane: "Integrations" section lists 3 MCPs with status (connected/error). Calls OpenCode SDK `mcp.list()` on mount. | M | 7.1, 6.5 | not started | Status only, no config. |
| 7.6 | Per-MCP retry button in Settings: calls `mcp.reconnect(name)` SDK method (or restarts sidecar if SDK doesn't expose). | S | 7.5 | not started | Recovery. |
| 7.7 | Memory-root change OR user-switch triggers MCP refresh: stop OpenCode → respawn with new env → MCPs reconnect. Triggered by 6.9 (path change) and 8.8 (sign-out/in). | M | 7.3, 7.4, 6.6, 8.8 | not started | Invalidation path. |
| 7.8 | First-run verification: on new session launch, wait for all 3 MCPs to report `connected` before enabling the composer. Show `<ConnectionGate>` minimal variant during wait (3-5s typical). | M | 7.5 | not started | Quality bar. |

### M8 — Identity (Better Auth) + per-user chat-history persistence
Spec: [[28-mvp-identity]] · Depends on: existing `packages/auth-sidecar` scaffold (present) · D2 / D4 / D5

| ID | Task | Size | Depends on | Status | Notes |
|----|------|------|------------|--------|-------|
| 8.1 | **Research**: confirm Better Auth v1 config shape for Google + GitHub + Microsoft providers on a Tauri desktop app — loopback redirect URI format, PKCE flow, session/refresh-token handoff. Deliverable: `agent-knowledge/reference/better-auth-config.md` with exact config snippets + redirect URI registrations per provider. | M | — | review | TIN-74 · PR #23. Blocks 8.2–8.4. |
| 8.2 | Add `User` type in `@tinker/shared-types`: `{ id, provider, providerUserId, displayName, avatarUrl?: string, email?: string, createdAt, lastSeenAt }`. | S | — | review | TIN-75 · PR #27 · `khvni/feat/m8/tin-75-user-type`. |
| 8.3 | SQLite `users` table in `@tinker/memory/database.ts` (columns mirror `User` type, unique composite index on `(provider, provider_user_id)`). CRUD helpers in new `packages/memory/src/user-store.ts`. | M | 8.2 | not started | Seeds on every successful sign-in (upsert). |
| 8.4 | `@tinker/auth-sidecar` wire Google provider per 8.1: provider config, loopback URI, PKCE flow, callback handler. Sidecar exposes HTTP endpoints `POST /auth/start`, `GET /auth/callback`, `POST /auth/logout`, `GET /auth/session`. | M | 8.1 | not started | Extend existing `packages/auth-sidecar/src/main.ts`. |
| 8.5 | `@tinker/auth-sidecar` wire GitHub provider per 8.1. | S | 8.4 | not started | Config-only once 8.4 lands. |
| 8.6 | `@tinker/auth-sidecar` wire Microsoft (consumer) provider per 8.1. | S | 8.4 | not started | Consumer/personal only. No tenant federation. |
| 8.7 | Rust Tauri command `start_auth_sidecar() -> Result<AuthHandle, Error>` spawns the auth sidecar + returns base URL. Rust binds OS-level loopback redirect URIs needed by the sidecar (Google, GitHub, Microsoft). | M | 8.4 | not started | Mirrors OpenCode sidecar lifecycle (coordinator pattern D22). |
| 8.8 | Rust keychain bridge: Tauri commands `save_refresh_token(provider, user_id, token)`, `load_refresh_token(provider, user_id) -> Option<String>`, `clear_refresh_token(provider, user_id)` via `tauri-plugin-keyring`. | M | — | not started | D5: only keychain stores bearer creds. |
| 8.9 | Sign-in UX: first-run screen shows three buttons (Google / GitHub / Microsoft). Click → renderer calls `auth/start` → opens system browser to provider → redirect comes back to loopback → renderer polls `auth/session` until `authenticated: true` → upserts `users` row → navigates to folder picker. | L | 8.4, 8.5, 8.6, 8.7, 8.3 | not started | Subdivide if >500 LOC: split into (a) provider-picker screen, (b) in-flight "waiting for browser…" screen, (c) session-poll hook. |
| 8.10 | Current-user context: renderer `useCurrentUser()` hook reads session + hydrates from `users` table. App boot blocks on this until resolved or unauthenticated. | M | 8.9 | not started | Single source of truth for `user_id` everywhere. |
| 8.11 | Settings pane: "Account" section shows current user's name + avatar + provider + `<Button>Sign out</Button>`. Sign-out clears keychain + returns to sign-in screen. | M | 8.10 | not started | Routes through `clear_refresh_token` + resets `useCurrentUser` state. |
| 8.12 | Auto-sign-in on cold launch: Rust checks keychain for any refresh token → if found, Better Auth sidecar validates → `useCurrentUser` resolves without showing sign-in screen. If invalid, fall through to sign-in. | M | 8.8, 8.10 | not started | Silent sign-in. |
| 8.13 | Per-user memory subdir creation: on successful sign-in, ensure `<memory_root>/<user-id>/` exists. On user-switch, re-resolve. Triggers M6.9. | S | 8.3, 6.3 | not started | One-liner wired to 8.10's sign-in callback. |
| 8.14 | Chat-history JSONL file format doc: one line per OpenCode SSE event, `{ ts, event, data }`. Deliverable: short `agent-knowledge/reference/chat-history-format.md`. | S | — | review (TIN-87, PR pending) | Schema reference for M2.11 + M2.12. |
| 8.15 | Integration test: sign in as User A → pick folder F → send message → sign out → sign in as User B → folder F session NOT visible in switcher → User B picks folder F → new JSONL created under `.tinker/chats/<user-b-id>/`. Doc result in `docs/mvp-verification.md`. | S | 8.11, 2.7, 2.11 | not started | End-to-end identity-scoping proof. |

### Cross-cutting (small stuff that any task can inherit)

| ID | Task | Size | Depends on | Status | Notes |
|----|------|------|------------|--------|-------|
| X.1 | Repo-wide: add `.cursor/rules` or `.github/copilot-instructions.md` pointing async agents at this file + D25 + claim rules. | S | — | review | TIN-89 · PR #28. Agent-onramp. Both `.github/copilot-instructions.md` + `.cursor/rules/tinker.mdc` landed. |
| X.2 | CI gate: `pnpm -r typecheck && pnpm -r test` in GitHub Actions. Block merge on fail. | S | — | not started | Table stakes. |
| X.3 | `pnpm tauri dev` smoke test: app launches → first-run picker → folder → workspace → one chat round-trip. Document in `docs/development.md`. | S | M2 done, M4.2 done | not started | Manual verification checklist. |

### MVP Acceptance Checklist (merge to `main` → tag `v0.1.0`)

- [ ] All M1-M8 rows status = `done`.
- [ ] `pnpm -r typecheck` green.
- [ ] `pnpm -r test` green (including `@tinker/panes` 69+ tests).
- [ ] `pnpm tauri dev` opens sign-in → pick provider → OAuth → folder picker → workspace → sends message → receives markdown-rendered reply.
- [ ] Silent sign-in works on relaunch (no re-auth if refresh token valid in keychain).
- [ ] Sign-out + sign-in as different provider shows a different set of sessions and memory subdir.
- [ ] Context badge updates during streaming.
- [ ] Opening a `.pdf`, `.xlsx`, `.md`, `.html`, `.docx` via chat link works.
- [ ] Memory root default created + changeable via Settings; per-user subdir visible.
- [ ] All 3 MCP servers report connected on cold start.
- [ ] Chat history JSONL exists under `<folder>/.tinker/chats/<user-id>/` after first message; reopening the session hydrates prior messages from the file.
- [ ] Refresh tokens found only in OS keychain (not in SQLite, not in files).
- [ ] No `dockview-react` import anywhere in repo.

---

## Post-MVP (deferred per [[decisions]] D25)

Scope preserved for historical context + roadmap signaling. **Do not work on these until MVP ships.**

| # | Feature | Spec | Deferred reason |
|---|---------|------|------------------|
| 01 | SSO connector layer — enterprise SSO only (SAML / SCIM / tenant federation) | [[01-sso-connector-layer]] | Consumer OAuth (Google / GitHub / Microsoft) IS in MVP per [[28-mvp-identity]]. Enterprise SSO stays enterprise-fork only per D1 / D8. |
| 02 | Playbook skill marketplace | [[02-playbook-skill-marketplace]] | No skills system in MVP. Markdown + MCP covers the same use cases at lower complexity. |
| 03 | Self-building memory pipeline (entity extraction) | [[03-memory-pipeline]] | MVP memory = flat markdown files. Entity graph is premature without validated retrieval need. |
| 04 | Native scheduler | [[04-native-scheduler]] | No scheduled execution in MVP. |
| 05 | Coach skill discovery | [[05-coach-skill-discovery]] | Depends on Playbook. |
| 06 | Sub-agent orchestration | [[06-subagent-orchestration]] | MVP = single agent per session. |
| 07 | Workspace persistence + split-pane UI | [[07-workspace-persistence]] | Merged into M1 (scaled-down: single-pane default). Split support preserved in `@tinker/panes` but default layout is single Chat. |
| 08 | MCP proxy layer | [[08-mcp-proxy-layer]] | Cold-start-time optimization. MVP uses direct MCP spawn. |
| 09 | Design system enforcement | [[09-design-system]] | **Done** — continues as hygiene, no active work. |
| 10 | `@tinker/panes` workspace layout | [[10-tinker-panes]] | MVP scope folded into M1 (registration + Dockview retirement). |
| 11 | Device ↔ host-service split | [[11-host-service]] | Premature abstraction for single-user MVP. Revisit when headless mode becomes real scope. |
| 12 | Workspace attention coordinator | [[12-attention-coordinator]] | Multi-pane UX polish. MVP = one pane. |
| 13 | Vertical workspace sidebar | [[13-workspace-sidebar]] | Depends on multi-workspace UX which MVP doesn't have. |
| 14 | Session history windowing | [[14-session-history-windowing]] | Perf feature. Revisit at >1000 messages/session. |
| 15 | Connection gate (full splash + retry) | [[15-connection-gate]] | Minimal variant in M7.8 covers MVP. |

## Rejected (not coming back)

| Task | Reason |
|------|--------|
| Latent Briefing / KV cache compaction | D1, D2 — requires self-hosted model; violates OpenCode-owns-model principle. |
| Cloud sync | D18 — local-first overrides. |
| Enterprise SSO (Okta/SAML/SCIM) | D1 / D8 — enterprise-fork path only. |
| Multi-provider model support | Handled by OpenCode, not Tinker. |
| Slack-native presence | Slack as MCP only. |

## MVP (D25) — atomic tasks tracked here until D25 docs merge to main

> Canonical MVP matrix lives on the `claude/bold-panini` branch (commits `817581a` + `a648742`). Feature branches are landing against main ahead of that merge; track status here until the D25 refocus lands.

### M2 — Folder-scoped session

| Task | Linear | Priority | Status | PR | Notes |
|------|--------|----------|--------|----|-------|
| M2.3 Tauri command `open_folder_picker` | TIN-17 | p1 | review | #19 | `apps/desktop/src-tauri/src/commands/dialog.rs`, typed wrapper in `apps/desktop/src/bindings.ts` |
| M2.5 Tauri command `stop_opencode` | TIN-19 | p1 | review | #25 | SIGTERM → 2s grace → SIGKILL → manifest removed. Idempotent; rejects `pid == 0`. Legacy lib.rs helper renamed to `terminate_legacy_opencode`. |

## How to Update This File

- **Claiming MVP task** → set status `claimed`, add `[<agent-id> · ETA YYYY-MM-DD]` in Notes. Commit.
- **Starting work** → status `in progress`.
- **PR open** → status `review` + link PR in Notes.
- **Merged** → status `done`. Do not delete the row.
- **Splitting a task** → replace the row with N sub-rows (same pillar prefix, suffix `.a` / `.b` / etc). Note the split reason.
- **Blocking** → status `blocked`, describe blocker in Notes. If it's a decision, add to `product/decisions.md` Open Questions.
- **Post-MVP work** → do not start. If you think something post-MVP is MVP-critical, reopen D25 in a PR before writing code.
