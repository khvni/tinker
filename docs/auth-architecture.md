# Auth Architecture

How Tinker handles identity (who is logged in) and integration credentials (tokens for connected tools). Two separate layers, joined by a vendor-agnostic adapter pattern.

---

## TL;DR

- **Identity layer** — Better Auth sidecar. User logs in via Google / Microsoft / GitHub. Returns `{userId, provider, providerAccessToken}`.
- **Integration layer** — Per-service OAuth tokens stored in OS keychain. Silent refresh on launch. Never mixed with the identity session.
- **Federation layer** — Abstract interface (`FederationAdapter`) that enables enterprise forks to add silent token exchange (Entra OBO, Okta XAA) without changing downstream code.
- **Proxy** — One persistent MCP connection per service, multiplexed across chat sessions.

Result: consumer UX = one-time OAuth per service, zero clicks every launch after. Enterprise fork UX = one SSO click, all federated services lit silently.

---

## Design Principles

1. **Identity and integration are different lifecycles.** A user session is minutes to hours. An integration token (refresh) lasts weeks to months. Don't couple them.
2. **OS keychain is the only secret store.** Refresh tokens, access tokens, anything bearer-equivalent. Never touch files, SQLite, or config.
3. **Public OAuth clients only.** Desktop apps cannot safely embed `client_secret` — any user can extract it from the binary. All flows use PKCE (Proof Key for Code Exchange). No `client_secret` anywhere in shipped code.
4. **Vendor-agnostic contracts.** Identity provider is swappable (Better Auth today, WorkOS/Clerk tomorrow if compliance forces it). Federation provider is swappable (none today, Entra/Okta later). Contracts in TypeScript types, not vendor SDKs.
5. **Consumer default = per-service consent.** No enterprise admin, so each user consents once per service. Silent refresh thereafter.
6. **Enterprise fork default = admin consent.** Org IT admin pre-approves the app once. Every user silently federates.

---

## Layers

### 1. Identity Layer

Lives in `packages/auth-sidecar/`. Node.js process launched by Tauri on startup.

**Responsibility:** Know who is logged in to Tinker itself.

**Providers supported:**
- Google (consumer Gmail, Workspace)
- Microsoft (personal MSA + Entra `common` endpoint)
- GitHub

**Does NOT handle:**
- Per-service OAuth tokens (e.g., Notion, Slack, Linear)
- Token refresh for integrations
- MCP connection lifecycle

**Output contract:**
```ts
type IdentitySession = {
  userId: string
  provider: 'google' | 'microsoft' | 'github'
  providerAccessToken: string    // for OBO in enterprise forks
  providerRefreshToken: string
  expiresAt: string
}
```

This contract is vendor-agnostic. Swapping Better Auth for WorkOS later requires rewriting `main.ts` inside the sidecar, nothing else.

### 2. Integration Credential Store

Lives in `packages/auth-sidecar/src/credentials.ts`.

**Responsibility:** Hold per-service refresh tokens, mint fresh access tokens on demand.

**Shape:**
```ts
interface IntegrationCredentialStore {
  // Get a valid access token for a service.
  // Silently refreshes if expired.
  // Throws if service not connected.
  get(service: string): Promise<string>

  // Store tokens after OAuth consent completes.
  store(service: string, tokens: {
    refreshToken: string
    accessToken: string
    expiresAt: string
    scopes: string[]
  }): Promise<void>

  // Revoke + delete. Called on disconnect.
  revoke(service: string): Promise<void>

  // List all connected services (for Settings UI).
  list(): Promise<IntegrationStatus[]>
}
```

**Storage:**
- Refresh tokens → OS keychain via `tauri-plugin-keyring`, keyed by `(userId, service)`
- Access tokens → in-memory cache with TTL; never persisted
- Metadata (scopes, last refresh timestamp, status) → SQLite

### 3. Federation Adapter

Lives in `packages/auth-sidecar/src/federation.ts`.

