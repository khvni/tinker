---
type: reference
tags: [auth, better-auth, google, github, microsoft, pkce, loopback, tauri, mvp, m8]
---

# Better Auth config — Google + GitHub + Microsoft on Tauri

`[2026-04-21]` Research deliverable for TIN-74 (M8.1). Canonical config recipe for wiring Better Auth v1 consumer identity into the Tinker Tauri app. Blocks M8.4 (Google), M8.5 (GitHub), M8.6 (Microsoft).

> **Audience**: coding agents implementing `packages/auth-sidecar` + the Rust spawn/keychain glue. Humans register the OAuth apps once per maintainer (§7).
> **Constraints honored**: D2 (Better Auth), D4 (PKCE, no secret in binary), D5 (keychain-only token storage), D22 (no mutate-then-call), D25 (identity only — zero integration scopes in MVP).
> **Companion files**: [[28-mvp-identity]] · [[auth-architecture]] · [[auth-vendor-evaluation]].

---

## 1. Why this document exists

The existing `packages/auth-sidecar/src/main.ts` is a scaffold. It ships with:

- Only Google + GitHub wired (no Microsoft).
- Integration scopes grafted onto sign-in (`gmail.readonly`, `drive.readonly`, `repo`, etc.) — which D25 forbids for MVP; integration credentials are a separate, post-MVP concern (D6).
- A ticket-based `/desktop/*` transfer shim instead of the `auth/start` / `auth/callback` / `auth/session` / `auth/logout` contract the feature spec names.

M8.4 / M8.5 / M8.6 replace that scaffold with the config in §5 + §6. Rust ownership of the loopback port + keychain lives in M8.7 / M8.8.

## 2. Architecture in one picture

```
┌─────────────────────────── Tauri device (apps/desktop) ────────────────────────────┐
│                                                                                     │
│  Rust (src-tauri)                         React renderer                            │
│    • binds 127.0.0.1:<authPort> for       • window.__TAURI__.invoke('auth_*')       │
│      the auth sidecar (random ephemeral)  • renders sign-in screen (M8.9)           │
│    • binds 127.0.0.1:<cbPort>  for the    • polls GET /auth/session until           │
│      OAuth loopback callback (random)       authenticated=true                      │
│    • spawns `node auth-sidecar.mjs` with                                            │
│      AUTH_PORT + CALLBACK_PORT + secrets                                            │
│    • keychain: tauri-plugin-keyring       ▲                                         │
│      save_refresh_token / load / clear    │                                         │
│                          │                │                                         │
│                          ▼                │                                         │
└──────────────────────────┼────────────────┼─────────────────────────────────────────┘
                           │                │
        spawn + IPC        │                │  HTTP (loopback only)
                           │                │
┌──────────────────────────┴────────────────┴─────────────────────────────────────────┐
│  Better Auth sidecar (packages/auth-sidecar) — Node 20, ESM, in-memory only         │
│    • POST /auth/start?provider=…&callback=…                                         │
│    • GET  /auth/callback/:provider           (provider redirects here)              │
│    • GET  /auth/session                      (bearer = bridge secret)               │
│    • POST /auth/logout                                                              │
│    • internal:  auth.handler()  (Better Auth's own /api/auth/* surface)             │
│                                                                                     │
│    Stores NOTHING durable. Refresh tokens leave via IPC → Rust → OS keychain.       │
│    Sidecar memory holds: active sign-in transfer tickets (≤5min TTL), Better        │
│    Auth's in-memory cookie cache.                                                   │
└─────────────────────────────────────────────────────────────────────────────────────┘
                           │
                           │  HTTPS to provider
                           ▼
            Google / GitHub / Microsoft authorization server
```

Three hard rules, in precedence order:

1. **No `client_secret` in the compiled binary.** OAuth app credentials load from a gitignored local env file (`apps/desktop/.env.local` + mirror in `packages/auth-sidecar/.env.local`) the maintainer populates once per app registration. `opencode.json` and any tracked source stay secret-free.
2. **Sidecar is stateless between launches.** Refresh tokens round-trip through Rust to the OS keychain on every sign-in. The sidecar's SQLite database stays Better Auth's default (in-memory / ephemeral file) — it is *not* a source of truth.
3. **PKCE everywhere.** Better Auth enforces PKCE internally for all OAuth flows; no opt-out.

