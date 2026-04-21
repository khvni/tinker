# Tinker — Product Requirements Document

> Mission: build a local-first AI workspace with a thin Tauri shell, OpenCode as the agent backend, a user-owned memory folder, and a chat interface that renders markdown natively.

> Audience: coding agents working in this repo. Read this before changing architecture.

> **[2026-04-21] MVP refocus per [[decisions]] D25.** Scope cut to seven pillars. Prior feature breadth deferred to post-MVP. Pillars are specified in §2; everything else is background architecture or post-MVP roadmap.

---

## 0. Guiding Principles

1. **Make complexity invisible, not absent.** Power is available without forcing setup knowledge into the first-run path.
2. **Local-first, user-owned.** Folder sessions, the memory directory, and the app database stay on the user's machine.
3. **The product teaches by doing.** The first useful interaction happens in the product itself — not in docs.
4. **One thing, perfectly.** Ship the seven pillars at production quality before any eighth feature is considered.

---

## 1. Product Summary

Tinker is a desktop AI workspace. The shell is Tauri v2, the UI is React 19 + `@tinker/panes` (recursive split tree + tabs; supersedes Dockview per D16), and OpenCode runs as a localhost sidecar scoped to a user-picked folder.

Every chat session begins by pointing Tinker at a local folder. OpenCode runs inside that folder. Chat replies are rendered as native markdown. Files referenced in chat open inline (PDF, XLSX, DOCX, PPTX, HTML, code, markdown). A desktop-native memory folder holds cross-session context. Three auth-free MCP servers (qmd, smart-connections, exa) ship pre-wired.

The app is not a cloud dashboard. It is a local workspace that happens to talk to a model scoped to the folder you're working in.

---

## 2. MVP — the seven pillars (v0.1)

Each pillar has a dedicated feature spec in `agent-knowledge/features/` and a task breakdown in `agent-knowledge/context/tasks.md`. Agents implementing the MVP should work from tasks.md.

### 2.1 Panes + tabs workspace (M1)
- `@tinker/panes` is the only layout engine. No `dockview-react` imports.
- Default MVP layout = single Chat pane. Split and multi-tab remain supported by `@tinker/panes` but are not exercised by the default layout.
- Pane kinds in MVP: `chat`, `file`, `settings`, `memory`. Each registered in a typed `PaneRegistry<TinkerPaneKind>`.
- Spec: [[20-mvp-panes-workspace]]

### 2.2 Folder-scoped session (M2)
- A session is `{ id, folderPath, createdAt, lastActiveAt, modelId? }`. Stored in SQLite.
- First run opens a folder picker; picked folder becomes the session's OpenCode `cwd`.
- "New session" always begins with a folder pick. No global OpenCode instance — one sidecar per active session.
- Session switcher lists recent sessions on launch.
- No sign-in, no account, no identity in MVP. Anonymous + local.
- Spec: [[21-mvp-session-folder]]

### 2.3 In-line document renderer (M3)
- Click a file link in chat → opens a FilePane tab in the same workspace.
- Supported formats in MVP: PDF, XLSX, DOCX, PPTX, HTML, source code, markdown. Library selection is a research task (see tasks.md M3.1).
- Unsupported formats fall through to "open externally" via Tauri shell.open.
- Spec: [[22-mvp-inline-renderer]]

### 2.4 Chat interface with markdown rendering + model picker (M4)
- OpenCode streams responses as SSE → chat pane renders them as markdown (GFM: headings, bold/italic, lists, tables, code fences, inline code, links, blockquotes).
- Code blocks syntax-highlighted via the existing `code-highlighter` module.
- Tool calls and thinking/reasoning hidden by default, expandable via disclosure.
- Model picker matches OpenCode Desktop behavior 1:1 (research task M4.1). Lists `session.models()`; groups by provider; shows context-window size; keyboard-navigable; fuzzy filter.
- Composer: multi-line textarea, Enter submits, Shift+Enter newline, Escape aborts, Stop button while streaming.
- Per-session model selection persists in SQLite.
- Specs: [[23-mvp-chat-markdown]], [[24-mvp-model-picker]]

### 2.5 Context usage badge (M5)
- Pill in Chat pane header showing `<percent>%` of context window consumed.
- Color: green <50%, amber 50–80%, red >80%.
- Tooltip with exact token count + context-window size + model name.
- Sources truth from OpenCode SDK (field path documented in M5.1 research task).
- Spec: [[25-mvp-context-badge]]

