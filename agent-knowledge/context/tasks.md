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

Seven pillars. Atomic tasks per pillar. Pillars are the TOP-LEVEL goals from [[decisions]] D25.

### M1 — Panes+tabs workspace (cohesive layout)
Spec: [[20-mvp-panes-workspace]] · Depends on: `@tinker/panes` (done) · D16

| ID | Task | Size | Depends on | Status | Notes |
|----|------|------|------------|--------|-------|
| 1.1 | Define `TinkerPaneKind` union in `@tinker/shared-types`: `'chat' \| 'file' \| 'settings' \| 'memory'`. Typed `TinkerPaneData` discriminated union. | S | — | not started | Replaces scattered pane-kind literals. |
| 1.2 | Create `workspace/pane-registry.ts` implementing `PaneRegistry<TinkerPaneKind>`. Export `registerPane(kind, render)` + `getRenderer(kind)`. | S | 1.1 | not started | Replaces Dockview registry. |
| 1.3 | Register `{ kind: 'chat' }` → existing `<Chat>` component. No Chat-component internals change. | S | 1.2 | not started | Pure registration. |
| 1.4 | Register `{ kind: 'file', data: { path, mime } }` → single dispatch component that reads `mime` and picks renderer. | S | 1.2 | not started | Unifies 6 file-renderer panes. |
| 1.5 | Register `{ kind: 'settings' }` + `{ kind: 'memory' }` placeholders (render empty `<EmptyPane/>` until filled by M5/M6). | S | 1.2 | not started | Clears registry surface. |
| 1.6 | Rewrite `layout.default.ts` → returns `WorkspaceState<TinkerPaneData>` with a single Chat pane. No split, no secondary pane. | S | 1.3 | not started | MVP default = just Chat. |
| 1.7 | Swap `Workspace.tsx` internals: replace `<DockviewReact>` with `<Workspace>` from `@tinker/panes/react`. Read + write `WorkspaceState` via `@tinker/memory/layout-store` (already exists). | M | 1.3, 1.4, 1.5, 1.6 | not started | Dockview gone from the render tree. |
| 1.8 | Delete `workspace/DockviewContext.ts`, `workspace/chat-panels.ts` + callers. Delete Dockview CSS imports. | S | 1.7 | not started | Quarantine cleanup. |
| 1.9 | Remove `dockview-react` from `apps/desktop/package.json`. Run `pnpm install`. Verify `pnpm typecheck` passes. | S | 1.8 | not started | Kills the dep. |
| 1.10 | Layout snapshot migration: detect old Dockview-shaped JSON in SQLite `layouts` table → delete + re-seed default. Log once. | S | 1.9 | not started | One-shot. Acceptable data loss on upgrade (pre-v1). |

### M2 — Folder-scoped session (every chat starts in a local directory)
Spec: [[21-mvp-session-folder]] · Depends on: M1.7 · Independent of Better Auth (deferred).

