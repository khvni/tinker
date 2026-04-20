---
type: reference
tags: [auth, architecture, federation, oauth, pkce]
---

# Auth Architecture — Agent Reference

`[2026-04-19]` Detailed architecture reference for coding agents working on auth. Companion to public `docs/auth-architecture.md` — this adds sequence diagrams, edge cases, and implementation notes that human docs don't need.

> **Public version:** `docs/auth-architecture.md` is the authoritative public contract. This file is for agent-driven implementation work.

## Layer Map (Quick Reference)

```
┌─ Identity Layer (packages/auth-sidecar) ───────┐
│  Better Auth wraps Google/Microsoft/GitHub      │
│  Output: IdentitySession                        │
└─────────────────────────────────────────────────┘
                ↓
┌─ Federation Adapter (packages/auth-sidecar) ───┐
│  interface FederationAdapter                    │
│  Consumer: PerServiceOAuthAdapter (no-op)       │
│  Enterprise: EntraOBOAdapter / OktaXAAAdapter   │
└─────────────────────────────────────────────────┘
                ↓
┌─ IntegrationCredentialStore (sidecar/creds.ts) ┐
│  Per-service tokens in OS keychain              │
│  Silent refresh, TTL cache for access tokens    │
└─────────────────────────────────────────────────┘
                ↓
┌─ MCP Proxy Singleton (packages/bridge) ────────┐
│  One persistent conn per service                │
│  Session wrappers multiplex                     │
└─────────────────────────────────────────────────┘
                ↓
┌─ Self-Healing Layer (packages/bridge) ─────────┐
│  401 → refresh → retry                          │
│  Invalid grant → "reconnect" banner             │
│  5xx → yellow status + backoff                  │
└─────────────────────────────────────────────────┘
```

## Sequence: Consumer First-Time Service Connect (JIT)

```
User            UI              Agent           Sidecar         Service
 │               │                │                │                │
 │  "check my   │                │                │                │
 │   Notion"   │                │                │                │
 │──prompt────>│                │                │                │
 │              │──prompt───────>│                │                │
 │              │                │──needs_tool────│                │
 │              │                │   "notion"     │                │
 │              │                │                │                │
 │              │                │ IntegrationCredStore.get("notion")│
 │              │                │────────────────>│               │
 │              │                │   throws: NOT_CONNECTED         │
 │              │                │<────────────────│               │
 │              │                │                │                │
 │              │<-needs_connection               │                │
 │              │   {service:"notion",            │                │
 │              │    scopes:[...]}                │                │
 │              │                │                │                │
 │  modal:      │                │                │                │
 │  "connect    │                │                │                │
 │   Notion?"   │                │                │                │
 │<─────────────│                │                │                │
 │──click yes─>│                │                │                │
 │              │──open OAuth URL────────────────>│                │
 │              │                │                │──auth_code────>│
 │              │                │                │   request      │
 │              │                │                │<──callback w/──│
 │              │                │                │   code         │
 │              │                │                │──exchange─────>│
 │              │                │                │   code + PKCE  │
 │              │                │                │<──tokens───────│
 │              │                │                │                │
 │              │          IntegrationCredStore.store(notion,tokens)│
 │              │                │                │                │
 │              │          Proxy.connect("notion") → MCP live      │
 │              │                │                │                │
 │              │<─connected─────│                │                │
 │              │──resume───────>│                │                │
 │              │                │──now has tool──│                │
 │              │                │   calls Notion│                │
 │              │                │   MCP          │                │
```

## Sequence: Enterprise Fork Login + Silent Federation

```
User        UI          Sidecar         Entra         Service(s)
 │           │             │              │              │
 │ open app  │             │              │              │
 │ ──────────>             │              │              │
 │           │── "sign in" ─>             │              │
 │           │             │──auth_req───>│              │
 │                                        │              │
 │     (user enters corp creds in Entra)  │              │
 │                                        │              │
 │           │             │<──id_token+──│              │
 │           │             │   access_tok │              │
 │           │             │              │              │
 │           │ federationAdapter.canFederate(service) loop │
 │           │             │              │              │
 │           │ (for each: teams/outlook/onedrive/...)    │
 │           │             │──OBO exchange>              │
 │           │             │──(user_tok, scope:svc)──>│  │
 │           │             │<──svc_access_tok─────────│  │
 │           │             │                             │
 │           │ IntegrationCredStore.store(service, tok)  │
 │           │ Proxy.connect(service) → MCP live         │
 │           │             │              │              │
 │           │<─ all lit ──│              │              │
 │  "ready"  │             │              │              │
 │<──────────│             │              │              │
```

Elapsed: ≤3s cold start → ≤10 MCP services live (target per Glass parity).

## Sequence: Silent Refresh on Expiry

```
Agent           Sidecar                          Service
 │                │                                │
 │ tool call      │                                │
 │ ──────────────>│                                │
 │                │  IntegrationCredStore.get(svc)│
 │                │  ── cached access_tok expired ─│
 │                │                                │
 │                │──refresh_token──────────────> │
 │                │   (no UI, background)         │
 │                │<──new access_tok──────────────│
 │                │  ── cache update ──           │
 │                │                                │
 │                │──tool call with new tok──────>│
 │                │<──result──────────────────────│
 │<───result──────│                                │
```

