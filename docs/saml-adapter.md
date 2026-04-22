# SAML Provider Adapter (Enterprise Fork Guide)

How an enterprise fork replaces Tinker's upstream Better Auth social providers with a SAML 2.0 flow against a corporate IdP (ADFS, Shibboleth, legacy single-tenant Okta / Ping / OneLogin SAML apps).

> **Fork-only.** Upstream Tinker does NOT ship SAML. Per [D1](./decisions.md) / [D8](./decisions.md), enterprise federation lives in forks. Consumer identity is Google + GitHub + Microsoft OIDC via Better Auth (see [auth-architecture.md](./auth-architecture.md)).
>
> **When to use this doc:** your org's IdP is SAML-only, or your IT security team mandates SAML for desktop apps. If your IdP supports OIDC, prefer the [Entra OBO path](./enterprise-fork-guide.md#step-by-step-microsoft-entra-id) — it plugs into Tinker's existing `FederationAdapter` contract without replacing the identity layer.
>
> **What this doc is NOT:** a SAML specification tutorial. It assumes familiarity with SAML 2.0 Web Browser SSO, assertion structure, and metadata exchange. SAML-level references linked at the end.

---

## Why SAML is different

Tinker's existing enterprise path (Entra OBO / Okta XAA) layers on top of Better Auth: the user completes an OIDC login, then a `FederationAdapter` exchanges the resulting IdP token for downstream service tokens. That shape works because OIDC access tokens are bearer credentials the IdP can exchange.

SAML doesn't fit the same shape:

- **Unit of auth is an XML assertion**, not a bearer token. Assertions expire quickly (minutes), are audience-restricted to the SP that requested them, and cannot be "exchanged" for arbitrary service tokens.
- **Federated SSO to downstream apps** works by the user re-authenticating to each SAML SP separately via the IdP (IdP-initiated or SP-initiated flow per app), not by token exchange. The user never sees this because the IdP holds the session cookie.
- **No refresh token concept.** Re-authentication means another browser round-trip to the IdP.

The practical consequence: a SAML fork **replaces the Better Auth sidecar entirely** with a SAML-capable sidecar. It does not add a `SAMLFederationAdapter` class alongside `EntraOBOAdapter`. The `IdentitySession` contract stays the same; everything downstream (`IntegrationCredentialStore`, the MCP proxy, per-service OAuth for non-federated services) is unchanged.

```
┌─ Upstream Tinker ──────────────────────────────┐
│  packages/auth-sidecar/src/main.ts              │
│    ↓ Better Auth, Google/GitHub/Microsoft OIDC  │
│  returns IdentitySession                        │
└─────────────────────────────────────────────────┘
                       ↓ fork replaces
┌─ Your SAML Fork ────────────────────────────────┐
│  packages/auth-sidecar/src/main.ts              │
│    ↓ @node-saml/node-saml, your IdP's metadata  │
│  returns IdentitySession (same contract)        │
└─────────────────────────────────────────────────┘
```

---

## Library choice

