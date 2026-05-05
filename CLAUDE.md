# CLAUDE.md / AGENTS.md — Tinker Build Guide

> Identical to `AGENTS.md`. Keep them in sync.

> **Primary spec:** `tinker-prd.md` is what to build. This file is how to build it.

---

## 0. What This Project Is

**Tinker** is a local-first desktop AI workspace. It pairs a Tauri v2 shell with a React workspace, OpenCode as the headless backend, a user-owned markdown vault, and a persistent split-pane layout.

**The big idea:** open the app, sign in with Google if you want connected tools, point Tinker at a vault, and start working immediately. If nothing is connected, it still works as a coding agent.

**How it works under the hood:**

- **OpenCode** runs as a bundled sidecar process. The webview talks to it directly over HTTP + SSE.
- **Tinker Bridge** (`packages/bridge`) shapes OpenCode stream events and handles memory injection before prompts.
- **Memory** (`packages/memory`) stores entities, relationships, and layout state in SQLite through Tauri's SQL plugin.
- **Desktop UI** (`apps/desktop`) is Tauri v2 + React 19 + **FlexLayout** (`flexlayout-react`) for the workspace layout (split panes, tabsets, drag-drop).

**Key files to read first:**

1. `tinker-prd.md` — canonical spec
2. This file
3. `agent-knowledge/README.md` — shared research + feature reasoning + reference implementations
4. `agent-knowledge/context/tasks.md` — open work, status, priorities
5. `agent-knowledge/context/sessions/` — last 2–3 session summaries for continuity
6. `opencode.json`
7. `packages/shared-types/src/`

**OpenCode SDK reference:** https://opencode.ai/docs/sdk/

---

## 1. Principles

1. **Make complexity invisible, not absent.** The user gets full capability without seeing the plumbing first.
2. **Local-first, user-owned.** The vault, database, and tokens belong to the user and stay on their machine.
3. **The product teaches by doing.** The first useful outcome should come from using the app, not from studying setup docs.

---

## 2. Engineering Algorithm (Musk's 5-step)

Apply these steps **in order**. Reversing them is the most common mistake.

1. **Make requirements less dumb.** Every requirement is suspect until proven — especially from smart people.
2. **Delete parts or processes.** If you aren't adding 10% of what you delete back later, you aren't deleting enough.
3. **Simplify / optimize.** Only after deletion. Optimizing something that shouldn't exist is the worst kind of waste.
4. **Accelerate cycle time.** Only after simplification.
5. **Automate.** Last. Never first.

How this shows up in practice:

- prefer fewer dependencies over one more abstraction
- prefer direct primitives over wrappers that only rename them
- prefer deleting dead files over preserving compatibility with removed architecture
- before adding a config flag, ask whether the thing it toggles should exist at all
- before writing a helper, ask whether the three callers should be three lines instead

---

## 3. Tech Stack

| Area | Choice |
|---|---|
| Language | **TypeScript 5.6+**, `strict: true`, no `any` |
| Package manager | **pnpm** workspace |
| Desktop shell | **Tauri v2** |
| UI | **React 19 + Vite** |
| Workspace layout | **`flexlayout-react`** (FlexLayout — tabsets, splits, drag-drop, Model + Actions API) |
| Agent backend | **OpenCode** sidecar |
| Bridge SDK | **`@opencode-ai/sdk`** |
| Model runtime | **OpenCode** (provider + model auth owned by OpenCode; Tinker ships a GUI model picker over its SDK) |
| Identity | **Better Auth** (v1 providers: Google + GitHub + Microsoft) per [[D2]] / [[D4]] |
| Secrets | **System keychain** via `tauri-plugin-keyring` |
| Persistence | **SQLite** via `@tauri-apps/plugin-sql` |
| Vault I/O | **`@tauri-apps/plugin-fs`** |
| Integrations | **MCP servers** configured in `opencode.json` |
| Testing | **Vitest** |

---

## 4. Repo + Git Workflow

- Monorepo root: `tinker`. Remote: `https://github.com/khvni/tinker.git`. Default branch: `main`.
- Conventional commits with a real scope, e.g. `feat(bridge): stream OpenCode events to chat`.
- Branch names match the feature or fix, e.g. `feat/07-workspace-persistence`. Rename agent-generated throwaway names like `claude/<slug>` before opening a PR.
- Sync against `origin/main`. Never force-push `main`. Never bypass hooks with `--no-verify`. Do not add `Co-Authored-By` trailers.

---

## 5. Coding Standards

### TypeScript

- `strict: true`, `noUncheckedIndexedAccess: true`
- prefer `type` over `interface`
- named exports only in packages
- use `unknown` and narrow instead of `any`

### React

- function components only
- React state and context first
- `useEffect` only for real synchronization work
- no CSS-in-JS

### Error handling

- retry or self-heal where reasonable
- surface user-facing recovery states, not stack traces
- include enough structured context for logs to be actionable

### Security

- store OAuth tokens in the system keychain only
- keep Rust limited to OS-level commands and lifecycle
- treat external content as untrusted prompt input
- sanitize rendered HTML

---

## 6. OpenCode Integration