## 3. Endpoint contract

The sidecar exposes exactly four public endpoints + Better Auth's internal surface. All bind on `127.0.0.1:<authPort>` only. All non-browser callers authenticate with the `X-Tinker-Bridge-Secret` header (value = `TINKER_BETTER_AUTH_BRIDGE_SECRET`, a 32-byte random string Rust generates at spawn and passes via env).

### `POST /auth/start`

```
POST /auth/start
X-Tinker-Bridge-Secret: <secret>
Content-Type: application/json

{
  "provider": "google" | "github" | "microsoft",
  "callbackPort": 50739                     // Rust-bound loopback port for this sign-in
}

200 OK
{
  "ticket": "5f4a...c1",                    // one-shot token for session retrieval
  "authorizationUrl": "https://accounts.google.com/o/oauth2/v2/auth?client_id=…&code_challenge=…&redirect_uri=http://127.0.0.1:50739/auth/callback/google&…"
}
```

Renderer invokes `window.__TAURI__.shell.open(authorizationUrl)` to launch the system browser. Rust holds `ticket` in memory to correlate the eventual callback.

### `GET /auth/callback/:provider`

Hit by the provider's user-agent redirect. Body is opaque — the sidecar finalizes the OAuth exchange (code + PKCE verifier), resolves the Better Auth session, then redirects the browser to a local static page (`http://127.0.0.1:<authPort>/signed-in.html`) so the user sees "you can close this tab". The sidecar writes the resulting `IdentitySession` into its ticket map, keyed by the ticket from step 1.

Query params:
- `code` (string, required on success)
- `state` (string, required — includes the ticket + CSRF binding)
- `error` / `error_description` (on provider failure)

### `GET /auth/session`

```
GET /auth/session?ticket=5f4a...c1
X-Tinker-Bridge-Secret: <secret>

200 OK (authenticated)
{
  "authenticated": true,
  "provider": "google",
  "user": {
    "id": "117683829",                      // provider-issued subject (sub)
    "providerUserId": "117683829",          // identical; kept for D3 contract naming
    "email": "ada@example.com",
    "displayName": "Ada Lovelace",
    "avatarUrl": "https://lh3.googleusercontent.com/…",
    "emailVerified": true
  },
  "tokens": {
    "refreshToken": "1//0g…",               // delivered once; Rust writes to keychain immediately
    "expiresAt": "2026-04-21T23:05:12Z"     // access-token expiry (for silent-refresh scheduling)
  }
}

200 OK (not yet authenticated — sidecar is still waiting on the callback)
{ "authenticated": false, "status": "pending" }

401 (ticket expired or unknown)
{ "authenticated": false, "status": "expired" }
```

The renderer polls `/auth/session` at 500 ms intervals during sign-in. **Ticket is consumed on successful read** — Rust must forward `refreshToken` to the keychain before discarding the response. Subsequent reads for the same ticket return `expired`.

### `POST /auth/logout`

```
POST /auth/logout
X-Tinker-Bridge-Secret: <secret>

{ "provider": "google", "userId": "117683829" }

204 No Content
```

Sidecar clears its in-memory session for that user. Rust separately calls `clear_refresh_token(provider, userId)` to wipe the keychain entry. Two-step because D6 keeps lifecycles decoupled.

### `GET /health`

Unauthenticated. Returns `{ "ok": true }`. Rust uses this for the coordinator health-poll (D22).

### Internal `/*` routes

Better Auth mounts its own handler at `/api/auth/*`. These exist for the OAuth dance itself — the renderer must never call them directly. Treat them as private.

## 4. Loopback redirect URI

### Format

```
http://127.0.0.1:<callbackPort>/auth/callback/<provider>
```

Concrete example (Google, callback port 50739):

