---
type: concept
tags: [tasks, status, tracking]
---

# Tinker Tasks

Open work + status + priorities. Agents update this file when starting, progressing, or closing work. Human contributors: PRs should reference the task line they close.

## Priority Legend
- **p1** = critical path for v1 (ship-blocker)
- **p2** = important for v1 but not blocking
- **p3** = post-v1 / backlog

## Status Legend
- `not started` — no work begun
- `in progress` — active development
- `blocked` — waiting on external/decision
- `review` — code complete, awaiting review
- `done` — merged + verified

---

## v1 Features (all tie back to PRD §2)

| # | Feature | Priority | Status | Spec | Notes |
|---|---------|----------|--------|------|-------|
| 01 | SSO connector layer (Google + GitHub OAuth, pre-wired MCP integrations) | p1 | review | [[01-sso-connector-layer]] | Better Auth local sidecar now owns social OAuth; Rust still owns keychain + loopback bridge. `[2026-04-15]` Google flow hardened: stable Better Auth callback URI + bad-client validation |
| 02 | Dojo skill marketplace (local + optional Git sync) | p1 | review | [[02-dojo-skill-marketplace]] | Vault-backed skill storage; browser UI; install/publish actions |
| 03 | Self-building memory pipeline (scheduled entity extraction from connected tools) | p2 | review | [[03-memory-pipeline]] | Vault indexing, prompt injection, session append, and daily sweep wired; review daily sweep behavior against live connectors |
| 04 | Native scheduler (cron-style scheduled prompts) | p1 | review | [[04-native-scheduler]] | In-process scheduler with SQLite-persisted job definitions — migrates under `packages/host-service` per [[D17]] |
| 05 | Sensei skill discovery (recommend skills based on role + connected tools) | p2 | not started | [[05-sensei-skill-discovery]] | Depends on Dojo being built first |
| 06 | Sub-agent orchestration (OpenCode-native multi-agent patterns) | p2 | not started | [[06-subagent-orchestration]] | Use OpenCode SDK sub-agent primitives; no Latent Briefing (see [[decisions]]) |
| 07 | Workspace persistence + split-pane UI | p1 | review | [[07-workspace-persistence]] | **Layout engine being swapped from Dockview to `@tinker/panes`** per [[D16]]; old implementation stays until all panes migrate. Migration issues below. |
| 09 | Design system enforcement (`@tinker/design` tokens + primitives everywhere) | p1 | done | [[09-design-system]] | `[2026-04-19]` Renderer styles.css rebound to design tokens; legacy `--tinker-*` palette removed; every pane/renderer now consumes `<Button>`, `<Badge>`, `<TextInput>`, `<Toggle>`, `<SegmentedControl>`; playground at `?route=design-system` is the canonical reference; reinforced by D14 + D15 in [[decisions]] |
| 10 | `@tinker/panes` workspace layout primitive | p1 | in progress | [[10-tinker-panes]] | `[2026-04-19]` package scaffolded, 41 tests green, demo route at `?route=panes-demo`. Migration of existing panes is the parallel-agent work below. |
| 11 | Device ↔ host-service split | p1 | not started | [[11-host-service]] | Spec drafted. Unblocks headless mode + future companion devices. Parallel-agent work enumerated below. |
| 12 | Workspace attention coordinator | p2 | not started | [[12-attention-coordinator]] | Unread rings + flash decisions ported from cmux. Depends on [[10-tinker-panes]]. |
| 13 | Vertical workspace sidebar | p2 | not started | [[13-workspace-sidebar]] | Primary nav. Depends on [[10-tinker-panes]] + [[12-attention-coordinator]]. |
| 14 | Session history windowing | p2 | not started | [[14-session-history-windowing]] | Bounded paint for long sessions. OpenCode pattern. Depends on Chat pane migrating to `@tinker/panes`. |
| 15 | Connection gate (splash + retry) | p2 | not started | [[15-connection-gate]] | Blocking → background health check against host-service. Depends on [[11-host-service]]. |

## Parallel-agent work queue (pick any row — no shared state between rows)

