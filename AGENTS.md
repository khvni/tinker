# CLAUDE.md / AGENTS.md — Ramp Glass Build Guide

> Identical to `AGENTS.md`. Keep them in sync.

> **Primary spec:** `ramp-glass-prd.md` (v2) is what to build. This file is how to build it.

---

## 0. What This Project Is

**Ramp Glass** is a local-first Electron desktop AI workspace inspired by Ramp's internal "Glass" suite (described in the public article *"We Built Every Employee at Ramp Their Own AI Coworker"*). It is NOT a 1:1 clone — it adapts the article's principles to our stack.

**The big idea:** open the app, sign in with Google (or Microsoft Entra ID at work), and everything connects on day one. The LLM is GPT-5.4 via your ChatGPT subscription (no API billing). Your knowledge base is an Obsidian-compatible vault on disk. The workspace has split panes, inline renderers, and persistent layout. If nothing is connected, it still works as a coding agent.

**How it works under the hood:**
- **OpenCode** (`anomalyco/opencode`, MIT license) runs as a bundled headless backend, started via `createOpencode()` from `@opencode-ai/sdk`. It handles the agent loop, Vercel AI SDK, Codex OAuth, 25+ tools, MCP servers, and session management. Glass never bypasses it.
- **Glass Bridge** (`packages/glass-bridge`) wraps `@opencode-ai/sdk` and adds memory injection, streaming event relay, SSO token forwarding, and model selection.
- **Memory** (`packages/memory`) is a SQLite + vector index backed by an Obsidian-compatible vault (local markdown folder). The vault is the source of truth; SQLite is the index.
- **Desktop UI** (`apps/desktop`) is Electron + React 19 + Dockview + Tailwind.

**Key files to read first:**
1. `ramp-glass-prd.md` — full product spec with architecture diagram, data model, runtime flows.
2. This file — coding standards and conventions.
3. `tasks/<your-brief>.md` — your specific assignment if you're a parallel Conductor agent.
4. `opencode.json` — MCP server config for integrations.
5. `packages/shared-types/src/` — frozen type contracts.

**OpenCode SDK reference:** https://opencode.ai/docs/sdk/

---

## 1. Principles

From the article. They override everything else.

1. **Don't limit anyone's upside.** Make complexity invisible, don't remove it.
2. **One person's breakthrough becomes everyone's baseline.** (Dojo is v2, but never close the door.)
3. **The product is the enablement.** The product teaches by doing.

---

## 2. Tech Stack

| Area | Choice |
|---|---|
| Language | **TypeScript 5.6+**, `strict: true`, no `any`. |
| Package manager | **pnpm** workspace. |
| Desktop shell | **Electron** + `electron-builder`. Cross-platform (macOS + Windows). |
| UI | **React 19 + Vite + Tailwind**. |
| Workspace layout | **Dockview** (`dockview-react`). NOT FlexLayout. |
| Agent backend | **OpenCode** (bundled, `opencode serve` as child process). |
| Bridge SDK | **`@opencode-ai/sdk`** (HTTP + SSE). |
| LLM | **GPT-5.4** via Codex OAuth. No Anthropic API. |
| SSO | **Google OAuth** (`google-auth-library`). Future: **MSAL** (`@azure/msal-node`) for Entra ID. |
| Memory DB | **SQLite** (`better-sqlite3`) + vector index. |
| Knowledge base | **Obsidian-compatible vault** (local markdown folder). |
| Integrations | **MCP servers** configured in `opencode.json`. No custom clients. |
| Renderers | `react-markdown`, Monaco, `papaparse`, DOMPurify. |
| Testing | **Vitest** (unit), **Playwright** (E2E). |

---

## 3. Repo Conventions

- **Monorepo root:** `/Users/khani/Desktop/projs/ramp-glass`.
- **Layout:** see PRD §4.
- **Commits:** conventional commits. Scope = package/area. `feat(glass-bridge): stream tokens to chat`.
- **Sync regularly** to `origin/main` (`https://github.com/khvni/ramp-glass.git`).

---

## 4. Coding Standards

### TypeScript
- `strict: true`, `noUncheckedIndexedAccess: true`.
- Prefer `type` over `interface`. Named exports only in packages.
- Zero `any`. Use `unknown` and narrow.