| ID | Task | Size | Depends on | Status | Notes |
|----|------|------|------------|--------|-------|
| 2.1 | Add `Session` type in `@tinker/shared-types`: `{ id, folderPath, createdAt, lastActiveAt, modelId?: string }`. | S | — | not started | Shared types only. |
| 2.2 | SQLite `sessions` table + migrations in `@tinker/memory/database.ts`. CRUD helpers in new `packages/memory/src/session-store.ts`. | M | 2.1 | not started | Mirrors existing `scheduler-store` shape. |
| 2.3 | Rust Tauri command `open_folder_picker() -> Result<String, Error>` using `tauri-plugin-dialog`. | S | — | not started | Shell to OS picker. |
| 2.4 | Rust Tauri command `start_opencode(folder_path: String) -> Result<OpencodeHandle, Error>` that spawns `opencode serve --cwd <folder_path>`. Health-poll until ready. Returns `{ baseUrl, pid }`. | M | — | not started | Extends existing sidecar lifecycle. No mutate-then-call per D22. |
| 2.5 | Rust Tauri command `stop_opencode(pid: u32)` for session close. | S | 2.4 | not started | Clean shutdown. |
| 2.6 | First-run screen: full-window "Pick a folder to start" → `<Button>Choose folder…</Button>` → folder picker → creates session → navigates into workspace. | M | 2.2, 2.3, 2.4 | not started | Replaces existing FirstRun.tsx. Lives in `routes/first-run.tsx`. |
| 2.7 | Session restore: on app launch, list sessions from SQLite ordered by `lastActiveAt`. If ≥1, show session switcher; if 0, show first-run. | M | 2.2 | not started | Simple list UI using `@tinker/design`. |
| 2.8 | "New session" button in session switcher → folder picker → spawn OpenCode → open new Chat pane tab. | S | 2.6 | not started | Same code path as first-run. |
| 2.9 | Active session indicator in workspace titlebar: shows folder basename + monospace short path. | S | 2.7 | not started | Purely cosmetic surface. |
| 2.10 | On app quit, stop all running OpenCode instances (best-effort; survive kill -9 via manifest). | S | 2.5 | not started | Per D22 coordinator pattern. |

### M3 — In-line document renderer
Spec: [[22-mvp-inline-renderer]] · Depends on: M1.4 (file pane registration)

| ID | Task | Size | Depends on | Status | Notes |
|----|------|------|------------|--------|-------|
| 3.1 | **Research**: pick libraries for pdf / xlsx / docx / pptx / html / code / markdown. Deliverable: `agent-knowledge/reference/inline-renderers.md` with lib name + license + bundle size + rationale per format. Criterion: no paid libs, no copyleft licenses (MIT/Apache/ISC/BSD only). | M | — | not started | Research-as-task. Blocks 3.3–3.9. |
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
| 4.1 | **Research**: clone/browse OpenCode Desktop (sst/opencode) model-picker UI. Document open/close behavior, keyboard nav, filter semantics, grouping (provider/model/context-window display). Deliverable: `agent-knowledge/reference/opencode-desktop-model-picker.md`. | M | — | not started | Research-as-task. Blocks 4.7–4.10. |
| 4.2 | Chat message list renders markdown via `react-markdown` + `remark-gfm` + `rehype-shiki` (match existing code-highlighter choice). Covers: headings, bold/italic, lists, tables, blockquotes, inline code, fenced code, links. | M | 1.3 | not started | Core chat requirement. |
| 4.3 | Code block renderer: uses existing `code-highlighter.ts`. Copy button per block. Language label. | S | 4.2 | not started | Reuses code. |
| 4.4 | Streaming render: SSE chunks → incremental markdown parse. Debounce re-render to 60fps max (requestAnimationFrame). No full re-parse per chunk. | M | 4.2 | not started | Perf-sensitive. |
| 4.5 | Tool-call blocks: parse OpenCode event stream for `tool.use` events. Render as collapsed `▸ used <tool-name>` disclosure. Expands on click. Hidden by default. | M | 4.2 | not started | Matches OpenCode Desktop behavior. |
| 4.6 | Thinking/reasoning blocks: same disclosure pattern. Hidden by default. Keyboard shortcut `⌥T` toggles all. | S | 4.5 | not started | Parity feature. |
| 4.7 | `<ModelPicker>` primitive in `@tinker/design` per 4.1 findings. Dropdown + search input + keyboard nav + provider/model/context-window rows. | L | 4.1 | not started | Subdivide if >500 LOC: split into `ModelPickerTrigger` + `ModelPickerPanel`. |
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
| 5.1 | **Research**: locate OpenCode SDK field for per-session token usage + model context window. Deliverable: 1-page `agent-knowledge/reference/opencode-sdk-usage.md` with exact field paths + example payload. | S | — | not started | Research-as-task. |
| 5.2 | `<ContextBadge percent={n} tokens={used} windowSize={max} model={name} />` primitive in `@tinker/design`. Pill w/ percent. Color: green <50%, amber 50–80%, red >80%. Tooltip w/ exact counts. | M | 5.1 | not started | Pure visual. |
| 5.3 | Wire badge into Chat pane header. Subscribes to same SSE stream as chat; recomputes on each message. | S | 5.2, 4.4 | not started | One call site. |
| 5.4 | Playground entry in `routes/design-system.tsx` with three states (low/mid/high). Per D14 canonical rule. | S | 5.2 | not started | Design-system hygiene. |

