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
- **Desktop UI** (`apps/desktop`) is Tauri v2 + React 19 + `@tinker/panes` (recursive split-tree + tabs; Dockview deprecated, migrating feature-by-feature per [[D16]]).

**Key files to read first:**

1. `tinker-prd.md` — canonical spec
2. This file
3. `agent-knowledge/README.md` — shared research + feature reasoning + reference implementations (if present)
4. `agent-knowledge/context/tasks.md` — open work, status, priorities (if present)
5. `agent-knowledge/context/sessions/` — last 2–3 session summaries for continuity (if present)
6. `opencode.json`
7. `packages/shared-types/src/`

**If `agent-knowledge/` is absent** (new contributor's fresh clone, or sparse repo): read `agent-knowledge/README.md` bootstrap section — or if it doesn't exist yet, seed it from `tinker-prd.md` + `README.md`. The `agent-knowledge/` folder is version-controlled and shared; contributors extend it as they work.

**OpenCode SDK reference:** https://opencode.ai/docs/sdk/

---

## 1. Principles

1. **Make complexity invisible, not absent.** The user gets full capability without seeing the plumbing first.
2. **Local-first, user-owned.** The vault, database, and tokens belong to the user and stay on their machine.
3. **The product teaches by doing.** The first useful outcome should come from using the app, not from studying setup docs.

---

## 2. Engineering Algorithm (Musk's 5-step)

Apply these steps **in order**. Reversing them is the most common mistake — Musk himself has flagged automating, accelerating, and simplifying things that should have been deleted entirely.

1. **Make requirements less dumb.** Every requirement is suspect until proven — especially ones from smart people, which are the hardest to challenge. Know why each one exists and who still benefits.
2. **Delete parts or processes.** If you aren't adding 10% of what you delete back later, you aren't deleting enough. Removing stale process beats wrapping it.
3. **Simplify / optimize.** Only after deletion. Optimizing something that shouldn't exist is the worst kind of waste.
4. **Accelerate cycle time.** Shrink the distance between a change and a verified result. Only after simplification — otherwise you accelerate waste.
5. **Automate.** Last. Never first. Automating a bad process calcifies it.

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
| Workspace layout | **`@tinker/panes`** (recursive split tree + tabs, zustand-backed; Dockview deprecated per [[D16]]) |
| Agent backend | **OpenCode** sidecar |
| Bridge SDK | **`@opencode-ai/sdk`** |
| LLM | **GPT-5.4** via Codex OAuth |
| SSO | **Google OAuth** loopback flow |
| Secrets | **System keychain** via `tauri-plugin-keyring` |
| Persistence | **SQLite** via `@tauri-apps/plugin-sql` |
| Vault I/O | **`@tauri-apps/plugin-fs`** |
| Integrations | **MCP servers** configured in `opencode.json` |
| Testing | **Vitest** |

---

## 4. Repo Conventions

- Monorepo root: `tinker`
- Commits: conventional commits with a real scope, for example `feat(bridge): stream OpenCode events to chat`
- Branch names match the feature or fix they implement, for example `feat/07-workspace-persistence` or `fix/bridge-stream-shaping`. Do not leave agent-generated throwaway names like `claude/<slug>` on work that will reach review — rename before opening a PR so reviewers see scope, not a codename.
- Sync against `origin/main`
- Doc references that mention the future repo name should use `https://github.com/khvni/tinker.git`

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

- `@tinker/panes` is the only sanctioned layout engine (per [[D16]]). Don't add `dockview-react` imports. Migration is in-flight — existing Dockview panes keep working until their per-pane PR lands.
- Split panes, movable tabs, and restored layout must work. Pane payload is typed (`Pane<TData>`); each `kind` registers a renderer in a `PaneRegistry`.
- Workspace state serializes via `selectWorkspaceSnapshot()`; persistence uses `WorkspaceState<TData>` from `@tinker/panes`, not Dockview's JSON (see [[07-workspace-persistence]] follow-ups).
- The app must stay usable when integrations are disconnected.
- No modal-heavy core flows. Agent-initiated clarifications use the `ask_user` overlay (per [[D20]]), not freeform chat prompts.
- Dark, focused UI with persistent workspace state. All colors/spacing/radius/font values come from `@tinker/design` tokens (per [[D14]] / [[D15]]).

---

## 9. Architecture — device vs host (per [[D17]])

- **Device** (Tauri shell / `apps/desktop`) owns: window, tray, menu, dialogs, clipboard, notifications, updater, keychain **writes**, renderer UI.
- **Host** (`packages/host-service`, scaffolded) owns: workspace lifecycle, vault indexing, memory store, OpenCode sidecar lifecycle, git ops, scheduler, chat runtime + memory injection. Deployable standalone (no Tauri awareness).
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

## 11. Git Workflow

- Remote docs should point at `https://github.com/khvni/tinker.git`
- Default branch: `main`
- never force-push `main`
- never bypass hooks with `--no-verify`
- do not add `Co-Authored-By` trailers

---

## 12. Knowledge Base Discipline

- **Before building**: check `agent-knowledge/features/NN-*.md` for the matching spec + out-of-scope boundaries.
- **Before deciding**: check `agent-knowledge/product/decisions.md` — if a decision's already been made, respect it unless you're intentionally reopening it (then update the log).
- **While working**: if you learn something non-obvious a future contributor will need, update the relevant `agent-knowledge/*.md` file in the same PR.
- **Ending a session**: append a summary to `agent-knowledge/context/sessions/YYYY-MM-DD-HHMM.md` — prevents context loss for the next agent.
- **Updating tasks**: move entries in `agent-knowledge/context/tasks.md` as you start, block, or complete work.
- **New reference material**: when you fetch an external article / research / vendor doc that informs architecture, process into `agent-knowledge/reference/*.md` per the conventions in `agent-knowledge/README.md`.

## 13. Things That Will Tempt You

- "Let me call the OpenAI API directly." No. Use OpenCode.
- "Let me put business logic in Rust." No. Rust is system plumbing only.
- "Let me build a custom integration client." No. Use MCP servers.
- "Let me preserve the old desktop shell behind a flag." No. The old shell is deleted.
- "Let me add non-GPT providers." No. GPT-5.4 via Codex OAuth is the path.
- "Let me store tokens in a file." No. Use the system keychain.
- "Let me add `dockview-react` back for this one pane." No. Register a `kind` in `PaneRegistry` per [[D16]].
- "Let me stash config on the coordinator and call start later." No. Pass config per call per [[D22]].
- "Let me derive `hostId` from a config field." No. Intrinsic only per [[D17]].
- "Let me ship a sync layer alongside host/device split." No. Deferred per [[D18]].
- "Let me collapse the folder-per-component rule for this trivial button." No. Follow [[D21]] even for trivial components; the exception is `packages/design` primitives only.
- "Let me ask the user a question by printing plain text in chat." No. Use the `ask_user` overlay per [[D20]].

