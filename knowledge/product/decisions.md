---
type: concept
tags: [tinker, decisions, architecture]
---

# Tinker Architectural Decisions

Log of what's explicitly OUT of scope or deferred, with reasoning. Coding agents: check here before proposing anything listed below.

## Decisions Log

### `[2026-04-14]` — No Latent Briefing

- **Decision**: Do NOT implement [[Latent Briefing]] KV cache compaction in v1 (or v2). Optimize with simpler approaches (prompt caching, selective context passing) instead.
- **Why**: Latent Briefing requires direct KV cache access to the worker model, which means self-hosting a model (Ramp's setup: Claude orchestrator + Qwen3-14B on A100). Tinker's target user (nontechnical masses) does not have A100s, will not run Ollama, and should not be asked to pick a model tier. GPT-5.4 via Codex OAuth is the default path (per `tinker-prd.md`) — no KV cache exposure there.
- **Complexity cost**: implementing Latent Briefing means shipping a local GPU runtime + model-weight management → violates "complexity invisible, not absent" principle.
- **Exception**: if a hybrid stack emerges later (e.g., Tinker Enterprise edition) where self-hosting is tolerated, revisit. Not before.

### `[2026-04-14]` — Slack-native presence deferred

- **Decision**: No built-in Slackbot / channel listener in v1 or v2. Slack is a regular MCP integration, not a first-class Tinker surface.
- **Why**: Glass's Slack presence is huge at Ramp because Ramp lives in Slack. Most nontechnical teams Tinker targets use Teams, Google Chat, or mixed stacks. Building Slack-native first would be premature specialization.
- **Alternative**: Native scheduler ([[04-native-scheduler]]) posts outputs to vault + optional notification channels via MCP; Slack is one option, not the primary surface.

### `[2026-04-14]` — No local-model pull via Ollama in first-run path

- **Decision**: Tinker ships with GPT-5.4 via Codex OAuth as the default model. Do NOT auto-install Ollama / pull local models / assume GPU availability.
- **Why**: Nontechnical target users do not have strong laptop compute. Model downloads (7–30GB) destroy the "open the app and start working" flow. Fans spinning up = bad first impression.
- **Alternative**: Power users can configure a different model in `opencode.json` (OpenCode SDK supports this). First-run path uses hosted GPT.

### `[2026-04-14]` — SSO limited to Google + GitHub for v1

- **Decision**: v1 SSO supports Google OAuth (already in PRD) and GitHub OAuth. No Okta, no Azure AD, no SAML.
- **Why**: Enterprise SSO is in PRD §6 non-goals. Google covers Gmail/Calendar/Drive (the most common nontechnical-user tools) + most of Workspace-first companies. GitHub covers the developer sub-segment. These two unlock 80% of target integrations with minimal auth complexity.
- **Revisit**: If enterprise adopters ask for Okta/SAML, build then. Not speculatively.

### `[2026-04-14]` — No mobile dispatch in v1

- **Decision**: No mobile app, no remote trigger, no phone-to-desktop kickoff.
- **Why**: Out of scope per PRD. Desktop-first, local-first. Mobile dispatch is a Glass/Cowork convenience, not a capability gap.

### `[2026-04-14]` — No custom integration clients — MCP only

- **Decision**: Every integration is an MCP server configured in `opencode.json`. No bespoke TypeScript/Rust API wrappers for Gmail, Calendar, Linear, etc.
- **Why**: Already in CLAUDE.md. Reaffirmed here because pre-wired integrations are a Tinker moat and it's tempting to "just write a small wrapper for Gmail." Don't.

### `[2026-04-14]` — Rust stays thin

- **Decision**: Already in CLAUDE.md. Listed here because scheduler and memory pipeline might tempt agents to move work into Rust. Don't.
- **Boundary**: Rust handles sidecar lifecycle, OAuth loopback, keychain, and OS-level scheduling primitives (launchd/Task Scheduler bridge). Everything else is TypeScript.

## Open Questions (not yet decided)

- **Scheduler implementation**: in-process TypeScript cron vs. OS-level (launchd/Task Scheduler/systemd). Leaning in-process for cross-platform simplicity; revisit when app sleep/wake behavior is tested.
- **Dojo skill storage**: vault filesystem (human-readable, Git-friendly) vs. SQLite (faster queries). Leaning vault for human readability; Sensei can build an SQLite index on top.
- **Memory pipeline trigger**: time-based (every 24hr) vs. event-based (on tool use) vs. hybrid. Glass uses time-based; Tinker likely hybrid — daily sweep + incremental on tool use.

## Connections
- [[vision]]
- [[positioning]]
- [[ramp-glass]]
- [[06-subagent-orchestration]] — where Latent Briefing would have lived
