# Enterprise Fork Guide

How any enterprise adapts Tinker to their organization's identity provider (Entra ID, Okta, Google Workspace admin, etc.) with silent token exchange and admin-consented integrations.

> **Status of enterprise features in upstream Tinker:** The upstream OSS project is consumer-focused and does NOT ship enterprise federation implementations. Enterprise-specific code is a **TODO for your fork**. This guide tells you how to build it.
>
> **Upstream maintainer scope:** The upstream will maintain vendor-agnostic contracts (`FederationAdapter`, `IntegrationCredentialStore`, proxy singleton) and guarantee they stay stable for forks. Enterprise-specific adapters, tenant configurations, and compliance wiring are the fork's responsibility.

---

## When To Fork

Fork Tinker when your organization wants:
- Single-sign-on via your existing IdP (Entra, Okta, Google Workspace)
- Pre-consented integrations — employees don't see per-service consent screens
- Centralized audit/logging of who uses what
- Corporate compliance hooks (DLP, tenant restrictions)
- Pre-bundled internal CLIs or MCP servers specific to your company

Consumer OSS does NOT need these. Fork only if your org has a dedicated dev + IT admin willing to own setup.

---

## Ownership Model

```
┌─ Upstream Tinker (this repo) ─────────────────┐
│  Owner: project maintainer (personal IP)       │
│  License: MIT                                   │
│  Scope: consumer OSS + enterprise scaffolding   │
│  Provides: FederationAdapter interface,         │
│            IntegrationCredentialStore contract, │
│            proxy singleton,                     │
│            per-service OAuth default flow       │
└─────────────────────────────────────────────────┘
                      ↓ git clone / fork
┌─ Your Enterprise Fork ────────────────────────┐
│  Owner: your organization (your IP)            │
│  License: your org's choice                    │
│  Scope: adapt upstream to your IdP + compliance │
│  Adds:   EntraOBOAdapter (or equivalent),       │
│          tenant-specific config,                │
│          bundled internal MCP servers,          │
│          company branding                       │
└─────────────────────────────────────────────────┘
```

**Critical:** Nothing in the upstream repo mentions your company by name. If you find something company-specific in upstream, it's a bug in the fork boundary — open an issue on upstream.

---

## Prerequisites

Before your dev starts:
- Admin access to your IdP (Entra/Okta/Google Workspace admin console)
- Decision from IT security: which IdP, what tenant model, what compliance scopes are allowed
- Decision from legal: license terms for your fork (upstream is MIT; you may apply stricter terms to your fork)

---

## Step-by-Step: Microsoft Entra ID

This walk-through shows Entra ID (aka Azure AD) for an enterprise fork. Okta and Google Workspace follow the same pattern with IdP-specific UIs.

### Step 1 — Fork the repo

```bash
# As your org's dev
git clone https://github.com/<upstream-tinker>/tinker.git tinker-<yourorg>
cd tinker-<yourorg>
git remote rename origin upstream
git remote add origin https://github.com/<yourorg>/tinker-<yourorg>.git
git push -u origin main
```

Keep `upstream` as a remote so you can pull future upstream changes.

### Step 2 — Register the App in Entra

In **Azure Portal → Microsoft Entra ID → App registrations → New registration**:

- **Name:** `Tinker for <YourOrg>` (or similar)
- **Supported account types:** "Accounts in this organizational directory only (Single tenant)"
  - Pick single-tenant unless you specifically need to support multiple orgs
- **Redirect URI:**
  - Platform: **Public client/native (mobile & desktop)**
  - URI: `http://127.0.0.1:3147/api/auth/callback/microsoft`
- Click **Register**

After registration:
- Copy the **Application (client) ID** — you'll need this
- Copy the **Directory (tenant) ID** — you'll need this

### Step 3 — Configure Authentication

In the app registration → **Authentication** tab:

- Under **Platform configurations**, ensure the redirect URI from Step 2 is listed
- Under **Advanced settings**:
  - **"Allow public client flows"** = **Yes**
  - This enables PKCE flow without requiring a client_secret (critical — never ship client_secret in a desktop binary)