### M6 — Memory as desktop-native filesystem
Spec: [[26-mvp-memory-filesystem]] · Depends on: M1.5

| ID | Task | Size | Depends on | Status | Notes |
|----|------|------|------------|--------|-------|
| 6.1 | Add `app_settings` SQLite table (key/value JSON) in `@tinker/memory/database.ts`. CRUD helpers in new `packages/memory/src/settings-store.ts`. | S | — | not started | Shared config surface. |
| 6.2 | Default memory path resolver (TS): macOS `~/Library/Application Support/Tinker/memory`, Linux `~/.local/share/tinker/memory`, Windows `%APPDATA%\Tinker\memory`. Create dir if missing via Tauri fs plugin. | S | — | not started | Platform paths. |
| 6.3 | On first run: seed `app_settings.memory_path` with resolved default. Subsequent reads go through setting. | S | 6.1, 6.2 | not started | Init hook. |
| 6.4 | Memory pane (register in M1.5): list `.md` files in memory folder. Click → opens as FilePane tab w/ Markdown renderer (3.9). | M | 6.3, 3.9 | not started | Reuses renderer. |
| 6.5 | Settings pane: "Memory folder" row with current path + `<Button>Change location…</Button>`. Opens Tauri folder picker → validates writable → updates setting. | M | 6.3 | not started | Single setting surface for MVP. |
| 6.6 | On memory-path change: move folder contents to new location via Tauri fs plugin. Show `<Progress>` modal. On completion, reload memory pane + emit path-changed event. | M | 6.5 | not started | Filesystem move. |
| 6.7 | Simple memory injection (MVP): before `session.prompt()`, read up to N most recent `.md` files (default N=5) from memory folder, prepend as `noReply` system context. Existing `bridge/memory-injector.ts` scaffold extended. | M | 6.3, 4.2 | not started | MVP = recency-only. No semantic ranking. |
| 6.8 | Simple memory append (MVP, toggleable): after assistant response finishes streaming, write `memory/sessions/YYYY-MM-DD-HHMM-<session-id>.md` with the user prompt + final assistant message. Setting `app_settings.memory_auto_append` default `true`. | M | 6.3, 4.4 | not started | Append-only. No summarization yet. |
| 6.9 | Path-change-propagation: 6.6 triggers 6.7/6.8 to re-resolve path + triggers M7.7 (MCP env var refresh). | S | 6.6, 6.7, 6.8, 7.7 | not started | Cross-pillar hook. |

### M7 — Built-in MCP servers (qmd, smart-connections, exa)
Spec: [[27-mvp-builtin-mcp]] · Depends on: M6.3 (memory path resolved)

