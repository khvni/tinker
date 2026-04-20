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

### `[2026-04-19]` D1 — Consumer-first OSS, enterprise fork path preserved
- **Decision**: Upstream Tinker targets consumer solo users (Gmail/Microsoft/GitHub personal). Enterprise adoption via fork + docs guide, not built into upstream.
- **Why**: User's personal IP ownership; Keysight-style forks add their own compliance/federation without polluting upstream.
- **How to apply**: Never mention specific enterprises by name upstream. Use "enterprise adopters" / "your org". Enterprise-specific features = TODO markers for forks.

### `[2026-04-19]` D2 — Better Auth for identity
- **Decision**: Better Auth is the identity provider for upstream OSS and recommended default for enterprise forks. WorkOS/Clerk/Auth0 NOT adopted.
- **Why**: Local-first desktop app doesn't need SaaS-enterprise features (SCIM, SAML, audit logs, compliance certs). Free + self-hosted + TS-native aligns with local-first principle.
- **How to apply**: If enterprise fork's compliance team mandates WorkOS/Clerk/Auth0, they swap `packages/auth-sidecar/src/main.ts`. Vendor-agnostic contracts (D3) make swap localized.

### `[2026-04-19]` D3 — Vendor-agnostic contracts
- **Decision**: `IdentitySession`, `FederationAdapter`, `IntegrationCredentialStore`, `ServiceCredential` are TypeScript interfaces, not vendor SDK types.
- **Why**: Protects against vendor lock-in; enables swaps without cascading rewrites.
- **How to apply**: If adding a new vendor integration, model its output to fit these contracts — don't leak vendor-specific fields.

### `[2026-04-19]` D4 — Public OAuth client + PKCE everywhere
- **Decision**: No `client_secret` ever embedded in desktop binary. All OAuth flows use PKCE.
- **Why**: Desktop binaries are extractable — any client_secret in code is a public secret.
- **How to apply**: Entra apps must have "Allow public client flows" = Yes. Google Cloud OAuth client type = "Desktop app". Never commit secrets to `opencode.json`.

### `[2026-04-19]` D5 — OS keychain as sole secret store
- **Decision**: Refresh tokens, access tokens, and all bearer-equivalent credentials live only in OS keychain via `tauri-plugin-keyring`.
- **Why**: OS-level encryption; survives filesystem snapshots; user-transparent.
- **How to apply**: Never write tokens to files, SQLite, or config. Metadata (scopes, status, timestamps) may live in SQLite; tokens themselves may not.

### `[2026-04-19]` D6 — Identity and integration are separate layers
- **Decision**: Better Auth handles user identity; `IntegrationCredentialStore` handles per-service tokens. Do not combine.
- **Why**: Lifecycles differ — user session = minutes to hours; integration refresh tokens = weeks to months. Coupling = wrong invalidation behavior.
- **How to apply**: When adding a new integration, store its tokens via `IntegrationCredentialStore`, not via Better Auth's session store.

### `[2026-04-19]` D7 — Per-service JIT consent for consumer
- **Decision**: Consumer users consent per-service at first-use moment, not in a first-run wizard.
- **Why**: Preserves "open app → immediately useful" principle. Wizards feel like Glass-style setup friction we're avoiding.
- **How to apply**: Agent emits `needs_connection` event; UI renders modal; user consents; flow continues. One-time click per service, silent every launch after.

### `[2026-04-19]` D8 — Enterprise fork pattern: org-deploys + single-tenant
- **Decision**: Enterprise fork pattern: one dev + IT admin configure the fork once (app registration, admin consent). Users click sign-in, silent federation. Nontechnical users never register Entra apps.
- **Why**: Scales to every employee with zero per-user setup. Matches Glass's Ramp-wide Okta model.
- **How to apply**: `docs/enterprise-fork-guide.md` is the canonical recipe. Multi-tenant Entra apps only when fork explicitly supports multi-org distribution.

### `[2026-04-19]` D9 — Cross-tenant integration forbidden
- **Decision**: If user logs in with work Microsoft, only work apps can auto-connect. Personal apps need separate OAuth.
- **Why**: Compliance — enterprise tenants don't allow arbitrary external integrations. Prevents accidental work-data leakage to personal services.
- **How to apply**: Federation adapter scopes tokens to the logged-in tenant only. Personal services fall through to per-service OAuth.

### `[2026-04-19]` D10 — MCP-only integrations (reaffirmed)
- **Decision**: Reaffirmation of existing rule. Every integration is an MCP server. No bespoke clients.
- **Why**: Glass + Anthropic both bet on MCP. Building custom clients = duplicate work + maintenance burden.
- **How to apply**: New integration = new MCP server config in `opencode.json`. Never add a custom TypeScript/Rust API wrapper.

### `[2026-04-19]` D11 — Disconnect is narrow by default
- **Decision**: "Disconnect Notion" revokes connection only. Memory entities + mirrored vault files persist. Separate "Wipe Notion data" action handles nuclear cleanup.
- **Why**: Matches user mental model ("disconnect" ≠ "delete"). Avoids accidental data loss + reconnect-friendly.
- **How to apply**: Settings UI shows "Disconnect" as primary action; "Wipe data" as secondary with entity/file counts + irreversibility warning.

### `[2026-04-19]` D12 — Memory entity provenance required
- **Decision**: Every memory entity + relationship carries `sources: Array<{service, ref, lastSeen}>`. Enables clean wipes.
- **Why**: Without provenance, nuclear wipe either deletes too much (wipe cross-referenced entity that also has Slack source) or leaves orphaned edges.
- **How to apply**: Extraction pipeline must tag every entity + edge with its source. Wipe = filter sources array; entity dies only if array empties.

### `[2026-04-19]` D13 — Vault layout separation
- **Decision**: `<vault>/` top-level is user-authored, never touched by agent. `.tinker/mirrors/<service>/` is app-owned and wipeable.
- **Why**: User trust — a disconnect wipe must never delete user's own notes, even if those notes happened to mention content from the disconnected service.
- **How to apply**: Mirror files written by the app go exclusively into `.tinker/mirrors/<service>/`. Top-level edits are user-only territory.

## Open Questions (not yet decided)

- **Scheduler implementation**: in-process TypeScript cron vs. OS-level (launchd/Task Scheduler/systemd). Leaning in-process for cross-platform simplicity; revisit when app sleep/wake behavior is tested.
- **Dojo skill storage**: vault filesystem (human-readable, Git-friendly) vs. SQLite (faster queries). Leaning vault for human readability; Sensei can build an SQLite index on top.
- **Memory pipeline trigger**: time-based (every 24hr) vs. event-based (on tool use) vs. hybrid. Glass uses time-based; Tinker likely hybrid — daily sweep + incremental on tool use.

## Connections
- [[vision]]
- [[positioning]]
- [[ramp-glass]]
- [[06-subagent-orchestration]] — where Latent Briefing would have lived