- **Supported account types** should match what you set in Step 2

> **Tenant lock — endpoint.** Upstream Tinker points Microsoft OAuth at `https://login.microsoftonline.com/common/…` so personal + work + school accounts all work. An enterprise fork MUST swap `common` for the tenant UUID from Step 2 on every Microsoft endpoint (authorize, token, OBO, JWKS, discovery). Leaving `common` in place lets users from any Microsoft directory — including consumer `@outlook.com` accounts — complete sign-in against your app registration and then get a Graph token scoped to whatever directory they belong to. The tenant-scoped endpoint instructs Entra to refuse authentication from foreign directories before a token is ever minted. Grep your fork for `login.microsoftonline.com/common` and `/common/v2.0` after wiring — these are bugs in an enterprise build.

### Step 4 — Configure API Permissions + Admin Consent

In the app registration → **API permissions** tab:

- Add Microsoft Graph permissions for any M365 integrations you want federated:
  - `User.Read` (always, for user profile)
  - `Mail.Read` for Outlook integration
  - `Calendars.Read` for Teams Calendar
  - `Files.Read.All` for OneDrive
  - `Team.ReadBasic.All` for Teams
  - (Add any others your integrations require)
- Set each permission type to **Delegated** (not Application — we want user-scoped access)
- Click **"Grant admin consent for <YourOrg>"**

This one click pre-approves the app for every user in your tenant. After this, users see zero consent screens.

### Step 5 — Configure Your Fork

In your fork's `opencode.json`, update the `auth` section:

```json
{
  "auth": {
    "providers": {
      "microsoft": {
        "clientId": "<your-app-client-id-from-step-2>",
        "tenant": "<your-tenant-uuid-from-step-2>",
        "scopes": [
          "openid",
          "email",
          "profile",
          "offline_access",
          "User.Read"
        ]
      }
    }
  }
}
```

- Replace `<your-app-client-id-from-step-2>` with your Application (client) ID
- Replace `<your-tenant-uuid-from-step-2>` with your Directory (tenant) ID
- Add `scopes` for any Graph API calls your OBO adapter needs

**Do NOT commit a `client_secret`.** There is no client_secret in this flow — public client + PKCE.

### Step 6 — Implement the Federation Adapter

The adapter enforces two tenant-lock invariants before the OBO exchange runs:

1. **Endpoint tenant lock** — the OAuth token URL embeds `config.tenant`, not `common`. Entra refuses to mint tokens for users from other directories.
2. **Assertion `tid` claim equality** — the incoming user ID token MUST carry `tid === config.tenant`. The endpoint lock is sufficient when both hops run against the same Entra deployment, but `assertTenantLocked()` below defends against misconfiguration (another fork pointing at upstream's `common`, a dev proxy, or a rotated config). Treat it as a required belt-and-suspenders check, not optional. The same routine verifies `iss` and audience so a replayed token issued for a different app registration or tenant cannot be exchanged.

Create `packages/auth-sidecar/src/adapters/entra-obo.ts`:

```ts
import type { FederationAdapter, ServiceCredential } from '../federation'

// Services that live inside Entra / M365 and can be federated via OBO.
// Add your org's federated services here.
const FEDERATED_SERVICES = new Set([
  'teams',
  'outlook',
  'onedrive',
  'sharepoint',
  // Add internal services your org has published to Entra
])

type EntraIdTokenClaims = {
  tid: string
  iss: string
  aud: string
  exp: number
}

function decodeJwtClaims(token: string): EntraIdTokenClaims {
  const parts = token.split('.')
  if (parts.length !== 3) {
    throw new Error('Malformed assertion: expected a signed JWT')
  }
  const payload = parts[1]!.replace(/-/g, '+').replace(/_/g, '/')
  const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4)
  const json = Buffer.from(padded, 'base64').toString('utf8')
  const claims = JSON.parse(json) as Partial<EntraIdTokenClaims>
  if (
    typeof claims.tid !== 'string' ||
    typeof claims.iss !== 'string' ||
    typeof claims.aud !== 'string' ||
    typeof claims.exp !== 'number'
  ) {
    throw new Error('Assertion missing required claims (tid/iss/aud/exp)')
  }
  return claims as EntraIdTokenClaims
}

function assertTenantLocked(
  claims: EntraIdTokenClaims,
  config: { tenant: string; clientId: string }
): void {
  // Reject any incoming assertion whose `tid` does not match the
  // fork's configured tenant. Without this check, a token issued
  // by a different Entra directory (including consumer `9188040d-…`)
  // could reach the OBO endpoint and be exchanged for a Graph token
  // in that foreign directory.
  if (claims.tid !== config.tenant) {
    throw new Error(
      `Tenant mismatch: assertion tid=${claims.tid}, expected ${config.tenant}`
    )
  }
  const expectedIssuer = `https://login.microsoftonline.com/${config.tenant}/v2.0`
  if (claims.iss !== expectedIssuer) {
    throw new Error(
      `Issuer mismatch: assertion iss=${claims.iss}, expected ${expectedIssuer}`
    )
  }
  if (claims.aud !== config.clientId && claims.aud !== `api://${config.clientId}`) {
    throw new Error(
      `Audience mismatch: assertion aud=${claims.aud}, expected ${config.clientId}`
    )
  }
  if (claims.exp * 1000 <= Date.now()) {
    throw new Error('Assertion expired')
  }
}