**Responsibility:** Enable silent token exchange for services federated to the user's IdP. Consumer ships a no-op; enterprise fork adds real adapters.

**Interface:**
```ts
interface FederationAdapter {
  // Can this service be authenticated silently via the user's IdP?
  canFederate(service: string): boolean

  // Exchange the user's IdP token for a service-specific token.
  // Only called when canFederate returns true.
  exchangeForService(
    userIdpToken: string,
    service: string
  ): Promise<ServiceCredential>
}
```

**Implementations:**

| Adapter | Ships in | Behavior |
|---|---|---|
| `PerServiceOAuthAdapter` | Consumer default | `canFederate()` always false. Forces per-service OAuth flow. |
| `EntraOBOAdapter` | Enterprise fork | `canFederate()` true for M365-federated services. Exchanges user's Entra access token via OBO flow for downstream service token. |
| `OktaXAAAdapter` | Future enterprise fork | Same shape using Okta's ID-JAG / XAA protocol. |

**Why this matters:** The proxy and self-healing layers downstream don't care how a credential was obtained. They call `IntegrationCredentialStore.get(service)`. If the adapter produced it via OBO silently, great. If the user did full OAuth last week, also great. Credential source is abstracted away.

### 4. MCP Proxy Singleton

Lives in `packages/bridge/src/mcpProxy.ts` *(to be built — see feature 08 in `agent-knowledge/features/`)*.

**Responsibility:** One persistent connection per MCP server, multiplexed per session.

**Boot sequence:**
1. Parse `opencode.json` for MCP server list + required scopes per server
2. For each server:
   - Try `FederationAdapter.canFederate(service)` — if yes, silent exchange, open connection
   - Else try `IntegrationCredentialStore.get(service)` — if token exists, silent refresh, open connection
   - Else mark "needs consent" — show connect button in UI; defer connection until user clicks
3. Hold all live connections
4. Hand out session-scoped wrappers to each chat

