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
- `[2026-04-14]` Building "open-source Glass" = filling actual whitespace; Playbook flywheel + Coach + auto-memory is real product moat (renamed `[2026-04-20]` per [[decisions]] D24; Ramp's Dojo/Sensei = Tinker's Playbook/Coach)

## Feature Gap Table (high level — see [[feature-gap-table]] for detail)

| Feature | Claude Code | Claude Cowork | Ramp Glass | Tinker |
|---|---|---|---|---|
| SSO → pre-wired integrations | ❌ (manual MCP) | ⚠️ (connectors, but per-user setup) | ✅ (Okta → 30+ tools) | ✅ (Better Auth: Google + GitHub + Microsoft) |
| Org skill marketplace | ❌ | ⚠️ (personal skills only) | ✅ (Dojo, 350+ skills, Git-backed) | ✅ (Playbook, local + optional Git sync) |
| Skill discovery | ❌ | ❌ | ✅ (Sensei) | ✅ (Coach) |
| Self-building memory pipeline | ❌ | ⚠️ (projects remember what you feed them) | ✅ (24hr synthesis) | ✅ (scheduled entity extraction) |
| Native scheduler | ❌ | ✅ (recurring tasks) | ✅ (cron → Slack) | ✅ (cron → vault/notify) |
| Sub-agent orchestration | ⚠️ (manual) | ✅ | ✅ | ✅ (OpenCode primitives) |
| Workspace persistence (split-pane) | ❌ (terminal) | ⚠️ (chat UI) | ✅ (code-editor layout) | ✅ (`@tinker/panes`, per D16) |
| Mobile dispatch | ❌ | ✅ | ✅ (headless mode) | ❌ (not v1) |
| Slack-native presence | ❌ | ❌ | ✅ | ❌ (deferred — see [[decisions]]) |
| Latent Briefing (KV cache compaction) | ❌ | ❌ | ⚠️ (research — not shipped) | ❌ (out of scope — see [[decisions]]) |

## Tinker's Moat

- `[2026-04-14]` **SSO + pre-wired integrations** — zero-config day-1 experience for nontechnical users
- `[2026-04-14]` **Playbook skill flywheel** — one team member's breakthrough becomes everyone's baseline
- `[2026-04-14]` **Self-building memory pipeline** — context accumulates without users having to curate it
- `[2026-04-14]` **Openness** — enterprises fork and add their own connectors without handing over their moat

## Target User Segmentation

- `[2026-04-14]` **Primary**: small-to-mid teams (5–200 people) where leadership wants Glass-style adoption but can't afford a 4-person internal AI platform team
- `[2026-04-14]` **Secondary**: enterprise teams who want to fork + customize for their own integrations (the "white-label Glass" play)
- `[2026-04-14]` **Tertiary**: individual power users who want a GUI over OpenCode with persistence

## What Tinker is NOT

- `[2026-04-14]` **NOT a cloud SaaS** — local-first, user-owned; no hosted backend, nothing to subscribe to
- `[2026-04-14]` **NOT replicating OpenCode's model/provider surface** — Tinker wraps OpenCode's SDK with a GUI model picker. Whatever providers OpenCode supports (local via Ollama/LM Studio, cloud via Anthropic/OpenAI/etc.), Tinker exposes. We do not own model auth or routing.
- `[2026-04-14]` **NOT a chat window** — workspace is pane-based (`@tinker/panes`, per [[decisions]] D16), not chat-only
- `[2026-04-14]` **NOT a replacement for OpenCode** — it wraps OpenCode; power users can always drop to the CLI

## Connections
- [[vision]] — The why
- [[decisions]] — Architectural decisions log
- [[feature-gap-table]] — Detailed feature comparison
- [[ramp-glass]] — Full Glass reference
- [[claude-cowork]] — Cowork overview