export function createEntraOBOAdapter(config: {
  tenant: string
  clientId: string
}): FederationAdapter {
  return {
    canFederate(service: string): boolean {
      return FEDERATED_SERVICES.has(service)
    },

    async exchangeForService(
      userIdpToken: string,
      service: string
    ): Promise<ServiceCredential> {
      const claims = decodeJwtClaims(userIdpToken)
      assertTenantLocked(claims, config)

      const tokenUrl = `https://login.microsoftonline.com/${config.tenant}/oauth2/v2.0/token`

      const body = new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        client_id: config.clientId,
        assertion: userIdpToken,
        scope: `api://${service}/.default`,
        requested_token_use: 'on_behalf_of',
      })

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      })

      if (!response.ok) {
        throw new Error(`OBO exchange failed for ${service}: ${await response.text()}`)
      }

      const data = await response.json()
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? null,
        expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
        scopes: data.scope?.split(' ') ?? [],
      }
    },
  }
}
```

Wire it into your sidecar's federation layer:

```ts
// packages/auth-sidecar/src/main.ts
import { createEntraOBOAdapter } from './adapters/entra-obo'

const federationAdapter = createEntraOBOAdapter({
  tenant: config.auth.providers.microsoft.tenant,
  clientId: config.auth.providers.microsoft.clientId,
})
```

### Step 7 — Verify End-to-End

Checklist:
- [ ] User opens forked app → sees "Sign in with Microsoft" button
- [ ] Click redirects to your org's Entra sign-in page (not the generic Microsoft page)
- [ ] After login, no consent screens appear
- [ ] All federated services (Teams, Outlook, OneDrive, etc.) connect silently
- [ ] MCP server list in the UI shows all federated services as "connected" within 3 seconds of login
- [ ] Sign-in audit entry appears in Entra admin console
- [ ] Services NOT in `FEDERATED_SERVICES` (e.g., GitHub, personal Notion) still go through per-service OAuth
- [ ] Tenant lock — endpoint: `grep -r "login.microsoftonline.com/common" packages/ apps/` returns zero matches in your fork
- [ ] Tenant lock — assertion: a foreign-tenant ID token fed into `createEntraOBOAdapter({ tenant: '<yours>', clientId: '<yours>' }).exchangeForService(...)` throws `Tenant mismatch: …` before any network call (unit test recommended)

### Step 8 — Distribute the Fork

Build signed installers for your org:
- macOS: Apple Developer ID + notarization
- Windows: Authenticode signing
- Linux: your distro's packaging + signing

Push through your normal corporate distribution channel (Intune, Jamf, internal app store, etc.).

---

## Alternative: Okta OIDC (identity-only template)

This section is the fork template for **Okta OIDC as Tinker's identity provider**, mirroring the Entra walkthrough above. It covers app registration, scopes, redirect URI, and the Better Auth config snippet. Silent federation to downstream SaaS apps via **Okta Cross App Access (XAA)** is a separate adapter — see §"XAA federation" at the end.

Better Auth v1 has no built-in Okta provider, so forks wire Okta through the **`genericOAuth` plugin**. That plugin is a first-class Better Auth surface, not a workaround — it uses OIDC discovery + PKCE identically to the named providers.

### Step 1 — Fork the repo

Identical to the Entra walkthrough Step 1. Skip if already done.

### Step 2 — Register a Native OIDC app in Okta

In **Okta Admin Console → Applications → Applications → Create App Integration**:

- **Sign-in method:** OIDC - OpenID Connect
- **Application type:** **Native Application** (required — enables PKCE, disables client-secret requirement)
- **App integration name:** `Tinker for <YourOrg>`
- **Grant types:** tick **Authorization Code** and **Refresh Token** (both required)
- **Sign-in redirect URIs:** `http://127.0.0.1/auth/callback/okta` (see Step 4)
- **Sign-out redirect URIs:** leave empty unless your fork renders a post-logout page
- **Controlled access:** pick "Allow everyone in your organization to access" or a group — matches your tenant's policy