Failure mode: refresh returns `invalid_grant` → emit `reconnect_required` event → UI banner → user re-does OAuth (rare, days-months apart).

## Public Client + PKCE — Implementation Notes

### Why no client_secret
Desktop binaries can be decompiled. Any embedded secret = extractable. Entra and Google Cloud Console now ship "public client" mode specifically for this reason. Ship `client_id` (non-sensitive) in config, use PKCE (cryptographic challenge) to prove identity at token exchange.

### PKCE flow steps
1. App generates random `code_verifier` (43-128 chars)
2. App computes `code_challenge = BASE64URL(SHA256(code_verifier))`
3. Auth request includes `code_challenge` + `code_challenge_method=S256`
4. User authenticates at provider
5. Provider returns `authorization_code` to loopback `http://127.0.0.1:<port>/callback`
6. App exchanges `authorization_code` + `code_verifier` (proving it originated the challenge) for tokens
7. No client_secret involved

### Entra-specific gotchas
- Must enable **"Allow public client flows"** in app registration → Advanced settings
- If this flag is off, Entra rejects PKCE flows with `invalid_client`
- Single-tenant apps: use `https://login.microsoftonline.com/{tenant-uuid}/...`
- Multi-tenant: use `common` or `organizations` — NOT for Keysight-style single-org forks
- Personal MSA consumer: use `consumers` endpoint

### Google-specific gotchas
- `access_type=offline` required to get refresh_token on first consent
- `prompt=consent` required to force re-prompt if refresh_token is missing
- Scope grants are additive across consents — requesting new scope triggers partial consent screen

### GitHub-specific gotchas
- GitHub OAuth apps don't natively return refresh_tokens in some configs
- Use fine-grained Personal Access Tokens or GitHub Apps for server-side scenarios
- For desktop, OAuth app with device flow is alternative to PKCE

## Token Storage Details

### Keychain schema
```
service:  tinker-{userId}
account:  integration-{service-name}
password: JSON({
  refreshToken: string,
  scopes: string[],
  issuedAt: string,   // ISO timestamp
})
```

Notes:
- One keychain entry per (user, service) pair
- Access tokens NEVER stored in keychain — only refresh tokens + metadata
- Access tokens live in sidecar memory, TTL-expired per `expires_at` from provider

### SQLite schema (integration metadata)
```sql
CREATE TABLE integrations (
  user_id       TEXT NOT NULL,
  service       TEXT NOT NULL,
  connected_at  TEXT NOT NULL,
  last_refresh  TEXT,
  last_error    TEXT,
  scopes        TEXT,              -- JSON array
  status        TEXT NOT NULL,     -- 'connected' | 'needs_reconnect' | 'expired'
  PRIMARY KEY (user_id, service)
);
```

No tokens in SQLite. Only metadata for the Settings UI to show status.

## Federation Adapter Reference Implementation

See `docs/enterprise-fork-guide.md` for the canonical EntraOBOAdapter example. Key points for agents:

- Adapter is a **pure function module**, not a class with state
- `canFederate()` must be synchronous — called often during proxy boot
- `exchangeForService()` must handle transient failures (network, 5xx) with retry + backoff
- Returns must match `ServiceCredential` shape exactly — no vendor-specific fields leaked

## Edge Cases to Handle

### User signs out of IdP mid-session
- Proxy's MCP connections tied to federation tokens become invalid
- Next tool call → 401 → refresh → refresh fails (no IdP session)
- Emit `session_expired` event → force re-auth UI
- Clear integration credential cache, keep refresh tokens in keychain (user may sign back in)

### User switches accounts (logs out of Google personal, in to Google Workspace)
- Different `userId` → different keychain namespace
- Previous account's keychain entries remain (not a security issue — still OS-protected)
- Settings UI should show "You're logged in as X now. Y's connections are on Y's profile."

### Provider revokes refresh token server-side
- Admin force-revoke, password change, token age limit
- Next silent refresh returns `invalid_grant`
- UI shows "Reconnect [Service]" — user runs OAuth flow again

### Offline mode at launch
- Sidecar detects network offline at boot
- Skip silent refresh; use cached access tokens if valid
- Mark services as "offline" in UI, retry silently when network returns
- Don't force user to do anything

### Concurrent refresh attempts
- Multiple tool calls hit 401 simultaneously
- Must dedupe refresh requests per service
- Pattern: refresh promise cached per service while in-flight; subsequent callers await same promise

## Common Mistakes

- ❌ Embedding `client_secret` in `opencode.json` or binary
- ❌ Using Better Auth's session store for integration tokens (wrong lifecycle, wrong encryption)
- ❌ Logging raw tokens in agent transcripts
- ❌ Calling MCP server with expired access token (should always go through IntegrationCredentialStore)
- ❌ Hardcoding a specific provider in `FederationAdapter` logic (breaks multi-provider support)
- ❌ Assuming refresh_token never expires (they do, weeks-months, provider-dependent)

## Connections
- [[01-sso-connector-layer]] — feature spec
- [[08-mcp-proxy-layer]] — proxy architecture
- [[decisions]] — D1–D13 architectural commitments
- [[auth-vendor-evaluation]] — why Better Auth