### 2.6 Desktop-native memory filesystem (M6)
- Memory lives in a desktop-global folder, NOT inside any session folder.
- Default location: platform-appropriate app data dir (macOS `~/Library/Application Support/Tinker/memory`, Linux `~/.local/share/tinker/memory`, Windows `%APPDATA%\Tinker\memory`).
- User can relocate the folder via Settings → Memory. The app moves existing contents + refreshes all references (including MCP env vars).
- MVP injection: top-N most recent `.md` files (default N=5) prepended to each prompt as `noReply` context.
- MVP capture: on assistant response completion, append prompt + final reply to `memory/sessions/YYYY-MM-DD-HHMM-<session-id>.md`. Toggle in Settings.
- No entity extraction, no FTS, no semantic ranking in MVP. Pure filesystem.
- Spec: [[26-mvp-memory-filesystem]]

### 2.7 Built-in MCP servers: qmd, smart-connections, exa (M7)
- Pre-wired in `opencode.json`. No user config, no API keys.
- `qmd` + `smart-connections`: env var `SMART_VAULT_PATH` points at memory folder from M6.
- `exa`: remote MCP, no auth.
- Settings pane shows connected/error status for each.
- Memory-folder change (2.6) triggers MCP env refresh + OpenCode respawn.
- Spec: [[27-mvp-builtin-mcp]]

---

## 3. Architecture

```text
Device — Tauri v2 Window
  ├─ React renderer
  │   ├─ @tinker/panes workspace (tabs + recursive split tree)
  │   ├─ @tinker/design primitives + tokens (dual-theme, D23)
  │   └─ Chat pane talks OpenCode direct via @opencode-ai/sdk (HTTP + SSE)
  └─ Rust core (apps/desktop/src-tauri)
      ├─ opens folder picker (2.2)
      ├─ spawns + health-checks OpenCode per session (2.2)
      ├─ keychain + Tauri fs + dialog plugins
      └─ OS primitives only — no business logic

OpenCode sidecar (one per active session)
  ├─ spawned with --cwd <session.folderPath>
  ├─ model + provider auth (OpenCode-owned)
  ├─ tools + MCP servers (pre-wired from opencode.json)
  └─ streams SSE events back to the webview

Local storage
  ├─ SQLite (app database) — sessions, app_settings, layouts
  ├─ Memory folder (user-configurable, desktop-global) — flat .md files
  └─ Session folder (per-session, chosen by user) — user's own working files
```

### MVP runtime flows

**First launch**

1. Tauri starts. Renderer loads.
2. Renderer queries SQLite → 0 sessions exist.
3. First-run screen: "Pick a folder to start chatting".
4. User picks a folder. Tauri spawns `opencode serve --cwd <folder>`.
5. Tauri health-polls the sidecar. When ready, renderer opens workspace with a single Chat pane bound to the new session.
6. Memory folder default is created if missing. MCP servers boot with `SMART_VAULT_PATH` = memory folder.

**Subsequent launch**

1. SQLite has ≥1 session. Session switcher appears listing recent sessions.
2. User picks a session → Tauri respawns OpenCode for that folder → workspace opens.
3. OR user picks "New session" → folder picker → new session row → new sidecar.

**Sending a message**

1. Renderer reads top-N recent memory files (M6.7) → sends as `noReply` system context.
2. Renderer sends user prompt via `session.prompt()`.
3. SSE events stream back → markdown rendered incrementally in Chat pane.
4. Context badge recomputes on each chunk.
5. Tool calls + thinking blocks render collapsed by default.
6. On stream completion: if auto-append enabled (M6.8), memory file appended.

**Opening a file from chat**

1. User clicks a file-path link in an assistant message.
2. Renderer opens a new FilePane tab with `{ path, mime }`.
3. FilePane dispatches to the correct renderer (PDF / XLSX / DOCX / PPTX / HTML / code / markdown).
4. Unsupported MIME → fallback "open externally" button using Tauri shell.open.

**Changing memory folder**

1. Settings → Memory → Change location.
2. Tauri folder picker → validates writable.
3. Progress modal shown while contents move.
4. On completion: `app_settings.memory_path` updated → OpenCode respawned with new env → MCPs reconnect → Memory pane refreshes.

---

## 4. Repo Layout (MVP-relevant)