After save:
- Copy the **Client ID** (no client secret is issued for Native apps by default — that is correct per D4)
- Copy your **Okta domain** (e.g. `yourorg.okta.com` or `yourorg-admin.oktapreview.com`)

### Step 3 — Confirm PKCE + refresh-token settings

In the newly-created app → **General** tab → **Client Credentials**:

- **Client authentication:** `None` (public client)
- **Proof Key for Code Exchange (PKCE):** `Require PKCE as additional verification` → **Yes**

In **General** → **General Settings** → **Refresh Token**:

- **Refresh token behavior:** `Rotate token after every use` (recommended)
- **Grace period for token rotation:** 30 seconds (default is fine)

Missing any of these = token exchange fails with `invalid_client` or `invalid_grant`. Rebind them before moving on.

### Step 4 — Redirect URI format

Tinker uses loopback per RFC 8252 — Rust binds an ephemeral port per sign-in attempt ([[better-auth-config]] §4). Okta matches sign-in redirect URIs **by exact string**, not by RFC 8252 host-only rules, so the fork must register every URL its callbacks use:

| Scenario | Redirect URI to register in Okta |
|---|---|
| Development against a fixed port | `http://127.0.0.1:50739/auth/callback/okta` |
| Ephemeral ports (production) | Register one entry per port your fork pins, **or** deploy an Okta [Trusted Origin](https://developer.okta.com/docs/reference/api/trusted-origins/) covering the loopback range |
| Fork wanting the least-friction path | Pin one deterministic port in `apps/desktop/.env.local` + register that single URL |

The path suffix `/auth/callback/okta` is provider-scoped (see [[better-auth-config]] §3). Keep it stable across ports — the sidecar routes on path, not host.

### Step 5 — Configure your fork

Add Okta credentials to the env file your fork's sidecar reads (mirrors the upstream `packages/auth-sidecar/.env.local` layout — [[better-auth-config]] §8):

```env
# Okta OIDC — enterprise fork only
OKTA_OAUTH_CLIENT_ID=0oa…
OKTA_OAUTH_ISSUER=https://yourorg.okta.com/oauth2/default
OKTA_OAUTH_REDIRECT_URI=http://127.0.0.1:50739/auth/callback/okta
```

`OKTA_OAUTH_ISSUER` points at either the **default Authorization Server** (`/oauth2/default`) or a **Custom Authorization Server** (`/oauth2/<serverId>`). Use a custom server if your fork needs access-token claims scoped to specific API audiences.

### Step 6 — Wire the Better Auth `genericOAuth` plugin

Add the Okta block to your fork's `packages/auth-sidecar/src/main.ts`:

```ts
import { betterAuth } from 'better-auth';
import { genericOAuth } from 'better-auth/plugins';

export const auth = betterAuth({
  appName: 'Tinker',
  baseURL: `http://127.0.0.1:${authPort}`,
  secret: requiredEnv('TINKER_BETTER_AUTH_SECRET'),
  trustedOrigins: [`http://127.0.0.1:${authPort}`],
  plugins: [
    genericOAuth({
      config: [
        {
          providerId: 'okta',
          clientId:     requiredEnv('OKTA_OAUTH_CLIENT_ID'),
          clientSecret: '',                                   // Native app, public client
          discoveryUrl: `${requiredEnv('OKTA_OAUTH_ISSUER')}/.well-known/openid-configuration`,
          scopes: ['openid', 'profile', 'email', 'offline_access'],
          pkce: true,
          prompt: 'select_account',
        },
      ],
    }),
  ],
});
```

Scope map — OIDC identity only (matches the D25 "no integration scopes on sign-in" rule; parity with [[better-auth-config]] §7):

| Scope | Why it is on | When to drop |
|---|---|---|
| `openid` | Mandatory — marks the request as OIDC | Never |
| `profile` | Populates `displayName`, `avatarUrl` | If your fork only needs `userId` |
| `email` | Populates `email` + `emailVerified` | If your fork disallows email disclosure |
| `offline_access` | Required to receive a refresh token (D5 silent refresh) | Never, for Tinker |

Extra scopes like `groups`, `okta.users.read`, or anything prefixed with an API audience belong in a **separate** Okta app used by the `FederationAdapter` (§"XAA federation" below) — do not graft them onto sign-in.

### Step 7 — Verify end-to-end

Checklist (mirror of the Entra Step 7 checklist):
- [ ] User opens forked app → sees "Sign in with Okta" button wired to `genericOAuth` provider ID `okta`
- [ ] Click redirects to `https://<yourorg>.okta.com/oauth2/default/v1/authorize?...` with `code_challenge`, `code_challenge_method=S256`, `scope=openid profile email offline_access`
- [ ] After login, no consent prompts appear (Okta shows them only if the app or scopes aren't assigned)
- [ ] `/auth/callback/okta` returns a `code` + `state` pair that Better Auth exchanges for tokens
- [ ] `GET /auth/session` returns `authenticated: true` with a non-empty `tokens.refreshToken`
- [ ] Rust writes the refresh token to OS keychain under service `tinker-okta` (mirrors [[better-auth-config]] §6.2)
- [ ] Silent re-sign-in on cold launch succeeds without opening the browser
- [ ] `POST /auth/logout` clears both the sidecar session and the keychain entry
- [ ] Okta **System Log** shows the sign-in event (`user.session.start`) against the app you registered

### Step 8 — Distribute the fork

Identical to the Entra Step 8. Ship signed installers through your normal corporate distribution channel.

---

### XAA federation (optional post-template add-on)

Okta's **Cross App Access (XAA)** layers silent federation to downstream SaaS apps on top of the OIDC identity above. Protocol is **ID-JAG** (RFC 8693 token exchange with JWT assertions). The fork adds a second file:

1. Register each downstream SaaS app (Google Workspace, Slack, Zoom, internal APIs, etc.) as an **XAA Connection** under Okta Admin → **Security → API → Cross-App Access**.
2. Grant the Tinker Native app access to each connection.
3. In your fork, create `packages/auth-sidecar/src/adapters/okta-xaa.ts` implementing `FederationAdapter` (shape identical to `createEntraOBOAdapter` in Step 6 of the Entra walkthrough).
4. Token exchange endpoint: `https://<yourorg>.okta.com/oauth2/v1/token` with `grant_type=urn:ietf:params:oauth:grant-type:token-exchange`, `subject_token=<id_token_from_okta>`, `audience=<downstream-app-client-id>`.
5. Wire the adapter into your sidecar alongside the `genericOAuth` plugin.

Reference: [Okta XAA protocol docs](https://developer.okta.com/docs/concepts/cross-app-access/).

XAA is additive — the Step 2–6 template above gives you identity-only sign-in that works without it. Add XAA only when your fork is ready to own per-service federation on top.

---

## Alternative: SAML (ADFS, Shibboleth, legacy SAML apps)

If your IdP is SAML-only, or IT security mandates SAML for desktop apps, the integration shape is different: you **replace the Better Auth sidecar entirely** rather than layering a `FederationAdapter` on top. SAML assertions are XML artifacts, not bearer tokens, and can't be exchanged for downstream service credentials.

See the dedicated [SAML provider adapter guide](./saml-adapter.md) for library choice (`@node-saml/node-saml`), the sign-in flow, assertion validation checklist, and key-storage rules.

---

## Alternative: Google Workspace

Google Workspace uses OAuth 2.0 with admin-consented scopes via the Workspace Admin Console:

1. In **Google Cloud Console**, create an OAuth 2.0 Client of type **Desktop app**
2. In **Google Workspace Admin Console → Security → API controls → Domain-wide delegation**, add your app's client ID with required scopes
3. In your fork, `adapters/workspace-oauth.ts` uses standard OAuth 2.0 PKCE — Google Workspace admin consent eliminates the per-user consent screen once scopes are allowlisted at the domain level
4. Google does not have a single-exchange flow like OBO/XAA — each API call uses the access token granted at sign-in, scoped to allowlisted APIs

---

## Compliance Considerations

Your fork's responsibility:
- **Audit logging** — your IdP logs sign-ins centrally; add app-level logging for who ran what agent tool
- **Data residency** — all data stays local to the user's machine by default (vault + keychain). Confirm this satisfies your data-handling policies
- **DLP integration** — if your org requires DLP scanning of AI-generated content, wire into MCP middleware in the proxy
- **Tenant restrictions** — if users must only log in with corporate email, configure Entra conditional access policies or equivalent
- **Certificate pinning** — for high-security environments, pin TLS certs for your IdP domain at the HTTP client level

Upstream does not bake these in. Your fork adds what your security team requires.

---

## Upgrading from Upstream

Periodically pull upstream changes:

```bash
git fetch upstream
git merge upstream/main
# Resolve conflicts if upstream touched files you forked
```

**Conflict zones** (likely to need manual resolution):
- `packages/auth-sidecar/src/main.ts` — where you wired your adapter
- `opencode.json` — where you changed `auth.providers.microsoft` config
- Anywhere you added branding / enterprise copy to UI

Upstream guarantees the `FederationAdapter` and `IntegrationCredentialStore` interfaces stay backward-compatible. Your adapter implementations should not break on upgrade.

---

## FAQ

**Q: Can we use both upstream's per-service OAuth AND our OBO adapter together?**
Yes. `canFederate()` returning false falls through to the default per-service OAuth flow. Services not in your tenant's federation still work the normal consumer way.

**Q: What if our security team mandates WorkOS/Clerk/Auth0 instead of Better Auth?**
The `IdentitySession` contract is vendor-agnostic. Swap `packages/auth-sidecar/src/main.ts` to use the alternate library. Downstream code (`FederationAdapter`, `IntegrationCredentialStore`, proxy) doesn't change. Expect forced re-auth for users on the swap (normal auth-lib migration behavior — no lib exports password hashes).

**Q: Can we pre-bundle our internal CLIs / MCP servers?**
Yes. Add them to your fork's `opencode.json` mcp section. Users will have them available without individual install. This is a fork-only capability upstream consumer won't ship.

**Q: Do we need to open-source our fork?**
Upstream is MIT-licensed — you may apply stricter terms to your fork. Your fork's license is your call. The upstream maintainer retains personal ownership of the upstream repo and MIT license.

**Q: Our IT won't let us use a third-party auth library. Can we use our own internal auth service?**
Yes. Implement your internal auth as a custom replacement for the Better Auth sidecar. Return the same `IdentitySession` contract. Everything downstream works.

---

## Related

- [Auth architecture](./auth-architecture.md) — the contracts your fork implements
- [Decisions log](./decisions.md) — why certain choices were made upstream
- [Feature 01 — SSO Connector Layer](../agent-knowledge/features/01-sso-connector-layer.md) — upstream WIP spec