```
http://127.0.0.1:50739/auth/callback/google
```

### Why `127.0.0.1` not `localhost`

Google's current installed-app spec deprecates `localhost` in favor of `127.0.0.1` for new clients. GitHub + Microsoft both accept either; standardize on `127.0.0.1` to avoid DNS ambiguity and to match the IdentitySession invariant in the existing sidecar (`isLoopbackCallback`).

### Port assignment

Rust binds the callback port from the ephemeral range (OS-chosen, `TcpListener::bind("127.0.0.1:0")`) at the start of each sign-in attempt and passes the resulting port to the sidecar's `/auth/start` call. No hardcoded ports — Google / GitHub / Microsoft all allow dynamic ports on loopback for their desktop app types (see §7). The port is held open until either (a) `/auth/callback/:provider` receives the redirect, (b) `/auth/session` returns `authenticated: true` and the ticket is consumed, or (c) a 5-minute timeout elapses.

### How Rust binds + how the sidecar receives

```rust
// apps/desktop/src-tauri/src/commands/auth.rs
#[tauri::command]
pub async fn start_auth(
    state: State<'_, AuthCoordinator>,
    provider: AuthProvider,
) -> Result<AuthTicket, AuthError> {
    let listener = TcpListener::bind("127.0.0.1:0").await?;         // ephemeral port
    let callback_port = listener.local_addr()?.port();
    state.register_callback(callback_port, listener).await;         // coordinator owns the socket
    let sidecar = state.sidecar();                                  // health-polled at startup
    sidecar.start(provider, callback_port).await                    // POST /auth/start
}
```

```ts
// packages/auth-sidecar/src/main.ts (shape only — M8.4 writes this)
const start = async (req: Request) => {
  const { provider, callbackPort } = await req.json();
  const redirectURI = `http://127.0.0.1:${callbackPort}/auth/callback/${provider}`;
  const ticket = crypto.randomUUID();
  const { url } = await auth.api.signInSocial({
    body: { provider, callbackURL: redirectURI, newUserCallbackURL: redirectURI },
    asResponse: false,
  });
  tickets.set(ticket, { status: 'pending', callbackPort, provider, expiresAt: Date.now() + 5 * 60_000 });
  return Response.json({ ticket, authorizationUrl: url });
};
```

Pass `callbackPort` per call (D22). Do **not** stash it on the sidecar or the coordinator between invocations.

### What the Tauri side must register with `allowlist`

- `tauri.conf.json → app.security.csp`: allow `http://127.0.0.1:*` connect-src for fetches from the renderer to the sidecar.
- `tauri.conf.json → plugins.shell.open`: enabled, so the renderer can launch the provider URL in the user's browser.

## 5. PKCE flow (the code-challenge dance)

Better Auth implements PKCE internally — no explicit `pkce: true` flag on the built-in `google` / `github` / `microsoft` providers (it is always on). The effective flow:

