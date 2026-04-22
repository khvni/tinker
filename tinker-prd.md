# Tinker — Product Requirements Document

> Mission: build a local-first AI workspace with a thin Tauri shell, OpenCode as the agent backend, a user-owned memory folder, and a chat interface that renders markdown natively.

> Audience: coding agents working in this repo. Read this before changing architecture.

> **[2026-04-21] MVP refocus per [[decisions]] D25.** Scope cut to eight pillars (seven product surfaces + Better Auth identity for per-user chat-history persistence). Prior feature breadth deferred to post-MVP. Pillars are specified in §2; everything else is background architecture or post-MVP roadmap.

---

## 0. Guiding Principles

1. **Make complexity invisible, not absent.** Power is available without forcing setup knowledge into the first-run path.
2. **Local-first, user-owned.** Folder sessions, the memory directory, and the app database stay on the user's machine.
3. **The product teaches by doing.** The first useful interaction happens in the product itself — not in docs.
4. **One thing, perfectly.** Ship the seven pillars at production quality before any eighth feature is considered.

---

## 1. Product Summary

Tinker is a desktop AI workspace. The shell is Tauri v2, the UI is React 19 + `@tinker/panes` (recursive split tree + tabs; supersedes Dockview per D16), and OpenCode runs as a localhost sidecar scoped to a user-picked folder.

First launch opens directly into a Chat pane (no sign-in gate, no setup wizard — per D26). Sign-in via Google, GitHub, or Microsoft (Better Auth) is reachable later from Settings → Account; until then sessions attach to a `'local-user'` placeholder. Every chat session begins by pointing Tinker at a local folder via the composer's folder-picker button (next to ModelPicker). OpenCode runs inside that folder. Chat replies are rendered as native markdown and every message streams to a per-user append-only history file in `<folder>/.tinker/chats/<user-id>/<session-id>.jsonl`. Files referenced in chat open inline (PDF, XLSX, DOCX, PPTX, HTML, code, markdown). A desktop-native memory folder — per-user, user-relocatable — holds cross-session context. Three auth-free MCP servers (qmd, smart-connections, exa) ship pre-wired.

The app is not a cloud dashboard. It is a local workspace that happens to talk to a model scoped to the folder you're working in, with per-user chat history that survives outside the app.

---

## 2. MVP — the eight pillars (v0.1)

Each pillar has a dedicated feature spec in `agent-knowledge/features/` and a task breakdown in `agent-knowledge/context/tasks.md`. Agents implementing the MVP should work from tasks.md.

### 2.1 Panes + tabs workspace (M1)
- `@tinker/panes` is the only layout engine. No `dockview-react` imports.
- Default MVP layout = single Chat pane. Split and multi-tab remain supported by `@tinker/panes` but are not exercised by the default layout.
- Pane kinds in MVP: `chat`, `file`, `settings`, `memory`. Each registered in a typed `PaneRegistry<TinkerPaneKind>`.
- Spec: [[20-mvp-panes-workspace]]

### 2.2 Folder-scoped session (M2)
- A session is `{ id, userId, folderPath, createdAt, lastActiveAt, modelId? }`. Stored in SQLite. `userId` FK → `users` table (§2.8); defaults to `'local-user'` placeholder until first sign-in (per [[decisions]] D26).
- **No FirstRun screen** (D26 / TIN-187): app boots directly into a single Chat pane. Folder selection happens from a button next to ModelPicker in the composer (file icon + "Select folder" label).
- "New session" always begins with a folder pick from the composer button. One sidecar per active session.
- Session switcher lists recent sessions for the current user only (filtered by `userId`); placeholder rows surface until M8 sign-in attaches.
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
- Per-user sub-paths: active memory path resolves to `<memory-root>/<user-id>/`. Switching users switches active subdirectory transparently.
- Default root location: platform-appropriate app data dir (macOS `~/Library/Application Support/Tinker/memory`, Linux `~/.local/share/tinker/memory`, Windows `%APPDATA%\Tinker\memory`).
- User can relocate the root via Settings → Memory. The app moves existing contents + refreshes all references (including MCP env vars pointing at the per-user subdir).
- MVP injection: top-N most recent `.md` files (default N=5) from the current user's subdir, prepended to each prompt as `noReply` context.
- MVP capture: on assistant response completion, append prompt + final reply to `<memory-root>/<user-id>/sessions/YYYY-MM-DD-HHMM-<session-id>.md`. Toggle in Settings.
- No entity extraction, no FTS, no semantic ranking in MVP. Pure filesystem.
- Spec: [[26-mvp-memory-filesystem]]

### 2.7 Built-in MCP servers: qmd, smart-connections, exa (M7)
- Pre-wired in `opencode.json`. No user config, no API keys.
- `qmd` + `smart-connections`: env var `SMART_VAULT_PATH` points at the current user's memory subdir from M6.
- `exa`: remote MCP, no auth.
- Settings pane shows connected/error status for each.
- Memory-root change OR user switch triggers MCP env refresh + OpenCode respawn.
- Spec: [[27-mvp-builtin-mcp]]

