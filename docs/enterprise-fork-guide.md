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

### Step 8 — Distribute the Fork

Build signed installers for your org:
- macOS: Apple Developer ID + notarization
- Windows: Authenticode signing
- Linux: your distro's packaging + signing

Push through your normal corporate distribution channel (Intune, Jamf, internal app store, etc.).

---

## Alternative: Okta with XAA

Okta's Cross App Access (XAA) uses a different protocol (ID-JAG / Identity Assertion JWT) but same architectural pattern:

1. Register Tinker as an **OIDC Native Application** in Okta Admin Console
2. Enable PKCE + loopback redirect
3. Configure XAA connections for each SaaS app your employees use
4. In your fork, add `adapters/okta-xaa.ts` implementing `FederationAdapter`
5. XAA token exchange uses Okta's `/oauth2/v1/token` with `grant_type=urn:ietf:params:oauth:grant-type:token-exchange`

Detailed Okta docs: https://developer.okta.com/docs/guides/

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
