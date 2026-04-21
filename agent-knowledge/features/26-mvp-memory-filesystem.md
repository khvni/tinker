---
type: feature
status: not started
priority: p0
pillar: M6
depends_on: ["M1.5 (memory pane registered)"]
supersedes: ["03-memory-pipeline (MVP subset)"]
mvp: true
---

# M6 — Desktop-native memory filesystem

## Goal

"Memory" in Tinker is a single desktop-global folder of markdown files. NOT inside a session folder — the user sees one universal memory location regardless of which session they're in. They can relocate it via Settings; the app moves the contents and updates all references (including MCP env vars).

## Scope

- SQLite `app_settings` table (key/value JSON) seeded on first run with `memory_path` = platform default.
  - macOS: `~/Library/Application Support/Tinker/memory`
  - Linux: `~/.local/share/tinker/memory`
  - Windows: `%APPDATA%\Tinker\memory`
- Settings pane surface: "Memory folder" row, current path visible, `<Button>Change location…</Button>` opens folder picker → validates writable → updates setting → moves contents → respawns OpenCode so MCPs see the new path.
- Memory pane (registered in M1.5): lists `.md` files in memory folder (name + modified-at). Click opens as a FilePane tab with the Markdown renderer (M3.9).
- MVP injection: on `session.prompt()`, read top-N (default 5) most-recently-modified `.md` files in memory folder → prepend as `noReply` system context via existing `bridge/memory-injector.ts`.
- MVP auto-capture (toggleable, default on): on assistant response stream completion, write `memory/sessions/YYYY-MM-DD-HHMM-<session-id>.md` containing the user prompt + final assistant message.
- No entity extraction, no FTS, no ranking beyond modified-time recency.

## Out of scope

- Entity graph ([[03-memory-pipeline]] — deferred).
- Semantic search. Post-MVP (smart-connections MCP does a version of this at query time).
- Cross-device memory sync (D18).
- Memory scoping rules (work/personal, topic-based). Post-MVP.
- Summarization of captured memory. MVP appends verbatim.
- Vault-compatible (Obsidian-style) frontmatter. MVP writes bare markdown.

## Acceptance

- First launch creates memory folder at platform default; `app_settings.memory_path` reflects it.
- Settings → Change location → folder picker → confirms → moves contents → UI updates.
- After a successful message send, a new file exists in `memory/sessions/` with timestamp + session ID.
- After sending 6+ messages in one session, prompt includes top-5 recent memory files as context (verifiable by inspecting the last `noReply` event sent to OpenCode).
- MCP env vars update on path change without requiring app restart.
- Toggling auto-capture off stops the write.

## Atomic tasks

See `agent-knowledge/context/tasks.md` §M6.

## Notes for agents

- Keep the memory folder HUMAN-READABLE. `.md` only. Flat structure (or single `sessions/` subfolder). No sqlite, no json sidecar files.
- Path resolution: always read from `app_settings.memory_path` at query time — never cache in a module-level variable. Path can change mid-session.
- Path change = cross-pillar event (M6.9 fans out to M6.7 + M6.8 + M7.7). Implement as a simple pub/sub in `@tinker/memory` rather than tight coupling.
- Injection N=5 is a constant for MVP. Do not expose it as a setting in MVP — one less knob to regress.
- Auto-capture write is best-effort. If write fails (disk full, permissions), log + continue. Do not block the UI.