**Reference recommendation: [`@node-saml/node-saml`](https://github.com/node-saml/node-saml)**.

- Maintained successor to `passport-saml` (same maintainers, passport-agnostic API).
- TypeScript types published.
- HTTP-Redirect + HTTP-POST bindings supported.
- Signature validation, audience restriction, `NotBefore` / `NotOnOrAfter` checks, subject-confirmation built in.
- Accepts IdP metadata XML directly (no hand-extracted certs).
- MIT-licensed.

Alternatives considered:

| Library | Status | Notes |
|---|---|---|
| `passport-saml` | superseded | Use `@node-saml/node-saml` directly — skip the Passport layer. |
| `saml2-js` | inactive | Last meaningful release 2020. Prior CVEs. Avoid. |
| `samlify` | maintained | Alternative if you prefer its API. Heavier metadata tooling; also supports SAML 1.1 + WS-Federation. Defensible choice if your IdP ecosystem needs either. |
| `@authenio/samlify-node-xmllint` | supplement | Schema validator companion to `samlify`. Add if you pick `samlify`. |

Your fork, your choice. The rest of this doc uses `@node-saml/node-saml` in examples.

---

## Architectural overview

### The sidecar swap

Upstream's `packages/auth-sidecar/src/main.ts` stands up Better Auth + Google/GitHub/Microsoft OIDC providers and exposes:

- `POST /desktop/sign-in/:provider?appCallback=…&ticket=…` — starts OAuth
- `GET /desktop/finish` — finishes OAuth, stores a short-TTL ticket
- `GET /desktop/session?ticket=…` — renderer exchanges ticket for the `IdentitySession`
- `POST /auth/logout` / `GET /health`

Your fork replaces this file. The **public HTTP surface stays identical** so the Tauri shell and renderer code upstream don't need to change. Inside the sidecar, Better Auth is replaced by `@node-saml/node-saml`.

### The flow

```
┌─────────┐   1. POST /desktop/sign-in/saml         ┌──────────────┐
│ Renderer│ ──────────────────────────────────────▶ │ SAML Sidecar │
└─────────┘   (appCallback loopback, ticket)        └──────────────┘
                                                           │
                                                           │ 2. Build AuthnRequest, sign if IdP requires
                                                           │    Redirect to IdP SSO URL
                                                           ▼
                                                    ┌────────────┐
                                                    │  OS Browser│
                                                    └────────────┘
                                                           │
                                                           │ 3. User authenticates at IdP
                                                           ▼
                                                    ┌────────────┐
                                                    │   IdP SSO  │
                                                    └────────────┘
                                                           │
                                                           │ 4. POST SAMLResponse to ACS URL
                                                           ▼
┌─────────┐                                          ┌──────────────┐
│ Renderer│  7. GET /desktop/session?ticket=…        │ SAML Sidecar │
└─────────┘ ◀──────────────────────────────────────── └──────────────┘
       ▲            IdentitySession payload                 │
       │                                                    │ 5. Validate assertion
       │                                                    │ 6. Store transfer record
       └── 302 to appCallback?ticket=…  ◀──────────────────┘
```

Steps 1, 6, 7 match upstream's ticket-exchange shape exactly. Steps 2–5 are SAML-specific.

---

## Step-by-step: wire a SAML fork

Assumes you've already followed the fork-and-distribute scaffolding in [enterprise-fork-guide.md](./enterprise-fork-guide.md) Steps 1 and 8. The middle steps below replace Steps 2–7 for SAML.

### Step 1 — Register Tinker as a SAML SP with your IdP

Collect from the IdP admin console:

- **IdP SSO URL** (where AuthnRequests are sent) — e.g., `https://idp.yourorg.com/adfs/ls/` or `https://yourorg.okta.com/app/<app-id>/sso/saml`.
- **IdP entity ID** — unique identifier the IdP uses for itself (often the SSO URL).
- **IdP signing certificate** — x509 used to sign assertions. Get the metadata XML if available; it carries the cert plus endpoints and saves transcription errors.
- **Name ID format** — recommend `urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress` or `…:persistent`. Do not use `…:transient` — Tinker needs a stable identifier across sessions.
- **Attribute statements** — which attributes the IdP will include (email, display name, groups). Map these to your `User` row.

Give the IdP admin:

- **SP entity ID** — pick a stable URN, e.g., `urn:tinker:<yourorg>:desktop`. Do NOT use an http(s) URL unless your IdP requires one.
- **Assertion Consumer Service (ACS) URL** — `http://127.0.0.1:3147/desktop/saml/acs`. Yes, loopback. Your IdP may complain; most modern IdPs allow loopback SPs for native apps. If yours does not, see [Loopback vs hosted SP](#loopback-vs-hosted-sp) below.
- **Binding** — HTTP-POST for the response (ACS), HTTP-Redirect for the request.
- **Signing expectations** — require signed assertions. Require signed responses if the IdP supports it. Sign AuthnRequests if the IdP's SAML profile requires it (ADFS typically does).

### Step 2 — Generate SP signing keys (only if you sign AuthnRequests)

```bash
openssl req -x509 -newkey rsa:2048 -keyout sp-private.pem -out sp-cert.pem -days 3650 -nodes -subj "/CN=tinker-<yourorg>"
```

Store the private key **in OS keychain** on each user's machine (see Step 6). Do not commit it. The public cert goes to the IdP admin during SP registration.

### Step 3 — Replace `packages/auth-sidecar/src/main.ts`

Install the library in your fork:

```bash
pnpm -F @tinker/auth-sidecar add @node-saml/node-saml
```

Rewrite `packages/auth-sidecar/src/main.ts` to stand up the SAML sidecar. Minimal shape (error handling + logging omitted for clarity — your fork must add both):

```ts
import { createServer } from 'node:http';
import { SAML } from '@node-saml/node-saml';

const authPort = Number(process.env.TINKER_AUTH_PORT ?? 3147);
const bridgeSecret = requireEnv('TINKER_BETTER_AUTH_BRIDGE_SECRET');
const baseURL = `http://127.0.0.1:${authPort}`;

const saml = new SAML({
  issuer: requireEnv('TINKER_SAML_SP_ENTITY_ID'),
  callbackUrl: `${baseURL}/desktop/saml/acs`,
  entryPoint: requireEnv('TINKER_SAML_IDP_SSO_URL'),
  idpIssuer: requireEnv('TINKER_SAML_IDP_ENTITY_ID'),
  cert: requireEnv('TINKER_SAML_IDP_CERT'),
  identifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
  acceptedClockSkewMs: 5_000,
  wantAuthnResponseSigned: true,
  wantAssertionsSigned: true,
  signatureAlgorithm: 'sha256',
  disableRequestedAuthnContext: false,
  // Sign AuthnRequests only if the IdP requires it.
  privateKey: process.env.TINKER_SAML_SP_PRIVATE_KEY,
  // Pin replay protection: assertion IDs seen recently.
  validateInResponseTo: 'always',
  requestIdExpirationPeriodMs: 10 * 60 * 1000,
  cacheProvider: makeInMemoryCache(), // replace with durable cache for multi-instance forks
});

// Map renderer-initiated sign-in → browser redirect to IdP.
// { appCallback, ticket } mirror upstream's shape.
app.post('/desktop/sign-in/saml', async (request) => {
  const appCallback = readLoopbackCallback(request);
  const ticket = readTicket(request);
  rememberTicket(ticket, appCallback);
  const redirectUrl = await saml.getAuthorizeUrlAsync(
    /* RelayState */ ticket,
    /* host */ baseURL,
    /* options */ {},
  );
  return redirect(redirectUrl);
});

// IdP POSTs the SAMLResponse here. Validate, store transfer record, 302 back to app.
app.post('/desktop/saml/acs', async (request) => {
  const form = await readUrlEncodedBody(request);
  const relayState = form.get('RelayState');
  const ticketEntry = consumeTicket(relayState);
  if (!ticketEntry) {
    return errorPage(400, 'unknown_ticket');
  }

  try {
    const { profile, loggedOut } = await saml.validatePostResponseAsync({
      SAMLResponse: form.get('SAMLResponse'),
    });
    if (loggedOut || !profile) {
      return errorPage(401, 'assertion_invalid');
    }

    const payload = toIdentitySession(profile);
    storeTransfer(relayState, payload);
    return redirect(appendTicket(ticketEntry.appCallback, relayState));
  } catch (error) {
    return errorPage(401, describeSamlError(error));
  }
});

// Renderer exchanges ticket for IdentitySession. Bridge-secret-gated.
app.get('/desktop/session', (request) => {
  requireBridgeSecret(request, bridgeSecret);
  const ticket = readTicket(request);
  const payload = consumeTransfer(ticket);
  if (!payload) {
    return json(404, { error: 'ticket_expired' });
  }
  return json(200, payload);
});
```

The `IdentitySession` shape returned from `toIdentitySession(profile)` matches upstream (see [auth-architecture.md](./auth-architecture.md#output-contract)) so the renderer and downstream storage paths stay byte-for-byte identical.

### Step 4 — Map SAML attributes to `IdentitySession`

```ts
function toIdentitySession(profile: Profile): IdentitySession {
  const userId = profile.nameID;
  const email = profile.email ?? profile.nameID;
  const displayName =
    profile.displayName ??
    [profile.firstName, profile.lastName].filter(Boolean).join(' ') ||
    email;

  return {
    provider: 'saml',
    userId,
    email,
    displayName,
    avatarUrl: null,
    // SAML has no bearer tokens. Fields kept to satisfy the shape.
    accessToken: '',
    refreshToken: '',
    expiresAt: (profile.sessionNotOnOrAfter ?? defaultExpiry()).toISOString(),
    scopes: [],
  };
}
```

Key points:

- `userId = nameID` gives you a stable per-user ID (assuming you configured `emailAddress` or `persistent` name ID — not `transient`).
- `accessToken` / `refreshToken` stay empty for SAML. The `FederationAdapter` interface downstream will return `false` from `canFederate()` for every service — all MCP integrations fall through to per-service OAuth, or to a different fork-specific federation path (e.g., a SAML-authenticated internal gateway).
- `expiresAt` comes from `SessionNotOnOrAfter` on the authentication statement. If your IdP omits it, pick a short default (≤8 hours) and force re-auth.

### Step 5 — Assertion validation checklist

`@node-saml/node-saml` enforces these when configured correctly. **Audit each one before shipping.** Any missing check ≠ SAML, it's trust-the-post.

- [ ] **XML signature on the Response or Assertion** verified against the IdP cert. (`wantAuthnResponseSigned: true` and/or `wantAssertionsSigned: true`.)
- [ ] **Signature covers the assertion you're actually consuming** (prevents XML signature wrapping). The library handles this; do not post-process the parsed profile by re-reading the raw XML.
- [ ] **Audience restriction** = your SP entity ID. (Automatic when `issuer` is set.)
- [ ] **`Destination` attribute** on the Response = your ACS URL. (Automatic.)
- [ ] **`NotBefore` / `NotOnOrAfter`** on `Conditions` honoured, with `acceptedClockSkewMs` ≤ 5s. Don't raise this past 60s without a reason written down.
- [ ] **Subject confirmation** is `bearer` with `NotOnOrAfter`, `Recipient` = ACS URL, `InResponseTo` matches an AuthnRequest ID you issued in the last 10 min. (`validateInResponseTo: 'always'` plus a cache provider.)
- [ ] **Assertion ID replay protection**: cache every accepted assertion ID for at least the `NotOnOrAfter` window. `@node-saml/node-saml`'s `cacheProvider` handles this; use a durable cache (SQLite / Redis) if your fork runs the sidecar as a multi-instance service. For single-user desktop installs, the in-memory cache is fine — the sidecar only validates assertions for one user in one session window.
- [ ] **IdP-initiated SSO disabled by default.** Require `InResponseTo` so assertions without a matching AuthnRequest are rejected. IdP-initiated flows are a common CSRF vector for SAML SPs; only enable them if your IdP explicitly requires it and you've accepted the threat model.
- [ ] **Algorithm allowlist**: sha256 or stronger for signatures. Reject sha1. (`signatureAlgorithm: 'sha256'` plus `@node-saml/node-saml`'s refusal to accept MD5 / weak signatures by default.)

If `@node-saml/node-saml` throws during `validatePostResponseAsync`, **do not catch it into success**. Fail closed — return a loopback error page that tells the Tauri renderer the sign-in failed, do not set a session.

### Step 6 — Key + secret storage

- **SP private key** (only if signing AuthnRequests): stored per-machine in OS keychain via the existing Rust keychain bridge (`tauri-plugin-keyring`). At sidecar startup, Rust reads it and injects as `TINKER_SAML_SP_PRIVATE_KEY` env var. Never write it to disk, never ship it in the binary — per [D4](./decisions.md) and [D5](./decisions.md).
- **IdP certificate**: public, embed in your fork's config or fetch via IdP metadata URL at startup. If you fetch, pin it after first successful validation so a compromised metadata endpoint can't silently rotate to an attacker cert mid-run.
- **`TINKER_BETTER_AUTH_BRIDGE_SECRET`** (gates `/desktop/session`): upstream contract, keep unchanged.
- **No refresh token** storage needed — SAML doesn't have one. On re-auth, the sidecar issues a new AuthnRequest and the user either sees a silent IdP redirect (if their IdP session cookie is still valid) or re-authenticates.

### Step 7 — Update `opencode.json` for SAML provider

```json
{
  "auth": {
    "providers": {
      "saml": {
        "spEntityId": "urn:tinker:<yourorg>:desktop",
        "idpSsoUrl": "https://idp.<yourorg>.com/adfs/ls/",
        "idpEntityId": "https://idp.<yourorg>.com/adfs/services/trust",
        "idpMetadataUrl": "https://idp.<yourorg>.com/FederationMetadata/2007-06/FederationMetadata.xml",
        "nameIdFormat": "emailAddress",
        "signAuthnRequests": true
      }
    }
  }
}
```

The sidecar reads this at startup, optionally fetches metadata from `idpMetadataUrl` (pinning the cert after first load), and hands the merged config to `new SAML({ ... })`.

### Step 8 — Update the renderer's sign-in screen

Upstream shows three buttons (Google / GitHub / Microsoft). Your fork's sign-in screen shows one: "Sign in with \<YourOrg\> SSO". Renderer wiring stays the same — calls `POST /desktop/sign-in/saml` with a loopback `appCallback` and a ticket, waits for the ticket to surface at `/desktop/session`.

No renderer code inside `apps/desktop/src/renderer/` needs to know anything about SAML. That's the point of keeping `IdentitySession` vendor-agnostic ([D3](./decisions.md)).

### Step 9 — Federation + integrations

Your `FederationAdapter` implementation for a SAML fork returns `false` from `canFederate()` for every service. SAML does not produce bearer tokens exchangeable for downstream services. Consequence:

- **Integrations fall through to per-service OAuth** (Gmail, Linear, etc.) the same way the consumer path works.
- If your org's downstream apps are *also* SAML SPs, they authenticate the user via the IdP independently — your MCP servers for those apps need to handle their own IdP session, not re-use the Tinker SAML assertion.
- If your org wants true silent federation across apps, add an OIDC layer in front of your SAML IdP (most modern IdPs support both) and use the [Entra OBO / Okta XAA path](./enterprise-fork-guide.md) instead.

Put differently: **SAML gets the user signed into Tinker. It does not light up downstream integrations.** That's a SAML protocol limit, not a Tinker limit.

---

## Loopback vs hosted SP

Some IdPs (older ADFS deployments, strict SAML-compliance regimes) reject loopback (`http://127.0.0.1:…`) ACS URLs. If yours does:

**Option A — wildcard loopback with port range.** Some IdPs allow `http://127.0.0.1:*` or a specific port range in the ACS URL pattern. Register with the specific port you plan to use (default `3147`); if it needs dynamism, pick a range and range-allow at the IdP.

**Option B — hosted SP.** Run a tiny server at a stable HTTPS URL (your org's infra) that proxies the SAML ACS through to the desktop sidecar via WebSocket or polling with a short-TTL ticket. This adds a network dependency Tinker otherwise avoids — only do this if your IdP admin refuses Option A.

**Do not:** terminate SAML at some shared SaaS gateway and forward a synthesized assertion to the desktop. That breaks the audience restriction of the original IdP response and voids the trust model.

---

## Testing

Before shipping your fork internally:

- [ ] Start sidecar locally, issue `POST /desktop/sign-in/saml` via `curl` — verify 302 to IdP SSO URL, `RelayState` present, `SAMLRequest` decodes to a well-formed AuthnRequest.
- [ ] IdP test harness (ADFS test user / Okta sandbox) — full round-trip, verify `IdentitySession` payload at `/desktop/session`.
- [ ] **Negative test: expired assertion.** Replay a captured `SAMLResponse` after the `NotOnOrAfter` window — must fail with a validation error, not succeed.
- [ ] **Negative test: wrong audience.** Modify the audience in a captured response — must fail.
- [ ] **Negative test: wrong signature.** Tamper with an attribute value — must fail.
- [ ] **Negative test: replay same assertion ID twice.** Second attempt must fail on replay protection.
- [ ] **Negative test: no `InResponseTo`.** Submit an IdP-initiated assertion to the ACS — must fail when `validateInResponseTo: 'always'`.
- [ ] Tauri shell + renderer: full user flow (sign in → folder picker → workspace → chat round-trip). Upstream's acceptance checklist in [tasks.md](../agent-knowledge/context/tasks.md) M0 still applies; only the sign-in screen differs.
- [ ] Sign out + sign in again: sidecar must not retain prior user state.

A good test corpus for negative tests: [`saml-test-framework`](https://github.com/jasonwatson/saml-test) or your IdP's own security scanner.

---

## Upgrading from upstream

Upstream regularly iterates on `packages/auth-sidecar/src/main.ts`. Your SAML fork diverges from that file aggressively. To stay mergeable:

- **Do not** reach into `main.ts` from other files. Keep all Better-Auth-removal and SAML-addition concentrated in `main.ts` + a new `src/saml.ts`. Upstream merges then become one-file resolutions.
- **Keep the public HTTP contract stable.** Upstream shells and renderer code depend on the `/desktop/sign-in/:provider`, `/desktop/finish`, `/desktop/session`, `/health`, `/api/auth/*` routes. Preserve the same URL paths + request/response shapes. (For SAML you're adding `/desktop/saml/acs` alongside, not replacing.)
- **Keep the `IdentitySession` field shape.** New upstream fields get preserved in your mapper.
- **Watch upstream `ticket` semantics.** Upstream ticket TTLs and transfer-cache shape may change; match them.

When upstream changes the sidecar public contract (rare), the renderer changes in lockstep. In that case your fork takes both the sidecar + renderer upstream diffs, then re-applies the SAML delta inside your `main.ts`.

---

## FAQ

**Q: Can we ship SAML + Better Auth social side-by-side (some users SSO, some OIDC)?**
Technically yes — stand up both in the same sidecar, add a per-user preference on the sign-in screen. Operationally painful: two identity layers to debug, two sets of validation paths, two sets of tokens (SAML has none; social has refresh tokens). Most orgs that mandate SAML mandate it for everyone — pick one.

**Q: SCIM for user provisioning?**
Out of scope for this doc. SCIM is orthogonal to SAML — it's about pushing user rows from your IdP to the app's user DB out-of-band. Tinker has no central backend to push to in the first place. If your fork adds a central user directory (unusual for a local-first desktop app), SCIM wiring is your fork's design decision. See the OSS [scim-patch](https://github.com/thomaspoignant/scim-patch) library if you need it.

**Q: Can assertions carry authorization info (groups) we can use inside Tinker?**
Yes. `@node-saml/node-saml` surfaces attribute statements on the parsed `profile`. Map `profile['http://schemas.microsoft.com/ws/2008/06/identity/claims/role']` (or your IdP's equivalent) into your app's authorization layer. Upstream Tinker has no authorization layer; that's a fork addition.

**Q: Single Logout (SLO)?**
`@node-saml/node-saml` supports SAML Single Logout (SLO) via `getLogoutUrlAsync` + `validateRedirect` / `validatePostRequestAsync`. Wire it into your fork's sign-out flow if your IdP requires it. Upstream `POST /auth/logout` is local-only (clears the transfer cache) — extend in your fork to also call SLO.

**Q: Our IdP wants encrypted assertions.**
Add `decryptionPvk` to the `SAML` constructor, generate an SP encryption key pair, register the public cert with your IdP. Treat the private key with the same keychain discipline as the signing key.

**Q: What about SAML metadata generation?**
`@node-saml/node-saml` exposes `generateServiceProviderMetadata(decryptionCert?, signingCert?)`. Call it once per fork build, hand the XML to your IdP admin. Do not re-upload metadata on every release unless certs rotate.

---

## References

- [SAML 2.0 Core spec](https://docs.oasis-open.org/security/saml/v2.0/saml-core-2.0-os.pdf) — assertion structure, condition elements
- [SAML 2.0 Web Browser SSO profile](https://docs.oasis-open.org/security/saml/v2.0/saml-profiles-2.0-os.pdf) — the flow you're implementing
- [SAML Security Considerations](https://docs.oasis-open.org/security/saml/v2.0/saml-sec-consider-2.0-os.pdf) — audience restriction, signature coverage, replay
- [`@node-saml/node-saml`](https://github.com/node-saml/node-saml) — library reference
- [Auth architecture](./auth-architecture.md) — upstream contracts your fork preserves
- [Enterprise fork guide](./enterprise-fork-guide.md) — OIDC-flavored siblings (Entra OBO, Okta XAA, Google Workspace)
- [Decisions log](./decisions.md) — [D1](./decisions.md) consumer-first, [D3](./decisions.md) vendor-agnostic contracts, [D4](./decisions.md) public clients, [D5](./decisions.md) keychain, [D8](./decisions.md) enterprise fork pattern