```text
tinker/
  apps/
    desktop/                 # Device (Tauri shell)
      src/
        bindings.ts
        renderer/
          App.tsx
          routes/            # first-run, workspace, design-system playground, panes-demo
          panes/             # Chat (MVP); Today/Scheduler/Playbook/VaultBrowser retired per M3.11
          renderers/         # File renderers per M3 (PDF/XLSX/DOCX/PPTX/HTML/Code/Markdown)
          components/
          workspace/         # pane-registry.ts (replaces DockviewContext); Workspace.tsx
      src-tauri/             # Rust coordinator: spawn OpenCode per session, folder picker, dialogs
  packages/
    panes/                   # recursive split-tree workspace (sole layout engine, D16)
    design/                  # tokens + primitives + ModelPicker + ContextBadge
    memory/                  # SQLite (sessions, app_settings, layouts) + memory folder helpers
    bridge/                  # OpenCode stream shaping + simple memory injection (MVP)
    shared-types/            # TinkerPaneKind, Session, WorkspaceState<TData>
  opencode.json              # qmd + smart-connections + exa only (M7)
  tinker-prd.md              # this file
  agent-knowledge/
    context/tasks.md         # MVP atomic task table
    product/decisions.md     # D25 = MVP refocus; D1–D24 retained
    features/                # 20-27-mvp-*.md live here; 01-15 kept as deferred
```

### Deferred packages (present in tree, NOT wired to MVP UI)

- `packages/scheduler` — post-MVP (D25).
- `packages/attention` — post-MVP.
- `packages/auth-sidecar` — post-MVP (identity deferred).
- Post-MVP-planned: `packages/host-service`, `packages/host-client`, `packages/workspace-sidebar`, `packages/coach`.

These stay in-tree but must not be imported by `App.tsx`, `Workspace.tsx`, or any MVP route. Rewiring them is a post-MVP task.

---

## 5. Quality Bars (MVP)

- `pnpm tauri dev` launches to first-run without crashing.
- First-run folder picker creates a session and opens Chat.
- Chat renders markdown (GFM) natively. No plaintext with raw `**` or `#`.
- Code blocks are syntax-highlighted.
- Tool calls + thinking hidden by default.
- Model picker lists OpenCode-configured providers + keyboard-nav works.
- Context badge updates during streaming.
- Any of {PDF, XLSX, DOCX, PPTX, HTML, code, markdown} file reference clicked from chat opens inline.
- Memory folder default exists + user can relocate it via Settings.
- qmd + smart-connections + exa all report connected on cold start.
- Layout state restores across relaunches.
- No `dockview-react` import in repo.
- Per-renderer CSS uses `@tinker/design` tokens only (D14/D15/D23).
- TypeScript strict — no `any`, no `@ts-ignore`.

---

## 6. Non-goals (MVP)

- Identity / sign-in / OAuth. Sessions are anonymous and folder-scoped.
- Enterprise SSO (SAML, SCIM, Okta, Entra). Enterprise path via fork only (D1/D8).
- Cloud sync, device-to-device (D18).
- Mobile / headless / remote dispatch.
- Multi-provider model support — OpenCode owns provider selection.
- Scheduled prompts (scheduler package stays in tree but unused).
- Skill marketplace (Playbook) + skill discovery (Coach). Post-MVP.
- Entity extraction, FTS, semantic memory ranking. MVP memory = flat markdown + recency injection.
- Sub-agent orchestration. MVP = one agent per session.
- Workspace sidebar / multi-workspace UX. MVP = single active session surface.
- Attention coordinator (unread rings, focus flashes). MVP = one pane.
- Host-service split (D17). Post-MVP once headless mode is real scope.
- Latent Briefing / KV cache compaction. Rejected.
- Legacy desktop-shell compatibility. Tauri-only.

---

## 7. Acceptance Snapshot (MVP ship gate)

- All M1–M7 rows in `agent-knowledge/context/tasks.md` status = `done`.
- MVP Acceptance Checklist in tasks.md passes end-to-end on macOS + Linux (Windows best-effort).
- `pnpm -r typecheck` + `pnpm -r test` green.
- No references to post-MVP features in the first-run or workspace UI.
- `README.md` + `docs/development.md` describe the MVP loop (pick folder → chat → open files → memory).

---

## 8. Post-MVP Roadmap (context, not commitment)

Deferred features retain their specs in `agent-knowledge/features/01-15-*.md` and will be reconsidered only after MVP ships + user demand is observed. See `agent-knowledge/product/decisions.md` D25 for the reopen bar.

Likely order once MVP ships: identity layer (Better Auth) → entity memory pipeline → scheduler → host-service split → Playbook + Coach → attention + sidebar → sub-agent orchestration.