> Each row is a self-contained, PR-sized piece of work suitable for a single coding agent. Mark `in progress` on claim; open a PR titled `feat(scope): ...` referencing the feature spec. When two tasks share a `depends on`, start the dependency first.

### Panes migration ([[10-tinker-panes]] → per [[D16]])

| Task | Priority | Status | Depends on | Notes |
|------|----------|--------|------------|-------|
| Migrate Chat pane to `@tinker/panes` | p1 | not started | [[10-tinker-panes]] scaffolded | Register `{ kind: 'chat', render: Chat }`. Preserve multi-chat tab UX via `openTab(...)`. Delete `workspace/chat-panels.ts` usage from the migrated call sites. |
| Migrate Today pane | p1 | not started | Chat migration | Register `{ kind: 'today', render: Today }`. |
| Migrate Scheduler pane | p1 | not started | Today migration | Register `{ kind: 'scheduler', render: SchedulerPane }`. |
| Migrate Settings pane | p1 | not started | Scheduler migration | Register `{ kind: 'settings', render: Settings }`. |
| Migrate Dojo pane | p1 | not started | Settings migration | Register `{ kind: 'dojo', render: Dojo }`. Drop `params` hack. |
| Migrate VaultBrowser pane | p1 | not started | Dojo migration | Register `{ kind: 'vault-browser', render: VaultBrowser }`. |
| Migrate file renderers (Code/Csv/Html/Image/Markdown/MarkdownEditor) | p1 | not started | VaultBrowser migration | Each renderer registers a `kind`; `file-open.ts` maps file extension → `pane.kind`. |
| Retire `dockview-react` + rewire `LayoutState` | p1 | not started | All per-pane migrations above | Remove `dockview-react` dep, replace `LayoutState.dockviewModel` in `@tinker/shared-types` with `WorkspaceState<TinkerPaneData>`, add one-shot schema migration (drop old snapshots). |

### Host-service split ([[11-host-service]] per [[D17]])

| Task | Priority | Status | Depends on | Notes |
|------|----------|--------|------------|-------|
| Scaffold `packages/host-service` + `createHostApp()` | p1 | not started | — | Health + `host.info` only. Hono-based. PSK auth. No business logic yet. |
| Intrinsic `hostId` generator + manifest persistence | p1 | not started | host-service scaffold | `~/.tinker/host-identity.json`, `~/.tinker/manifests/<hostId>.json`. |
| Rust `HostCoordinator` (spawn / adopt / release) | p1 | not started | manifest persistence | See [[11-host-service]] §Coordinator. No mutate-then-call per [[D22]]. |
| Migrate `@tinker/scheduler` under host-service | p1 | not started | Rust coordinator | Expose scheduler actions over host-service endpoints. |
| Migrate memory + vault indexing | p1 | not started | scheduler migrated | `packages/memory` becomes host-service-internal. |
| Move OpenCode sidecar lifecycle inside host-service | p1 | not started | memory migrated | Rust stays as the launcher; orchestration moves to TS. |
| Scaffold `packages/host-client` (typed RPC + WS) | p1 | not started | host-service scaffold | Fetch wrapper + WS client. Used by device renderer instead of direct OpenCode calls. |
| Split `@tinker/bridge` → `@tinker/chat-client` + `@tinker/host-client` | p2 | not started | host-client scaffold | Leave a thin compatibility shim behind until renderer fully migrates. |

### Attention + workspace sidebar ([[12-attention-coordinator]] + [[13-workspace-sidebar]])

| Task | Priority | Status | Depends on | Notes |
|------|----------|--------|------------|-------|
| Scaffold `packages/attention` + store | p2 | not started | [[10-tinker-panes]] | Flash decision rules per [[12-attention-coordinator]]. Unit tests cover the decision table exhaustively. |
| Hook attention into `@tinker/panes` pane frames | p2 | not started | attention scaffold | Pane edge ring + tab dot subscribe. |
| Scaffold `packages/workspace-sidebar` | p2 | not started | attention scaffold | Vertical card list, metadata rows, drag reorder. |
| Expose workspace metadata API over host-service | p2 | not started | host-service scaffold + workspace-sidebar | `POST /workspace.metadata` from contributors; `GET /workspace.cards` for the sidebar. |
| Shell composition: WorkspaceSidebar + Workspace + Titlebar | p2 | not started | workspace-sidebar scaffold | Replace current `Workspace.tsx` shell layout. |

