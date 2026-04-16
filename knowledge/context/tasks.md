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
| 04 | Native scheduler (cron-style scheduled prompts) | p1 | review | [[04-native-scheduler]] | In-process scheduler with SQLite-persisted job definitions |
| 05 | Sensei skill discovery (recommend skills based on role + connected tools) | p2 | not started | [[05-sensei-skill-discovery]] | Depends on Dojo being built first |
| 06 | Sub-agent orchestration (OpenCode-native multi-agent patterns) | p2 | not started | [[06-subagent-orchestration]] | Use OpenCode SDK sub-agent primitives; no Latent Briefing (see [[decisions]]) |
| 07 | Workspace persistence + split-pane UI (Dockview) | p1 | review | [[07-workspace-persistence]] | Debounced layout save, version-gated hydration with default fallback, agent-created files auto-open via Chat stream → Workspace dispatcher; follow-ups landed: auto-open toggle in Settings, multi-session chat tabs, syntax-highlighted code tabs, file-open helper tests, bridge stream coverage |

## Cross-cutting / Infrastructure

| Task | Priority | Status | Notes |
|------|----------|--------|-------|
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