1. `POST /auth/start` → sidecar asks Better Auth for a sign-in URL. Better Auth generates:
   - `code_verifier` — random 43–128 char string (stored in the sidecar's Better Auth cookie cache, not in the desktop state).
   - `code_challenge = BASE64URL(SHA256(code_verifier))`.
   - `state` — ties the authorization request to the ticket + CSRF.
2. Sidecar returns the full authorization URL containing `code_challenge`, `code_challenge_method=S256`, and `state`. Renderer opens it in the system browser.
3. User signs in with the provider. Provider redirects the browser back to `http://127.0.0.1:<callbackPort>/auth/callback/<provider>?code=…&state=…`.
4. Callback handler (the sidecar's Better Auth `/api/auth/callback/<provider>` under the hood) validates `state`, retrieves the original `code_verifier` from the cookie cache, and exchanges `(code, code_verifier)` for tokens at the provider's token endpoint.
5. Better Auth resolves a user row + an account row in its own SQLite. The sidecar looks up the account's `refreshToken` and `accessTokenExpiresAt` via `auth.api.getAccessToken({…})`, then packages them into the `/auth/session` payload.

### Why no `pkce: true` knob exists on the built-in providers

The `pkce` config option is on the **generic-oauth** plugin, which we do **not** use for MVP. For named social providers (Google / GitHub / Microsoft) Better Auth always derives + sends the code challenge. Search `better-auth/src/social-providers/*` if you want the implementation; the exposed config surface does not need a toggle.

### When you'd reach for generic-oauth instead

Never, in MVP. Reach only if:
- A post-MVP provider ships that Better Auth doesn't have a built-in for (unlikely for the big three).
- You need `token_endpoint_auth_method: 'none'` (true public client with zero secret) for a provider that supports it. Microsoft via "Mobile & desktop app" platform is the only current candidate; Better Auth's built-in Microsoft provider handles this by simply leaving `clientSecret` empty — it's wired through.

## 6. Token refresh handoff (sidecar → Rust → keychain)

### Sidecar stores nothing durable

Better Auth keeps its session state in an in-memory SQLite by default. The sidecar must:

- Configure Better Auth with `database: undefined` (the default in-memory adapter) — tracked in §10.
- On successful OAuth callback, synchronously package the `refreshToken` into the ticketed `/auth/session` payload.
- Immediately after the renderer's `/auth/session` consumption, call `auth.api.signOut({…})` on the internal handler so the sidecar's cookie cache is cleared. (The existing scaffold already does this in `finishOAuth`; M8.4 preserves that pattern.)

Net result: if the sidecar process is restarted, it has no memory of anyone's refresh tokens. Sign-in resumes from the keychain via §6.3.

### Rust writes to keychain (D5)

```rust
// apps/desktop/src-tauri/src/commands/keyring.rs
#[tauri::command]
pub async fn save_refresh_token(
    provider: AuthProvider,
    user_id: String,
    refresh_token: String,
    scopes: Vec<String>,
) -> Result<(), KeyringError> {
    let entry = keyring::Entry::new(
        &format!("tinker-{}", provider),          // service
        &format!("identity-{}", user_id),         // account
    )?;
    entry.set_password(&serde_json::to_string(&RefreshRecord {
        refresh_token,
        scopes,
        issued_at: Utc::now().to_rfc3339(),
    })?)?;
    Ok(())
}
```

Mirrors the schema in [[auth-architecture]] §"Token Storage Details". Keep the service prefix `tinker-*` and one entry per `(provider, user_id)` pair.

### Silent refresh on cold launch

```
Rust                             Sidecar                             Provider
 │                                 │                                   │
 │ load_refresh_token(google,uid)  │                                   │
 │──────────────────────────────── │                                   │
 │ POST /auth/refresh              │                                   │
 │ { provider, userId, refresh }   │                                   │
 │────────────────────────────────>│                                   │
 │                                 │ auth.api.refreshToken({…})        │
 │                                 │──────────────────────────────────>│
 │                                 │<──────────────── new tokens ──────│
 │                                 │ IdentitySession in memory         │
 │<──────────────── 200 OK ────────│                                   │
 │ save_refresh_token (if rotated) │                                   │
```

Add `POST /auth/refresh` in M8.12 when silent sign-in lands — it's not in the public contract above because M8.4–M8.6 only need the interactive flow. Shape TBD in the M8.12 PR; keep the response shape equal to `/auth/session` minus `tokens.refreshToken` unless the provider rotates it.

### Cleared-when

- `POST /auth/logout` → sidecar clears session + Rust calls `clear_refresh_token(provider, userId)` → keychain entry deleted.
- Provider returns `invalid_grant` on refresh → emit `reconnect_required`, leave keychain entry so user can retry. Compare [[auth-architecture]] §"User signs out of IdP mid-session".

## 7. Per-provider setup

Each maintainer registers one app per provider under their own account. The repo stays secret-free: credentials live in a gitignored `auth-config.local.json` the sidecar reads via env:

```
# apps/desktop/.env.local (gitignored, mirrored in packages/auth-sidecar/.env.local)
GOOGLE_OAUTH_CLIENT_ID=1234567890-abc.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=GOCSPX-…
GITHUB_OAUTH_CLIENT_ID=Iv1.…
GITHUB_OAUTH_CLIENT_SECRET=…
MICROSOFT_OAUTH_CLIENT_ID=…
MICROSOFT_OAUTH_TENANT_ID=consumers                 # personal MSA only — D4/D9
TINKER_BETTER_AUTH_BRIDGE_SECRET=<32 random bytes, base64>
TINKER_BETTER_AUTH_SECRET=<32 random bytes, base64> # Better Auth session signing
```

`MICROSOFT_OAUTH_CLIENT_SECRET` is intentionally absent — see §7.3.

### 7.1 Google

**Register**: https://console.cloud.google.com/auth/clients
1. Create OAuth client → Application type: **Desktop app**.
2. Name: `Tinker Desktop (your-username)`. No redirect URIs to register — Desktop clients accept any loopback port dynamically.
3. Copy `client_id` + `client_secret` into the env file. Google explicitly documents ([OAuth for native apps](https://developers.google.com/identity/protocols/oauth2/native-app)) that the Desktop client secret is not treated as a secret — inclusion satisfies Better Auth's config requirement without violating D4's "no secret in binary" rule (because it ships in the user-local env, not the tracked source).

**Sign-in scopes (MVP)**: `openid`, `email`, `profile`. Nothing else. Strip the `gmail.readonly` / `calendar.readonly` / `drive.readonly` scopes the current scaffold grafts on — those are integration scopes (D6) and are out of scope for identity.

**App-registration consent screen**: under "OAuth consent screen" set publishing status to **Testing** during development (adds whitelisted test accounts; no verification required). Production publishing is post-MVP.

**Better Auth config snippet** (plug into `packages/auth-sidecar/src/main.ts` in M8.4):

```ts
import { betterAuth } from 'better-auth';

export const auth = betterAuth({
  appName: 'Tinker',
  baseURL: `http://127.0.0.1:${authPort}`,
  secret: requiredEnv('TINKER_BETTER_AUTH_SECRET'),
  trustedOrigins: [`http://127.0.0.1:${authPort}`],
  session: { cookieCache: { enabled: true, maxAge: 300 } },
  account: { accountLinking: { enabled: false } },
  socialProviders: {
    google: {
      clientId:     requiredEnv('GOOGLE_OAUTH_CLIENT_ID'),
      clientSecret: requiredEnv('GOOGLE_OAUTH_CLIENT_SECRET'),
      // redirectURI is provided per-sign-in (dynamic loopback port), not baked in.
      scope: ['openid', 'email', 'profile'],
      disableDefaultScope: true,      // stop Better Auth from re-adding `email profile`
      prompt: 'select_account',
      accessType: 'offline',          // required to receive a refresh_token
    },
  },
});
```

**Redirect URI example**: `http://127.0.0.1:50739/auth/callback/google`.

### 7.2 GitHub

**Register**: https://github.com/settings/developers → **New OAuth App**.
1. Application name: `Tinker Desktop (your-username)`.
2. Homepage URL: `https://github.com/khvni/tinker` (or your fork).
3. Authorization callback URL: **any HTTP URL is accepted on `127.0.0.1` with any port — enter `http://127.0.0.1/auth/callback/github`** as a placeholder. GitHub matches by scheme + host, not port, for loopback. (Their docs: [Authorizing OAuth apps — Redirect URLs](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#redirect-urls).)
4. Enable "Request user authorization (OAuth) during installation".
5. Copy `client_id` + generate a new `client_secret`.

**Sign-in scopes (MVP)**: `read:user`, `user:email`. Drop `repo` — that's an integration scope.

**PKCE note**: GitHub added PKCE support for OAuth Apps in Oct 2024. Better Auth enables it by default. No extra flag.

**Better Auth config snippet**:

```ts
socialProviders: {
  github: {
    clientId:     requiredEnv('GITHUB_OAUTH_CLIENT_ID'),
    clientSecret: requiredEnv('GITHUB_OAUTH_CLIENT_SECRET'),
    scope: ['read:user', 'user:email'],
    disableDefaultScope: true,
  },
},
```

**Redirect URI example**: `http://127.0.0.1:50739/auth/callback/github`.

### 7.3 Microsoft (consumer / personal accounts)

**Register**: https://portal.azure.com → Microsoft Entra ID → App registrations → **New registration**.
1. Name: `Tinker Desktop (your-username)`.
2. Supported account types: **"Personal Microsoft accounts only"** (maps to `tenantId: 'consumers'`). Do NOT pick "Accounts in any organizational directory" — that is the enterprise path and explicitly out of scope per D1 / D8 / D9.
3. Redirect URI: leave blank at creation. Edit → Authentication → **Add platform** → **Mobile and desktop applications** → tick `https://login.microsoftonline.com/common/oauth2/nativeclient` (Entra requires this boilerplate) **and** add a custom URI: `http://127.0.0.1/auth/callback/microsoft` (again, Entra matches by scheme + host on loopback — any port is accepted).
4. Same screen → **Advanced settings → Allow public client flows → Yes**. This is mandatory for PKCE-without-secret flows ([[auth-architecture]] §"Entra-specific gotchas"). If it is off, Entra rejects with `invalid_client`.
5. Copy Application (client) ID into the env file. **Do not create a client secret.**

**Sign-in scopes (MVP)**: `openid`, `email`, `profile`, `offline_access`. `offline_access` is the Microsoft-specific scope required to receive a refresh token; without it the token exchange returns access-only.

**Tenant**: always `consumers` for upstream OSS (per D4). Enterprise forks override to `common` / `organizations` / a specific tenant UUID in their fork of `main.ts` — that is the D8 fork path and NOT a runtime config.

**Better Auth config snippet**:

```ts
socialProviders: {
  microsoft: {
    clientId:     requiredEnv('MICROSOFT_OAUTH_CLIENT_ID'),
    clientSecret: '',                                       // intentionally empty — public client
    tenantId:     optionalEnv('MICROSOFT_OAUTH_TENANT_ID') ?? 'consumers',
    authority:    'https://login.microsoftonline.com',
    scope: ['openid', 'email', 'profile', 'offline_access'],
    disableDefaultScope: true,
    prompt: 'select_account',
  },
},
```

`clientSecret: ''` is accepted because Better Auth passes it through as the `client_secret` form-encoded value at the token endpoint; Entra's public-client flow ignores it when "Allow public client flows" is on. Tested pattern in Better Auth v1.6.x.

**Redirect URI example**: `http://127.0.0.1:50739/auth/callback/microsoft`.

## 8. Env var layout (full)

Copy-paste template for `apps/desktop/.env.local` + `packages/auth-sidecar/.env.local` (both gitignored):

```env
# Sidecar <→ Rust bridge secret (32 random bytes, base64)
TINKER_BETTER_AUTH_BRIDGE_SECRET=

# Better Auth session signing (32 random bytes, base64; separate from bridge secret)
TINKER_BETTER_AUTH_SECRET=

# Sidecar loopback port; leave unset to use the default 3147, or let Rust override
TINKER_BETTER_AUTH_PORT=

# Google — https://console.cloud.google.com/auth/clients  (Desktop app)
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=

# GitHub — https://github.com/settings/developers  (OAuth App)
GITHUB_OAUTH_CLIENT_ID=
GITHUB_OAUTH_CLIENT_SECRET=

# Microsoft — https://portal.azure.com (Personal MSA only; public client; no secret)
MICROSOFT_OAUTH_CLIENT_ID=
MICROSOFT_OAUTH_TENANT_ID=consumers
```

Rust reads the port + bridge secret to spawn the sidecar (D22: pass per call). Sidecar reads all of the above at startup. Any provider whose `CLIENT_ID` is missing or placeholder (`YOUR_*`, `PLACEHOLDER`, `CHANGE_ME`) is skipped — the sign-in screen in M8.9 greys out that button with a "not configured" tooltip.

## 9. Differences from the existing scaffold

The scaffold is useful as a blueprint but requires surgery for M8.4–M8.6:

| What the scaffold does today | What M8.4–M8.6 must do |
|---|---|
| Google + GitHub only | Add Microsoft provider (§7.3) |
| `scope: [...gmail.readonly, calendar.readonly, drive.readonly]` on Google | Strip to `['openid', 'email', 'profile']` + `disableDefaultScope: true` |
| `scope: [...repo]` on GitHub | Strip to `['read:user', 'user:email']` + `disableDefaultScope: true` |
| `/desktop/sign-in/:provider` + `/desktop/finish` + `/desktop/session` ticket shim | Rename to `POST /auth/start`, `GET /auth/callback/:provider`, `GET /auth/session`, `POST /auth/logout` (§3). Keep the one-shot ticket + 5-min TTL semantics — they're correct. |
| Requires `clientSecret` for every provider | Accept empty `clientSecret` for Microsoft (public client) |
| `appCallback` query param is the desktop loopback URL (opaque to the sidecar) | `callbackPort` body field on `/auth/start`; sidecar constructs the `http://127.0.0.1:<port>/auth/callback/<provider>` URI itself |
| `accessToken` + `refreshToken` returned together in `/desktop/session` | Same, but field names per §3 (`tokens.refreshToken`, `tokens.expiresAt`) — renderer hands `refreshToken` to Rust immediately, never stores it |
| No `/auth/logout` | Add — sidecar clears in-memory session + Rust clears keychain (§3) |
| No `/health` | Add — Rust's coordinator uses it for spawn gating (D22) |

## 10. Open points intentionally NOT decided here

Left for M8.4–M8.12 PRs to decide when the code forces the choice:

- **Static signed-in success page**: markup is cosmetic, lives in `packages/auth-sidecar/src/signed-in.html`. Not a contract.
- **Silent-refresh scheduler**: whether the sidecar exposes `POST /auth/refresh` (renderer drives) or the sidecar self-refreshes on a timer. Lean renderer-drive (simpler, stateless). Decide in M8.12.
- **Bridge-secret rotation**: current sidecar regenerates on spawn. Keep that — it matches Rust's per-launch unref pattern.
- **Better Auth database**: default in-memory is correct for MVP. Revisit only if we add `emailAndPassword` or multi-device sync (post-MVP).
- **Signed-out behavior across sign-ins of the same machine**: Better Auth's internal user/account rows accumulate in the in-memory DB for the sidecar's lifetime. Acceptable for MVP because the sidecar restarts with each Tauri launch. If this ever becomes persistent, collapse duplicate accounts by `(provider, providerUserId)` before emitting the session.

## 11. Ready-to-implement checklist for M8.4 / M8.5 / M8.6

- [ ] M8.4 (Google): rewrite `packages/auth-sidecar/src/main.ts` endpoints to §3, wire Google provider per §7.1, delete integration scopes, point `redirectURI` at the per-call dynamic port.
- [ ] M8.4 (Google): add Rust commands `start_auth` + `cancel_auth` + `clear_refresh_token` per §4 + §6.
- [ ] M8.5 (GitHub): add §7.2 block to `socialProviders`. Verify scopes are sign-in only. No new Rust needed.
- [ ] M8.6 (Microsoft): add §7.3 block. Empty `clientSecret`. `tenantId: 'consumers'`. `offline_access` scope.
- [ ] Register OAuth apps per §7. Populate local env file per §8. Confirm all three provider buttons in the sign-in screen resolve their client IDs at sidecar boot.
- [ ] Smoke test each provider end-to-end: sign-in → callback → `/auth/session` returns `authenticated: true` → refresh token written to keychain → `/auth/logout` clears both sides.

No Better Auth source reads required beyond this doc.

## Connections

- [[28-mvp-identity]] — feature spec
- [[auth-architecture]] — adapter pattern + sequence diagrams
- [[auth-vendor-evaluation]] — why Better Auth
- [[decisions]] — D2 (Better Auth), D4 (PKCE / public client), D5 (keychain), D6 (identity ≠ integration), D22 (no mutate-then-call), D25 (MVP scope)
