# Tinker — Product Requirements Document

> Mission: build a local-first AI workspace with a thin Tauri shell, OpenCode as the agent backend, a user-owned vault, and persistent workspace state.

> Audience: coding agents working in this repo. Read this before changing architecture.

---

## 0. Guiding Principles

1. **Make complexity invisible, not absent.** Power is available without forcing setup knowledge into the first-run path.
2. **Local-first, user-owned.** The vault, app database, and tokens stay on the user's machine.
3. **The product teaches by doing.** The first useful interaction should happen in the product itself.

---

## 1. Product Summary

Tinker is a desktop AI workspace. The shell is Tauri v2, the UI is React + `@tinker/panes` (recursive split-tree + tabs; supersedes Dockview per [[decisions]] D16), and OpenCode runs as a localhost sidecar. The user can connect Google for integrations, pick or create a local vault, and keep working even if no integrations are configured.

The app is not a cloud dashboard. It is a local workspace that happens to talk to a model.

Core traits:

- OpenCode is the agent runtime; model + provider auth are owned by OpenCode, not Tinker
- Tinker ships a GUI model picker over OpenCode's SDK — the default model at first launch is whichever hosted (no-GPU) provider OpenCode is configured with, so the app is usable on a stock laptop out of the box
- a local markdown vault is the knowledge base
- SQLite stores app state, memory indexes, and layout state
- the workspace is pane-based, not chat-only

---

## 2. v1 Feature Set

### 2.1 Desktop runtime

- Tauri v2 manages the native window, sidecar lifecycle, system keychain access, and OS dialogs.
- Rust stays thin. It starts the OpenCode sidecar and the Better Auth identity sidecar, binds the OS-level loopback redirect URIs those sidecars need, exposes the OpenCode base URL, and shuts everything down cleanly.
- The webview talks directly to OpenCode over HTTP + SSE through `@opencode-ai/sdk`.

### 2.2 OpenCode backend

- OpenCode is bundled as a sidecar invoked as `opencode serve`.
- The app health-checks the sidecar before showing the main workspace.
- Chat uses `session.create()`, `session.prompt()`, `session.messages()`, and `event.subscribe()`.
- Streamed events are transformed into a smaller UI-facing event model in `@tinker/bridge`.

### 2.3 Sign-in and integrations

