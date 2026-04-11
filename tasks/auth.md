# W5 · Auth (Okta SSO) + Token Vault

You are building the one-click SSO flow that makes every Glass integration "just work" from first launch. Per the article: users sign in via Okta once and everything becomes available.

## Context
- `ramp-glass-prd.md` §2.1 (Okta SSO, one-click setup), §3.2 (auth row), §3.4 (a) first-launch flow.
- `AGENTS.md` §4.6 security (tokens never hit disk in plaintext, keytar only, tight contextBridge, CSP).
- `packages/shared-types/src/auth.ts` — **FROZEN. Do not edit.**

## Exclusive write scope
- `packages/auth/**`
- `apps/desktop/src/main/auth-window.ts` (new file — the Electron-side Okta OIDC code-flow window)

## What to build
1. `packages/auth/src/vault.ts`: real `createTokenVault` using `keytar`. One keychain entry per integration + one for the Okta session. Never write tokens to plaintext files.
2. `packages/auth/src/okta.ts`: real `createOktaAuthService` using `openid-client` (OIDC code flow with PKCE). The Electron main process opens a system browser or a dedicated BrowserWindow, intercepts the redirect, exchanges the code for tokens, decodes the ID token, and stores the session in the vault.
3. `packages/auth/src/refresh.ts`: silent refresh logic — if the access token is within ~1 minute of expiry, exchange the refresh token transparently. Callers never see an expired token.
4. `apps/desktop/src/main/auth-window.ts`: IPC handler that the renderer invokes on first launch → triggers `signIn` → returns the `OktaProfile`. On subsequent launches, `currentSession` returns the cached session without a UI prompt.
5. Integration token discovery: after Okta sign-in, map the user's Okta groups to the set of enabled integrations (read from an env-configured JSON or a static config for this phase) and mint per-integration placeholder tokens in the vault.

## Dependencies (read-only)
- `@ramp-glass/shared-types`.
- `openid-client`, `keytar` (add to deps; you may touch `pnpm-lock.yaml` — rebase onto `main` first).

## Stubs you may use
- Per-integration token minting can be stubbed with placeholder strings in this phase. The real OAuth flows per integration are out of scope — they're wired by W4 or follow-up work.

## Tests (Vitest)
- Unit: vault round-trip — store, get, clear for both Okta session and integration tokens. Use a mocked keytar.
- Unit: `refreshIfNeeded` triggers a refresh when within the expiry window, skips it otherwise.
- Unit: expired refresh token surfaces as `signIn` required, never a thrown error.

## Acceptance
- [ ] `pnpm --filter @ramp-glass/auth test` passes.
- [ ] `apps/desktop` launches, prompts for Okta sign-in on first run, caches the session; second launch skips the prompt.
- [ ] Force-expire the access token; the next API call silently refreshes.

## What you must NOT do
- Do not write tokens to disk outside `keytar`.
- Do not weaken Electron sandboxing: `contextIsolation: true`, `nodeIntegration: false`, sandbox preload.
- Do not edit `packages/shared-types`.
- Do not build your own crypto — use `openid-client`.

## When done
`feat(auth): Okta OIDC + keychain vault + auth window`. PR to `main`.