### Chat + boot UX ([[14-session-history-windowing]] + [[15-connection-gate]] + [[D20]])

| Task | Priority | Status | Depends on | Notes |
|------|----------|--------|------------|-------|
| `useSessionHistoryWindow` hook | p2 | not started | Chat migration | Bounded render window per [[14-session-history-windowing]]. |
| `ConnectionGate` component | p2 | not started | host-client scaffold | Splash + retry per [[15-connection-gate]]. |
| `ask_user` overlay component | p2 | not started | Chat migration | Per [[D20]]. Keyboard-navigable. |
| Chat pane wires `ask_user` events through overlay | p2 | not started | overlay component | Host-service emits `ask_user` events over SSE; Chat pane renders overlay. |

## Cross-cutting / Infrastructure

| Task | Priority | Status | Notes |
|------|----------|--------|-------|
| Design `<Textarea>` primitive + migrate raw textarea surfaces | p2 | review | Follow-up to [[09-design-system]] so Chat composer, Scheduler prompt, Dojo skill body, and MarkdownEditor stop shipping raw `<textarea>` elements. `[2026-04-20]` `@tinker/design` now exports `<Textarea>` and playground covers it. |
| Tauri sidecar lifecycle (start/health-check/stop OpenCode) | p1 | in progress | PRD §2.1, §2.2; adopt two-phase readiness + proxy-safe loopback health checks from [[opencode-desktop-review]] |
| FirstRun UX (sign-in → vault choice → workspace) | p1 | not started | PRD runtime flow "First launch" |
| Memory injection in bridge package | p1 | in progress | PRD §2.4 — `packages/bridge` |
| Vault indexing to SQLite (entities + FTS) | p1 | not started | PRD §2.4 |
| Today pane (recent entities view) | p2 | not started | PRD §2.5 default layout |
| System keychain OAuth token storage | p1 | not started | CLAUDE.md §5 Security |
| Startup loading orchestration (fast path + migration gate) | p1 | not started | Add delayed loading window only for long SQLite/bootstrap operations; avoid blocking happy path startup (from [[opencode-desktop-review]]) |
| Desktop deep-link reliability pass (OAuth callback queueing) | p1 | not started | Buffer deep links before renderer listeners mount to prevent callback races on cold launch (from [[opencode-desktop-review]]) |
| Renderer persistence durability (debounced writes + lifecycle flush + memory fallback) | p2 | not started | Harden local store behavior when plugin store unavailable/corrupt; preserve usability offline/failure states (from [[opencode-desktop-review]]) |
| Desktop operator recovery controls (restart sidecar, diagnostics, update trigger) | p2 | not started | Add explicit recovery actions in app menu/Settings to shorten failure-to-recovery loop (from [[opencode-desktop-review]]) |

## Deferred (not v1)

| Task | Priority | Reason |
|------|----------|--------|
| Slack-native presence / Slackbot | p3 | See [[decisions]] — defer; Slack as MCP only |
| Mobile dispatch / headless mode | p3 | PRD §6 non-goal |
| Multi-provider model support | p3 | PRD §6 non-goal |
| Enterprise SSO (Okta/SAML) | p3 | PRD §6 non-goal; revisit on enterprise ask |
| Latent Briefing / KV cache compaction | rejected | See [[decisions]] — requires self-hosted model; wrong for nontechnical UX |
| Cloud sync | rejected | Local-first principle |

## How to Update This File

- **Starting a feature** → change status to `in progress`, add your session ID in Notes if helpful
- **Blocking on a decision** → change status to `blocked`, add the open question to `product/decisions.md` Open Questions section
- **Completing a feature** → change status to `done`, update the matching `features/NN-*.md` with a completion timestamp
- **Adding new work not in the table** → append a row with a rationale; if it's a significant feature, also create `features/NN-*.md`
