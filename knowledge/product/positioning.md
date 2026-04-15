---
type: concept
tags: [tinker, positioning, strategy]
---

# Tinker Positioning

Tinker is **not** open-source Claude Cowork. Tinker **is** open-source Ramp Glass. This distinction drives every feature scope decision.

## Why the Distinction Matters

- `[2026-04-14]` Cowork = general-purpose GUI over Claude Code → individual accessibility → competes with Claude Code CLI users
- `[2026-04-14]` Glass = organizational compounding → SSO, shared skills, auto-memory → competes with nothing (internal tool)
- `[2026-04-14]` Building "open-source Cowork" = picking a fight with Anthropic on features; no moat since SSO is table stakes
- `[2026-04-14]` Building "open-source Glass" = filling actual whitespace; Dojo flywheel + Sensei + auto-memory is real product moat

## Feature Gap Table (high level — see [[feature-gap-table]] for detail)

| Feature | Claude Code | Claude Cowork | Ramp Glass | Tinker |
|---|---|---|---|---|
| SSO → pre-wired integrations | ❌ (manual MCP) | ⚠️ (connectors, but per-user setup) | ✅ (Okta → 30+ tools) | ✅ (Google + GitHub OAuth) |
| Org skill marketplace (Dojo) | ❌ | ⚠️ (personal skills only) | ✅ (350+ skills, Git-backed) | ✅ (local + optional Git sync) |
| Skill discovery (Sensei) | ❌ | ❌ | ✅ | ✅ |
| Self-building memory pipeline | ❌ | ⚠️ (projects remember what you feed them) | ✅ (24hr synthesis) | ✅ (scheduled entity extraction) |
| Native scheduler | ❌ | ✅ (recurring tasks) | ✅ (cron → Slack) | ✅ (cron → vault/notify) |
| Sub-agent orchestration | ⚠️ (manual) | ✅ | ✅ | ✅ (OpenCode primitives) |
| Workspace persistence (split-pane) | ❌ (terminal) | ⚠️ (chat UI) | ✅ (code-editor layout) | ✅ (Dockview) |
| Mobile dispatch | ❌ | ✅ | ✅ (headless mode) | ❌ (not v1) |
| Slack-native presence | ❌ | ❌ | ✅ | ❌ (deferred — see [[decisions]]) |
| Latent Briefing (KV cache compaction) | ❌ | ❌ | ⚠️ (research — not shipped) | ❌ (out of scope — see [[decisions]]) |

## Tinker's Moat

- `[2026-04-14]` **SSO + pre-wired integrations** — zero-config day-1 experience for nontechnical users
- `[2026-04-14]` **Dojo skill flywheel** — one team member's breakthrough becomes everyone's baseline
- `[2026-04-14]` **Self-building memory pipeline** — context accumulates without users having to curate it
- `[2026-04-14]` **Openness** — enterprises fork and add their own connectors without handing over their moat

## Target User Segmentation

- `[2026-04-14]` **Primary**: small-to-mid teams (5–200 people) where leadership wants Glass-style adoption but can't afford a 4-person internal AI platform team
- `[2026-04-14]` **Secondary**: enterprise teams who want to fork + customize for their own integrations (the "white-label Glass" play)
- `[2026-04-14]` **Tertiary**: individual power users who want a GUI over OpenCode with persistence

## What Tinker is NOT

- `[2026-04-14]` **NOT a cloud SaaS** — local-first, user-owned; no hosted backend, nothing to subscribe to
- `[2026-04-14]` **NOT multi-provider from day 1** — GPT-5.4 via Codex OAuth is the v1 path (per PRD)
- `[2026-04-14]` **NOT a chat window** — workspace is pane-based (Dockview), not chat-only
- `[2026-04-14]` **NOT a replacement for OpenCode** — it wraps OpenCode; power users can always drop to the CLI

## Connections
- [[vision]] — The why
- [[decisions]] — Architectural decisions log
- [[feature-gap-table]] — Detailed feature comparison
- [[ramp-glass]] — Full Glass reference
- [[claude-cowork]] — Cowork overview