**Target latency:** Cold start → first-prompt-ready ≤ 3s with 10+ MCP servers (adopting Glass's benchmark).

### 5. Self-Healing Layer

**Responsibility:** Detect integration failures, auto-recover when possible, prompt user in plain language when not.

**Failure handling:**

| Symptom | Action |
|---|---|
| `401` from service | `IntegrationCredentialStore.get(service)` → forces refresh → retry |
| Refresh returns `invalid_grant` | Mark "needs reconnect", show banner: "Reconnect [Service]" |
| Service `5xx` / timeout | Yellow banner: "[Service] is having trouble. Retrying..." — exponential backoff |
| Network offline | Pause proxy, resume when network returns |

---

## Consent UX

### Consumer (default)

**Just-in-time consent.** When the agent first needs a service not yet connected:
1. Agent emits `needs_connection` event with service name + required scopes
2. UI renders modal: "Tinker wants to connect to [Service]. Grant access?"
3. User clicks → OS browser opens → OAuth flow → callback to Tauri
4. `IntegrationCredentialStore.store(service, tokens)` persists refresh token
5. Proxy opens MCP connection
6. Agent resumes with the tool available

First-time cost per service: one OAuth click. Amortized to zero on every subsequent launch forever (silent refresh).

### Enterprise fork (recommended)

**Admin consent at org level.** Org IT admin registers the fork's client_id in their IdP (Entra, Okta), grants admin consent once, publishes the app to employees. Employees:
1. Open app → "Sign in with [Org SSO]" → redirects to IdP → authenticates
2. Fork's federation adapter runs OBO/XAA exchange for every configured service
3. All federated services light up silently, no consent screens

See [enterprise-fork-guide.md](./enterprise-fork-guide.md) for step-by-step.

---

## Security Posture

- OAuth tokens live ONLY in OS keychain
- No `client_secret` ever shipped in binary (public client + PKCE)
- MCP server processes receive tokens via env vars at spawn, never via IPC that logs
- Loopback OAuth callbacks use random ports to prevent collision
- Better Auth callback URIs are deterministic (`http://127.0.0.1:3147/api/auth/callback/{provider}`) for provider-console config stability
- External content from MCP servers is untrusted prompt input — sanitize and flag before rendering
- Refresh tokens re-encrypted at keychain layer (OS handles encryption)

---

## Disconnect & Data Wipe Semantics

**"Disconnect" (default, narrow):**
- Revoke refresh token at provider
- Clear from keychain
- Tear down MCP connection
- Derived data (memory entities, vault files) **stays**
- Reconnect → immediately useful with prior context intact

**"Wipe data" (explicit, nuclear, separate action):**
- All of the above, plus:
- Delete memory entities where `sources` contains only this service
- Filter `sources` array for entities with multiple sources; entity survives if ≥1 source remains
- Delete `.tinker/mirrors/<service>/` directory
- Re-sync memory to repair orphaned graph edges
- User-authored notes in top-level vault **never touched**

This requires provenance on every memory entity: `sources: Array<{service, ref, lastSeen}>`. See [feature 03 spec](../agent-knowledge/features/03-memory-pipeline.md).

---

## Provider Reference

### Google OAuth
- **Endpoint:** `https://accounts.google.com/o/oauth2/v2/auth`
- **Public client:** Supported via PKCE
- **Callback:** `http://127.0.0.1:3147/api/auth/callback/google`
- **Min scopes:** `openid email profile`
- **Integration scopes (Gmail/Calendar/Drive):** `https://www.googleapis.com/auth/gmail.readonly`, `.../calendar.readonly`, `.../drive.readonly`

### Microsoft (consumer MSA + Entra common)
- **Endpoint:** `https://login.microsoftonline.com/common/oauth2/v2.0/authorize`
- **Public client:** Yes — Entra app registration must enable "Allow public client flows"
- **Callback:** `http://127.0.0.1:3147/api/auth/callback/microsoft`
- **Min scopes:** `openid email profile offline_access`
- **Enterprise fork:** Swap `common` for tenant UUID; add `User.Read` + M365 scopes

### GitHub
- **Endpoint:** `https://github.com/login/oauth/authorize`
- **Public client:** GitHub supports "GitHub Apps" or OAuth apps; Tinker uses OAuth app with PKCE
- **Callback:** `http://127.0.0.1:3147/api/auth/callback/github`
- **Min scopes:** `read:user user:email`
- **Integration scopes (repos/issues):** `repo` or fine-grained alternatives

---

## Why Better Auth (and not WorkOS/Clerk/Auth0)

Tinker is local-first OSS desktop. WorkOS, Clerk, and Auth0 are designed for SaaS companies selling enterprise features (SCIM, SAML, audit logs, compliance certs). None of those features apply to a local-first desktop app with no central backend.

Better Auth is:
- Free + MIT-licensed (critical for OSS sustainability)
- Self-hosted (runs as local sidecar, matches local-first principle)
- TypeScript-native (fits our stack)
- Vendor-swappable (our `IdentitySession` contract is vendor-agnostic)

See [research in agent-knowledge](../agent-knowledge/reference/auth-vendor-evaluation.md) for full comparison.

**If an enterprise fork's compliance team mandates WorkOS/Clerk/Auth0**, swap is local to `packages/auth-sidecar/src/main.ts`. Better Auth has a [documented migration guide](https://better-auth.com/docs/guides/workos-migration-guide). Costs: one sidecar rewrite, forced re-auth for all users (standard migration behavior).

---

## Related

- [Enterprise fork guide](./enterprise-fork-guide.md)
- [Decisions log](./decisions.md)
- [Feature 01 — SSO Connector Layer](../agent-knowledge/features/01-sso-connector-layer.md) (agent-facing WIP spec)
- [Feature 08 — MCP Proxy Layer](../agent-knowledge/features/08-mcp-proxy-layer.md) (agent-facing WIP spec)