| ID | Task | Size | Depends on | Status | Notes |
|----|------|------|------------|--------|-------|
| 7.1 | Strip `opencode.json` → only `qmd`, `smart-connections`, `exa`. Remove `github`, `linear`, `better-auth` (auth-gated / deferred). | S | — | not started | File edit. |
| 7.2 | Ensure `exa` works zero-config: it's remote, no env needed. Add boot-time check that calls exa's health MCP. | S | 7.1 | not started | Verify. |
| 7.3 | `qmd` env wiring: `SMART_VAULT_PATH` (qmd reuses it) = memory path from M6.3. Passed to OpenCode at sidecar spawn. | S | 7.1, 6.3 | not started | Env var injection at spawn. |
| 7.4 | `smart-connections` env wiring: `SMART_VAULT_PATH` = memory path from M6.3. Same spawn-time injection as 7.3. | S | 7.1, 6.3 | not started | Mirror of 7.3. |
| 7.5 | Settings pane: "Integrations" section lists 3 MCPs with status (connected/error). Calls OpenCode SDK `mcp.list()` on mount. | M | 7.1, 6.5 | not started | Status only, no config. |
| 7.6 | Per-MCP retry button in Settings: calls `mcp.reconnect(name)` SDK method (or restarts sidecar if SDK doesn't expose). | S | 7.5 | not started | Recovery. |
| 7.7 | Memory-path change triggers MCP refresh: stop OpenCode → respawn with new env → MCPs reconnect. Triggered by 6.9. | M | 7.3, 7.4, 6.6 | not started | Invalidation path. |
| 7.8 | First-run verification: on new session launch, wait for all 3 MCPs to report `connected` before enabling the composer. Show `<ConnectionGate>` minimal variant during wait (3-5s typical). | M | 7.5 | not started | Quality bar. |

### Cross-cutting (small stuff that any task can inherit)

| ID | Task | Size | Depends on | Status | Notes |
|----|------|------|------------|--------|-------|
| X.1 | Repo-wide: add `.cursor/rules` or `.github/copilot-instructions.md` pointing async agents at this file + D25 + claim rules. | S | — | not started | Agent-onramp. |
| X.2 | CI gate: `pnpm -r typecheck && pnpm -r test` in GitHub Actions. Block merge on fail. | S | — | not started | Table stakes. |
| X.3 | `pnpm tauri dev` smoke test: app launches → first-run picker → folder → workspace → one chat round-trip. Document in `docs/development.md`. | S | M2 done, M4.2 done | not started | Manual verification checklist. |

### MVP Acceptance Checklist (merge to `main` → tag `v0.1.0`)

- [ ] All M1-M7 rows status = `done`.
- [ ] `pnpm -r typecheck` green.
- [ ] `pnpm -r test` green (including `@tinker/panes` 69+ tests).
- [ ] `pnpm tauri dev` opens first-run → folder picker → workspace → sends message → receives markdown-rendered reply.
- [ ] Context badge updates during streaming.
- [ ] Opening a `.pdf`, `.xlsx`, `.md`, `.html`, `.docx` via chat link works.
- [ ] Memory folder default created + changeable via Settings.
- [ ] All 3 MCP servers report connected on cold start.
- [ ] No `dockview-react` import anywhere in repo.
- [ ] No Better Auth runtime code in `App.tsx` boot path.

---

## Post-MVP (deferred per [[decisions]] D25)

Scope preserved for historical context + roadmap signaling. **Do not work on these until MVP ships.**

| # | Feature | Spec | Deferred reason |
|---|---------|------|------------------|
| 01 | SSO connector layer (Google/GitHub/Microsoft via Better Auth) | [[01-sso-connector-layer]] | MVP = anonymous folder sessions. Identity layer adds auth ceremony before product value is demonstrated. |
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

## How to Update This File

- **Claiming MVP task** → set status `claimed`, add `[<agent-id> · ETA YYYY-MM-DD]` in Notes. Commit.
- **Starting work** → status `in progress`.
- **PR open** → status `review` + link PR in Notes.
- **Merged** → status `done`. Do not delete the row.
- **Splitting a task** → replace the row with N sub-rows (same pillar prefix, suffix `.a` / `.b` / etc). Note the split reason.
- **Blocking** → status `blocked`, describe blocker in Notes. If it's a decision, add to `product/decisions.md` Open Questions.
- **Post-MVP work** → do not start. If you think something post-MVP is MVP-critical, reopen D25 in a PR before writing code.