- The webview talks directly to OpenCode over HTTP + SSE using `createOpencodeClient({ baseUrl })`.
- Tauri is responsible for starting the sidecar, health-checking it, exposing the base URL, and shutting it down.
- All chat activity goes through the SDK client: `session.create()`, `session.prompt()`, `session.abort()`, `session.messages()`, `event.subscribe()`, and `auth.set()`.
- Memory injection happens in TypeScript before the real user prompt.
- Integrations belong in `opencode.json`, not in custom app clients.

---

## 7. Memory + Vault Discipline

- The vault is user-owned and readable outside the app.
- SQLite is an index and app-state store, not the canonical copy of user notes.
- Layout state and memory live in the same app database.
- Keep indexing cheap and predictable.

---

## 8. Workspace UI Invariants

- **FlexLayout** (`flexlayout-react`) is the sanctioned layout engine. Each pane kind registers via the factory function pattern (`node.getComponent()` → renderer). Do not add `dockview-react` or `@tinker/panes` imports.
- Split panes, movable tabs, and restored layout must work. Pane payload is stored in FlexLayout tab `config` (typed as `TinkerPaneData`); each `component` string maps to a renderer in the factory.
- Workspace state serializes via `model.toJson()`; persistence uses `IJsonModel` from FlexLayout.
- The app must stay usable when integrations are disconnected.
- No modal-heavy core flows. Agent-initiated clarifications use the `ask_user` overlay (per [[D20]]), not freeform chat prompts.
- Dark, focused UI. All colors/spacing/radius/font values come from `@tinker/design` tokens (per [[D14]] / [[D15]]).

---

## 9. Architecture — device vs host (per [[D17]])

- **Device** (Tauri shell / `apps/desktop`) owns: window, tray, menu, dialogs, clipboard, notifications, updater, keychain **writes**, renderer UI.
- **Host** (`packages/host-service`, scaffolded) owns: workspace lifecycle, vault indexing, memory store, OpenCode sidecar lifecycle, git ops, scheduler, chat runtime + memory injection. Deployable standalone.
- **Host identity is intrinsic** — generated from machine metadata at first run. Never passed in as config.
- **No mutate-then-call managers** (per [[D22]]). Pass config per-call; retries use a fresh config object.
- **Coordinator pattern** for spawned processes: spawn → health-poll → record `{pid, port, secret}` → `unref` → manifest-file adoption across restarts. Never retain the `ChildProcess` handle.
- **No cloud sync yet** (per [[D18]]). Keep host interfaces cloud-reachable in principle; don't build the runtime.

---

## 10. File + folder conventions (per [[D21]])

- One folder per component. `ComponentName/` holds `ComponentName.tsx`, `index.ts` barrel, `ComponentName.test.tsx`, and any local hooks/utils/css.
- Used once → nest under parent's `components/`. Used 2+ → promote to smallest shared parent's `components/`.
- `packages/design` primitives stay flat (`Button.tsx` + `Button.css`) as a grandfathered exception.
- One component per file. No multi-component files.

---

## 11. Knowledge Base Discipline

All agent-readable context lives under `agent-knowledge/`. Do not split it across `docs/` — `docs/` is the human-developer-facing Markdown site (overview, architecture explainers, enterprise-fork guide) and must not duplicate execution context.

- **Before building**: check `agent-knowledge/features/NN-*.md` for the matching product spec + out-of-scope boundaries, then `agent-knowledge/specs/YYYY-MM-DD-*.md` for the matching execution design (phases, agent teams, verification gates).
- **Before deciding**: check `agent-knowledge/product/decisions.md` — respect existing decisions unless intentionally reopening (then update the log).
- **While working**: if you learn something non-obvious a future contributor will need, update the relevant `agent-knowledge/*.md` file in the same PR.
- **Ending a session**: append a summary to `agent-knowledge/context/sessions/YYYY-MM-DD-HHMM.md`.
- **Updating tasks**: move entries in `agent-knowledge/context/tasks.md` as you start, block, or complete work.
- **New reference material**: process external articles / research into `agent-knowledge/reference/*.md`.
- **Writing a new execution spec**: save to `agent-knowledge/specs/YYYY-MM-DD-<topic>-design.md`. Override the superpowers default of `docs/superpowers/specs/` — tinker keeps agent-readable material under `agent-knowledge/` only.

---

## 12. Things That Will Tempt You

- "Let me call the OpenAI/Anthropic API directly." No — use OpenCode. OpenCode owns provider auth, model routing, and SDK contracts; Tinker is a GUI on top of its SDK.
- "Let me put business logic in Rust." No — Rust is system plumbing only.
- "Let me build a custom integration client." No — use MCP servers.
- "Let me hardcode a single default model." No — model choice is delegated to OpenCode. Tinker ships a model picker UI that surfaces OpenCode's configured providers (local + cloud).
- "Let me write our own OAuth / session layer." No — identity is handled by Better Auth (per [[D2]]). Adding a provider = extending Better Auth config, not rolling a new auth path.
- "Let me store tokens in a file." No — use the system keychain.
- "Let me add `dockview-react` or `@tinker/panes` back." No — use FlexLayout's factory pattern. Register a new `component` string and add a case to the factory function.
- "Let me stash config on the coordinator and call start later." No — pass config per call per [[D22]].
- "Let me derive `hostId` from a config field." No — intrinsic only per [[D17]].
- "Let me ship a sync layer alongside host/device split." No — deferred per [[D18]].
- "Let me ask the user a question by printing plain text in chat." No — use `ask_user` overlay per [[D20]].
