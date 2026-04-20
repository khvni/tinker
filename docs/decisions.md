# Architectural Decisions

Public log of major architectural decisions with reasoning. Full decision history lives in [`agent-knowledge/product/decisions.md`](../agent-knowledge/product/decisions.md); this is the stabilized summary.

---

## Auth Architecture (April 2026)

### D1. Consumer-first OSS, enterprise fork path preserved
Upstream Tinker targets consumer solo users (Gmail/Microsoft/GitHub personal). Enterprise adoption is supported via fork guides, not built into upstream.

### D2. Better Auth for identity
Free, self-hosted, TypeScript-native. WorkOS/Clerk/Auth0 solve problems (SCIM, SAML routing, audit logs, compliance certs) that local-first desktop apps don't have. Paying for them would be unsustainable for OSS.

### D3. Vendor-agnostic contracts
`IdentitySession`, `FederationAdapter`, `IntegrationCredentialStore` are TypeScript interfaces, not vendor SDKs. Enterprise forks can swap Better Auth for WorkOS/Clerk/Auth0 if compliance forces it.

### D4. Public OAuth client + PKCE everywhere
No `client_secret` ever shipped in desktop binary. Any user can extract it — fundamentally insecure. Entra, Google, GitHub all support public client + PKCE; this is the only path.

### D5. OS keychain is the sole secret store
Refresh tokens, access tokens, anything bearer-equivalent → OS keychain via `tauri-plugin-keyring`. Never files, never SQLite, never config.

### D6. Identity and integration are separate layers
User session has different lifecycle than integration tokens. Better Auth handles identity; a separate `IntegrationCredentialStore` handles per-service OAuth tokens. Not mixed.

### D7. Per-service JIT consent for consumer
When agent first needs a service, modal asks user for OAuth consent. One-time click per service, silent refresh forever after. No first-run wizard (preserves "open and use" principle).

### D8. Enterprise fork pattern = org-deploys + single-tenant
Enterprise dev talks to IT once: register app in Entra, grant admin consent, ship fork with `client_id` baked in. Users click sign-in, everything connects silently. Never ask non-technical users to register their own Entra apps.

### D9. Cross-tenant integration forbidden
If user logs in with work Microsoft, only work apps auto-connect. Personal apps (personal GitHub, personal Notion) require separate OAuth. Clean work/personal separation simplifies compliance.

### D10. MCP-only integrations
Every integration is an MCP server. No bespoke Gmail/Calendar/Slack clients. MCP is the shared substrate.

### D11. Disconnect is narrow by default
"Disconnect Notion" revokes connection only. Derived data (memory entities, vault files) stays. Separate explicit "Wipe Notion data" action for nuclear cleanup. Never silent data loss.

### D12. Memory entities carry provenance
Every memory entity has `sources: Array<{service, ref, lastSeen}>`. Enables clean wipes (filter entities whose sources array becomes empty) and prevents orphaned graph edges.

### D13. Vault layout separation
`<vault>/` top-level is user-authored — never touched by agent automation. `.tinker/mirrors/<service>/` is app-owned, wipeable on disconnect. Invariant preserved forever.

---

## Historical Decisions

### `[2026-04-14]` No Latent Briefing (KV cache compaction)
Requires self-hosting a worker model with direct KV cache access. Tinker's target users don't have A100s. GPT-5.4 via Codex OAuth is the default path — no KV cache exposure there.

### `[2026-04-14]` No Slack-native presence
Slack is one MCP integration among many. Most nontechnical teams use Teams, Google Chat, or mixed stacks. Slack-first would be premature specialization.

### `[2026-04-14]` No local-model pull via Ollama in first-run
Model downloads (7–30GB) destroy "open the app and start working" flow. GPT-5.4 via Codex OAuth is default. Power users can configure alternate models in `opencode.json`.

### `[2026-04-14]` No mobile dispatch in v1
Out of scope per PRD. Desktop-first, local-first. Mobile is a convenience, not a capability gap.

### `[2026-04-14]` Rust stays thin
Rust: sidecar lifecycle, OAuth loopback, keychain, OS-level scheduling. Everything else: TypeScript. Never move business logic into Rust.

---

## Connections

- Full decision log: [`agent-knowledge/product/decisions.md`](../agent-knowledge/product/decisions.md)
- Auth architecture details: [`./auth-architecture.md`](./auth-architecture.md)
- Enterprise fork guide: [`./enterprise-fork-guide.md`](./enterprise-fork-guide.md)