### 2.8 Identity + per-user chat-history persistence (M8)
- **Better Auth** local sidecar (`packages/auth-sidecar`) handles consumer OAuth via **Google, GitHub, and Microsoft** — the three providers from D2 / D4. No enterprise SSO in MVP (SAML / SCIM / tenant-locked federation stays deferred per D1 / D8).
- **No sign-in gate on boot** (per D26 / TIN-187). Sessions attach to `user_id='local-user'` until the user reaches Settings → Account. On first real sign-in via Google/GitHub/Microsoft, a `users` row is created (`id, provider, provider_user_id, display_name, avatar_url, created_at`); placeholder sessions migrate to the new `userId`.
- **Per-user chat history**: every streamed message (user + assistant + tool use + reasoning) is appended as one JSON line to `<session-folder>/.tinker/chats/<user-id>/<session-id>.jsonl`. The folder is the durable source of truth — if the app database is lost, history still exists in the folder.
- **Hydration**: opening a session reads the JSONL and populates the Chat pane before re-connecting to OpenCode for new turns.
- Settings pane shows current user, sign-out, and provider-switch. Sign-out clears keychain refresh tokens + routes back to first-run.
- Bearer credentials (Better Auth refresh tokens) live only in the OS keychain per D5. Chat history JSONL is NOT encrypted (already in a user-chosen local folder; encryption is post-MVP if asked for).
- Spec: [[28-mvp-identity]]

---

## 3. Architecture

```text
Device — Tauri v2 Window
  ├─ React renderer
  │   ├─ @tinker/panes workspace (tabs + recursive split tree)
  │   ├─ @tinker/design primitives + tokens (dual-theme, D23)
  │   └─ Chat pane talks OpenCode direct via @opencode-ai/sdk (HTTP + SSE)
  │      ├─ writes every streamed event to <folder>/.tinker/chats/<user-id>/<session-id>.jsonl
  │      └─ hydrates from the same file on session reopen
  └─ Rust core (apps/desktop/src-tauri)
      ├─ opens folder picker (2.2)
      ├─ spawns + health-checks OpenCode per session (2.2)
      ├─ spawns + adopts Better Auth sidecar (2.8)
      ├─ binds OS-level loopback redirect URIs for OAuth providers
      ├─ keychain writes via tauri-plugin-keyring
      ├─ Tauri fs + dialog plugins
      └─ OS primitives only — no business logic

Better Auth sidecar (packages/auth-sidecar)
  ├─ Google, GitHub, Microsoft providers
  ├─ PKCE flows through loopback URIs (D4)
  └─ refresh tokens handed to Rust → keychain (D5)

OpenCode sidecar (one per active session)
  ├─ spawned with --cwd <session.folderPath>
  ├─ model + provider auth (OpenCode-owned)
  ├─ tools + MCP servers (pre-wired from opencode.json)
  └─ streams SSE events back to the webview

Local storage
  ├─ SQLite (app database) — users, sessions, app_settings, layouts
  ├─ OS keychain — Better Auth refresh tokens (D5)
  ├─ Memory root (user-configurable) — contains <user-id>/… subdirs of flat .md
  └─ Session folder (per-session, chosen by user)
      └─ .tinker/chats/<user-id>/<session-id>.jsonl — per-user history, source of truth
```

### MVP runtime flows

**First launch**

1. Tauri starts. Renderer loads. Better Auth sidecar spawns in background.
2. Renderer checks keychain for a refresh token → none → shows sign-in screen (Google / GitHub / Microsoft).
3. User picks a provider → Better Auth runs PKCE over loopback URI → refresh token written to keychain → `users` row upserted.
4. Folder picker: "Pick a folder to start chatting".
5. User picks a folder. Tauri spawns `opencode serve --cwd <folder>` with `SMART_VAULT_PATH=<memory-root>/<user-id>`.
6. Tauri health-polls the sidecar. When ready, renderer opens workspace with a single Chat pane bound to the new session.
7. Memory root default is created if missing. Per-user subdir `<memory-root>/<user-id>/` created if missing.

**Subsequent launch**

1. Tauri reads refresh token from keychain → Better Auth validates → current user resolved.
2. SQLite sessions filtered by `user_id = currentUser.id`. Switcher appears listing current user's recent sessions.
3. User picks a session → Tauri respawns OpenCode for that folder → renderer hydrates Chat pane from `<folder>/.tinker/chats/<user-id>/<session-id>.jsonl` → workspace opens.
4. OR user picks "New session" → folder picker → new session row (with current `user_id`) → new sidecar → fresh JSONL file created on first message.
5. If the keychain lookup returns nothing (token expired / signed out), fall back to first-launch flow at step 2.

**Sending a message**

1. Renderer reads top-N recent memory files from `<memory-root>/<user-id>/` (M6.7) → sends as `noReply` system context.
2. Renderer sends user prompt via `session.prompt()`. The prompt event is appended to `<folder>/.tinker/chats/<user-id>/<session-id>.jsonl` immediately.
3. SSE events stream back → markdown rendered incrementally in Chat pane AND each event appended to the same JSONL.
4. Context badge recomputes on each chunk.
5. Tool calls + thinking blocks render collapsed by default.
6. On stream completion: if auto-append enabled (M6.8), memory summary file appended under `<memory-root>/<user-id>/sessions/`.