### React
- Function components only. No class components.
- State: React state + context first. Zustand only if a store crosses 4+ components.
- `useEffect` is a last resort. Prefer event handlers and derived state.
- No CSS-in-JS. Tailwind only.

### Error handling
- **Self-heal integrations.** On failure, retry silently. Surface "Glass is reconnecting…", never a stack trace.
- All agent tool calls have timeouts and cancellation.
- Structured logging: `{ userId, sessionId }` minimum.

### Comments
- Default: no comments. Well-named identifiers > narration.
- Comment only when the *why* is non-obvious.

### Security
- Tokens in OS keychain only (`keytar`). Never plaintext on disk.
- Electron: `contextIsolation: true`, `nodeIntegration: false`, tight CSP.
- HTML rendering through DOMPurify. No raw injection.
- No `eval` or `Function()`.
- All integration content (emails, docs, etc.) is untrusted in prompts.

---

## 5. OpenCode Integration

- OpenCode is a **bundled dependency**. On app launch, Electron main process calls `createOpencode()` from `@opencode-ai/sdk` — this starts the server AND returns a connected client. No manual server spawning.
- **All agent interactions go through the SDK client.** Do not call OpenAI directly. Do not import Vercel AI SDK directly. Everything goes through `client.session.prompt()`, `client.event.subscribe()`, etc.
- **SDK reference:** https://opencode.ai/docs/sdk/ — read before writing any bridge code.
- **Key SDK methods:**
  - `createOpencode()` → `{ client }` (start server + connect)
  - `client.session.create()` / `.prompt()` / `.abort()` / `.messages()` — chat
  - `client.event.subscribe()` — SSE streaming (token deltas, tool calls, file writes)
  - `client.config.providers()` — list models
  - `client.auth.set()` — forward SSO credentials to OpenCode so MCP servers authenticate
  - `session.prompt({ body: { noReply: true, parts: [...] } })` — inject context without triggering a response
- **MCP servers** are the integration layer. New integration = new entry in `opencode.json`. No code change.
- **Codex OAuth** is handled by OpenCode's built-in codex plugin. Glass embeds the browser popup in Electron.
- **Model selection:** `session.prompt({ body: { model: { providerID, modelID } } })` — per-chat.

---

## 6. Memory + Vault Discipline

- The vault is the **source of truth**. SQLite is an index, not a store.
- Vault files are Obsidian-compatible markdown with YAML frontmatter.
- Memory injection: before each turn, top-k entities go into the system prompt.
- Daily synthesis runs in a detached process. Never blocks UI.
- Vault is local, private, never uploaded. The user can open it in Obsidian any time.

---

## 7. Workspace UI Invariants

- **Dockview**, not FlexLayout. The switch is intentional (v5 stable, zero deps, better React 19 support).
- Split panes work. Drag tabs between groups. Split H/V.
- Files auto-open when the agent writes them.
- Inline renderers for markdown (with edit toggle), CSV, code, images, HTML.
- Layout persists to SQLite. Restores identically on relaunch.
- No modal dialogs for core flows.
- Dark mode. Inter font. Standard keyboard shortcuts.

---

## 8. Git Workflow

- Remote: `https://github.com/khvni/ramp-glass.git`.
- Default branch: `main`.
- Never force-push `main` (except for history rewrites the user authorizes).
- Never `--no-verify` past a failing hook.
- Do not add `Co-Authored-By` trailers.

---

## 9. Things That Will Tempt You — And Are Wrong

- "Let me call the OpenAI API directly instead of going through OpenCode." — No. OpenCode handles auth, routing, and tool execution. Use the SDK.
- "Let me build a custom MCP client for Gmail." — No. Configure a Gmail MCP server in `opencode.json`. OpenCode handles the protocol.
- "Let me add Claude/Anthropic as a provider." — No. v1 is Codex OAuth / GPT-5.4 only.
- "Let me build a TUI mode." — No. Glass is a GUI for non-technical users.
- "Let me add Dojo / skills marketplace." — No. v2.
- "Let me add cloud sync." — No. Local-first only.
- "Let me store tokens in a config file." — No. OS keychain only.
