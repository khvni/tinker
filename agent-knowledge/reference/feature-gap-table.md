---
type: concept
tags: [tinker, comparison, features]
---

# Feature Gap Table — Claude Code vs Cowork vs Glass vs Tinker

Detailed comparison of what each product provides. Use this when deciding scope for a specific feature.

## Legend

- ✅ = First-class feature, fully implemented
- ⚠️ = Partial / requires user setup / individual-level only
- ❌ = Not present

## Comparison Matrix

| Capability | Claude Code | Claude Cowork | Ramp Glass | Tinker (target) |
|---|---|---|---|---|
| **Auth / Connectors** | | | | |
| SSO sign-in | ❌ (API key only) | ⚠️ (Anthropic account) | ✅ (Okta) | ✅ (Better Auth: Google + GitHub + Microsoft) |
| Pre-wired integrations on sign-in | ❌ | ⚠️ (per-connector setup) | ✅ (30+ tools auto) | ✅ (MCP servers in `opencode.json`) |
| Custom connector config | ✅ (MCP JSON) | ⚠️ (UI-limited) | ✅ (internal MCP) | ✅ (`opencode.json`) |
| **Skills** | | | | |
| Personal skills | ✅ (SKILL.md) | ✅ | ✅ | ✅ |
| Org-shared skill marketplace | ❌ | ❌ | ✅ (Dojo, Git-backed) | ✅ (Playbook — vault + optional Git sync) |
| Skill versioning | ⚠️ (manual git) | ❌ | ✅ (Git-backed, reviewed) | ✅ (via vault) |
| Skill discovery / recommendation | ❌ | ❌ | ✅ (Sensei) | ✅ (Coach-lite) |
| **Memory** | | | | |
| Per-project memory | ✅ (CLAUDE.md) | ✅ (Projects) | ✅ | ✅ (vault + SQLite) |
| Self-building memory pipeline | ❌ | ❌ | ✅ (24hr synthesis) | ✅ (scheduled entity extraction) |
| Cross-session memory | ✅ (context/ files) | ✅ | ✅ | ✅ |
| **Orchestration** | | | | |
| Sub-agents | ✅ (AGENTS.md) | ✅ | ✅ | ✅ (OpenCode primitives) |
| Multi-tool orchestration | ⚠️ (manual) | ✅ | ✅ | ✅ |
| KV cache compaction (Latent Briefing) | ❌ | ❌ | ⚠️ (research only) | ❌ (out of scope) |
| **Automation** | | | | |
| Native scheduler | ❌ | ✅ (recurring tasks) | ✅ (cron → Slack) | ✅ (cron → vault/notify) |
| Slack-native bots | ⚠️ (via MCP) | ⚠️ (Slack connector) | ✅ (first-class) | ❌ (deferred) |
| Mobile dispatch | ❌ | ✅ | ✅ (headless mode) | ❌ (not v1) |
| **UI / Workspace** | | | | |
| CLI / terminal | ✅ | ❌ | ❌ | ❌ (though OpenCode CLI still available) |
| Chat GUI | ❌ | ✅ | ✅ | ✅ |
| Split-pane workspace | ❌ | ⚠️ (basic) | ✅ (code-editor style) | ✅ (`@tinker/panes`, per D16) |
| Layout persistence | ❌ | ⚠️ | ✅ | ✅ (SQLite) |
| Inline rendering (md/CSV/code) | ❌ (terminal) | ✅ | ✅ | ✅ (React components) |
| **Platform / Deployment** | | | | |
| Local-first | ✅ | ⚠️ (needs Anthropic account) | ⚠️ (needs Ramp Okta) | ✅ (fully local) |
| Open source | ❌ | ❌ | ❌ | ✅ (MIT) |
| User-owned data | ⚠️ | ⚠️ | ❌ (Ramp-owned) | ✅ (vault on disk) |
| Self-hostable | n/a | ❌ | n/a | ✅ (desktop app) |

## Tinker's Scope Filter

**Build** (moat features):
- SSO via Better Auth (Google + GitHub + Microsoft) → pre-wired MCP integrations
- Playbook skill marketplace ([[02-playbook-skill-marketplace]])
- Coach skill discovery ([[05-coach-skill-discovery]])
- Self-building memory pipeline
- Native scheduler
- Sub-agent orchestration
- Workspace persistence (Dockview)

**Defer** (valuable but not v1):
- Slack-native presence (MCP-level only for now)
- Mobile dispatch

**Reject** (out of scope):
- Latent Briefing (requires owning the inference runtime; we delegate to OpenCode)
- Our own provider / model-auth layer (OpenCode owns this; Tinker ships a GUI model picker over OpenCode's SDK)
- Cloud sync (local-first principle)
- Enterprise SSO / SAML / SCIM (consumer OSS scope; lives in enterprise forks per D1 / D8)

## Connections
- [[positioning]]
- [[decisions]]
- [[ramp-glass]]
- [[claude-cowork]]