**Opening a file from chat**

1. User clicks a file-path link in an assistant message.
2. Renderer opens a new FilePane tab with `{ path, mime }`.
3. FilePane dispatches to the correct renderer (PDF / XLSX / DOCX / PPTX / HTML / code / markdown).
4. Unsupported MIME → fallback "open externally" button using Tauri shell.open.

**Changing memory root**

1. Settings → Memory → Change location.
2. Tauri folder picker → validates writable.
3. Progress modal shown while contents move (including all `<user-id>/` subdirs).
4. On completion: `app_settings.memory_root` updated → OpenCode respawned with `SMART_VAULT_PATH=<new-root>/<current-user-id>` → MCPs reconnect → Memory pane refreshes.

**Switching users**

1. Settings → Account → Sign out → keychain refresh token cleared → renderer returns to sign-in screen.
2. New sign-in → either existing `users` row matched by `(provider, provider_user_id)` or new row inserted.
3. Workspace reopens: sessions filtered to new user; memory subdir resolves to new user; OpenCode respawns with new `SMART_VAULT_PATH`.

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
    memory/                  # SQLite (users, sessions, app_settings, layouts) + memory folder helpers + chat-history JSONL I/O
    bridge/                  # OpenCode stream shaping + simple memory injection (MVP) + JSONL append-on-stream
    auth-sidecar/            # Better Auth sidecar (Google + GitHub + Microsoft) — MVP (M8)
    shared-types/            # TinkerPaneKind, Session, User, WorkspaceState<TData>
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
- Post-MVP-planned: `packages/host-service`, `packages/host-client`, `packages/workspace-sidebar`, `packages/coach`.

`packages/auth-sidecar` IS wired into the MVP boot path (M8).

These stay in-tree but must not be imported by `App.tsx`, `Workspace.tsx`, or any MVP route beyond the auth-sidecar integration. Rewiring the rest is a post-MVP task.

---

## 5. Quality Bars (MVP)

- `pnpm tauri dev` launches to first-run without crashing.
- First-run sign-in (Google / GitHub / Microsoft) completes and writes refresh token to OS keychain.
- First-run folder picker creates a session bound to the signed-in user and opens Chat.
- Chat renders markdown (GFM) natively. No plaintext with raw `**` or `#`.
- Code blocks are syntax-highlighted.
- Tool calls + thinking hidden by default.
- Model picker lists OpenCode-configured providers + keyboard-nav works.
- Context badge updates during streaming.
- Any of {PDF, XLSX, DOCX, PPTX, HTML, code, markdown} file reference clicked from chat opens inline.
- Memory root default exists + user can relocate it via Settings; per-user subdir resolves correctly.
- qmd + smart-connections + exa all report connected on cold start.
- Chat history JSONL file exists in `<folder>/.tinker/chats/<user-id>/` after first message; reopening the session hydrates the Chat pane from it.
- Layout state restores across relaunches.
- Sign-out + sign-in as a different provider shows a different set of sessions + different memory subdir.
- No `dockview-react` import in repo.
- Per-renderer CSS uses `@tinker/design` tokens only (D14/D15/D23).
- TypeScript strict — no `any`, no `@ts-ignore`.

---

## 6. Non-goals (MVP)

- Enterprise SSO (SAML, SCIM, Okta, Entra ID tenant federation). Enterprise path via fork only (D1/D8). Consumer OAuth (Google, GitHub, Microsoft personal) IS in MVP per §2.8.
- Cloud sync, device-to-device (D18).
- Mobile / headless / remote dispatch.
- Multi-provider model support — OpenCode owns provider selection.
- Scheduled prompts (scheduler package stays in tree but unused).
- Additional MCP integrations beyond the three preloaded (GitHub / Linear / Gmail / Slack etc.) — deferred until post-MVP.
- Automations / workflows / custom agents. Post-MVP.
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

- All M1–M8 rows in `agent-knowledge/context/tasks.md` status = `done`.
- MVP Acceptance Checklist in tasks.md passes end-to-end on macOS + Linux (Windows best-effort).
- `pnpm -r typecheck` + `pnpm -r test` green.
- No references to post-MVP features in the first-run or workspace UI.
- `README.md` + `docs/development.md` describe the MVP loop (pick folder → chat → open files → memory).

---

## 8. Post-MVP Roadmap (context, not commitment)

Deferred features retain their specs in `agent-knowledge/features/01-15-*.md` and will be reconsidered only after MVP ships + user demand is observed. See `agent-knowledge/product/decisions.md` D25 for the reopen bar.

Likely order once MVP ships: additional MCP integrations (GitHub / Linear / Gmail etc.) → entity memory pipeline → scheduler / automations → custom agents → Playbook + Coach → host-service split → attention + sidebar → sub-agent orchestration.