- v1 identity is handled by **Better Auth** running as a local sidecar (`packages/auth-sidecar`) per [[decisions]] D2. Enabled sign-in providers in upstream OSS are **Google, GitHub, and Microsoft** (consumer Microsoft accounts — Outlook / personal Microsoft 365 — via Better Auth's built-in Microsoft provider). Tinker does not ship its own OAuth/session code.
- Enterprise SSO (Okta, Azure Entra ID, SAML, SCIM) is explicitly out of scope for upstream — that lives in enterprise forks per [[decisions]] D1 / D8.
- Gmail, Calendar, Drive, Linear, and every other integration are configured through MCP servers in `opencode.json` — OpenCode owns the service-level OAuth / token lifecycle. Identity ≠ integration credentials (per [[decisions]] D6).
- No custom API clients belong in the app.
- Bearer-equivalent credentials (Better Auth refresh tokens, integration OAuth tokens) live only in the system keychain per [[decisions]] D5.

### 2.4 Memory and vault

- The vault is an Obsidian-compatible markdown directory.
- Tinker can connect an existing vault or create a new one.
- SQLite stores:
  - entities
  - relationships
  - FTS-backed entity search
  - saved workspace layouts (`@tinker/panes` `WorkspaceState<TData>` snapshots)
- The vault remains the human-readable source of truth for notes and summaries.

### 2.5 Workspace

- `@tinker/panes` provides the recursive split tree, movable tabs, and the per-pane renderer registry. Dockview is being retired per [[decisions]] D16 — new panes register a `kind`, no new `dockview-react` imports.
- The default layout is Chat + Today.
- Layout serializes into SQLite as `WorkspaceState<TData>` snapshots and restores on relaunch.
- First run walks the user through sign-in, vault choice, and opening the workspace.
- The architecture splits into **device** (Tauri shell, renderer) and **host service** (workspace state, vault, scheduler, OpenCode lifecycle) per [[decisions]] D17. Headless mode + future mobile companion depend on this boundary.

---

## 3. Architecture

```text
Device — Tauri Window
  |- React renderer
  |- @tinker/panes workspace (tabs + recursive split tree)
  |- @tinker/host-client (typed RPC + stream shaping)
  |- platform bridges (dialogs, tray, notifications, keychain writes)

Device — Tauri Rust core
  |- spawns + adopts the host service (coordinator pattern, per D17 + D22)
  |- binds OS-level loopback redirect URIs for Better Auth sign-in providers (Google, GitHub, Microsoft)
  |- manages keychain-backed token storage plugin
  |- OS-level primitives only

Host service (packages/host-service)
  |- workspace CRUD
  |- vault indexing + memory (SQLite-backed)
  |- OpenCode sidecar lifecycle
  |- git operations
  |- scheduled jobs
  |- chat runtime + memory injection
  |- exposes PSK-authenticated HTTP/WS surface

OpenCode sidecar
  |- model + provider auth (OpenCode-owned; Tinker does not replicate)
  |- session management
  |- tools and MCP servers
```

### Runtime flows

**First launch**

1. Tauri starts the OpenCode sidecar and the Better Auth identity sidecar.
2. The renderer asks for the sidecar URLs.
3. The user can sign in via Better Auth (Google, GitHub, or Microsoft) or skip it.
4. The user chooses an existing vault or creates a new one.
5. The renderer indexes the vault into SQLite.
6. The workspace opens with Chat and Today.

**Sending a message**

1. The renderer ensures a session exists.
2. Recent entities are injected as a `noReply` prompt.
3. The real user prompt is sent to OpenCode.
4. SSE events stream back into the Chat pane.
5. Any resulting layout or memory updates are written locally.

**Vault indexing**

1. Read markdown files from the selected vault.
2. Parse frontmatter and body.
3. Upsert document entities into SQLite.
4. Surface recent entities in Today.

---

## 4. Repo Layout

```text
tinker/
  apps/
    desktop/                 # Device (Tauri shell)
      src/
        bindings.ts
        renderer/
      src-tauri/             # Rust coordinator for host-service + OpenCode
  packages/
    panes/                   # recursive split-tree workspace (retires dockview-react)
    design/                  # tokens + primitives
    host-service/            # (planned) standalone workspace runtime
    host-client/             # (planned) typed RPC + WS client for the host
    bridge/                  # stream shaping + memory injection (to be split)
    memory/                  # SQLite + vault indexing (moving under host-service)
    scheduler/               # in-process cron (moving under host-service)
    attention/               # (planned) workspace attention coordinator
    workspace-sidebar/       # (planned) vertical workspace nav
    auth-sidecar/            # Better Auth local sidecar (identity)
    shared-types/
  opencode.json
  tinker-prd.md
  CLAUDE.md
  AGENTS.md
```

---

## 5. Quality Bars

- The app launches through `pnpm tauri dev`.
- FirstRun renders and can reach the workspace without crashing.
- Chat and Today panes render through `@tinker/panes` (Dockview-migrated or freshly registered).
- Layout state persists across restarts using `WorkspaceState<TData>` snapshots.
- The renderer does not depend on preload globals or custom IPC channels for app logic.
- The workspace still loads when sign-in fails or is skipped.
- The `@tinker/panes` demo at `?route=panes-demo` renders, supports tab add/close/move and pane split/close, and its test suite (`pnpm --filter @tinker/panes test`) stays green.

---

## 6. Non-goals

- multi-provider model support
- enterprise SSO
- cloud sync
- legacy desktop-shell compatibility
- a separate prompt marketplace

---

## 7. Acceptance Snapshot

- no product-name references to the old identity remain
- no desktop-shell references to the removed runtime remain
- package names use the `@tinker/*` namespace
- the bridge package is reduced to stream + memory helpers
- the desktop app is Tauri-first and webview-directed
