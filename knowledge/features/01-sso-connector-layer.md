---
type: concept
tags: [tinker, feature, sso, oauth, mcp, integrations]
status: review
priority: p1
---

# Feature 01 — SSO Connector Layer

One sign-in lights up connected tools. Zero configuration. The day-1 unlock.

## Goal

User signs in with Google (and/or GitHub). Gmail, Calendar, Drive, Linear (GitHub-adjacent) become available immediately. No JSON editing, no MCP setup wizard, no "go read the docs."

## Reference Implementation ([[ramp-glass]])

- `[2026-04-10]` Okta SSO → 30+ tools (Salesforce, Snowflake, Gong, Slack, Notion, Google Workspace, Figma)
- `[2026-04-10]` "When a sales rep asks Glass to pull context from a Gong call, enrich with Salesforce, and draft a follow-up — it just works, because everything is already connected"
- `[2026-04-10]` Principle: "If the user has to debug, we've already lost"

## Tinker Scope

### v1 Providers
- `[2026-04-15]` **Google OAuth via Better Auth** — primary. Unlocks Gmail, Calendar, Drive via pre-configured MCP servers
- `[2026-04-15]` **GitHub OAuth via Better Auth** — secondary. Unlocks GitHub repos, issues, PRs via MCP

### v1 Pre-wired Integrations (MCP servers in `opencode.json`)
- `[2026-04-15]` Better Auth docs MCP = remote `https://mcp.better-auth.com/mcp` for agent/editor setup help
- `[2026-04-14]` `@google/gmail-mcp-server` — already in `opencode.json`
- `[2026-04-14]` `@google/calendar-mcp-server` — already in `opencode.json`
- `[2026-04-14]` `@google/drive-mcp-server` — already in `opencode.json`
- `[2026-04-14]` `@tacticlaunch/mcp-linear` — already configured, gated on env var
- `[2026-04-15]` GitHub MCP server = `@modelcontextprotocol/server-github`, wired behind `TINKER_GITHUB_TOKEN`

## Implementation Outline

### 1. Auth layer (Rust — Tauri plugin boundary)
- `[2026-04-14]` `tauri-plugin-keyring` for system keychain storage of OAuth tokens
- `[2026-04-15]` Better Auth runs as local Node sidecar inside desktop app. It owns social OAuth browser flow and stateless cookie/account handling
- `[2026-04-15]` Rust still owns loopback callback listener, one-time ticket exchange, and final keychain persistence. Better Auth never becomes token source of record
- `[2026-04-15]` Better Auth sidecar returns provider tokens through one-time `/desktop/session?ticket=...` bridge guarded by per-run shared secret header
- `[2026-04-14]` Rust exposes minimal `invoke` commands: `auth_sign_in(provider)`, `auth_sign_out(provider)`, `auth_status()`

### 2. Connector activation (TypeScript — renderer)
- `[2026-04-15]` On successful auth, renderer reloads sidecar state, forwards Google auth into OpenCode, and re-reads MCP status for UI
- `[2026-04-15]` GitHub MCP is activated by restarting OpenCode with `TINKER_GITHUB_TOKEN` in process env, then connecting `github` server from renderer
- `[2026-04-14]` UI reflects connection state in a compact status indicator (not a modal)

### 3. First-run flow (PRD §2.5)
- `[2026-04-14]` Sign-in step is **optional** — skip button leads to "work without connected tools" path
- `[2026-04-14]` If user signs in, connected tools light up in an "Integrations" strip; each shows status (connected / needs reconnect / not available)
- `[2026-04-14]` If user skips, they can trigger sign-in later from a settings drawer

## Security Boundaries

- `[2026-04-14]` Tokens stored **only** in system keychain (never in files, never in SQLite)
- `[2026-04-15]` Better Auth sidecar uses stateless cookie/account cookies only during browser sign-in. Flow signs out before handing ticket back to app callback
- `[2026-04-14]` MCP server processes inherit tokens via env vars at spawn time — not passed across IPC
- `[2026-04-15]` Rust auth commands use random loopback app callbacks (`http://127.0.0.1:<random-port>/callback`), but Better Auth provider callbacks use stable local redirect URIs (`http://127.0.0.1:3147/api/auth/callback/{provider}`) so Google/GitHub console config stays deterministic
- `[2026-04-14]` Treat external content returned from MCP as untrusted prompt input (per CLAUDE.md §5)

## Out of Scope ([[decisions]])

- `[2026-04-14]` Okta / SAML / Azure AD — defer to enterprise edition
- `[2026-04-14]` Multi-account-per-provider — one Google account per Tinker install, one GitHub account. Revisit on user ask.
- `[2026-04-14]` Custom OAuth providers (Dropbox, Notion, Slack) — MCP only; each provider picks up its own MCP server

## Open Questions

- How to handle MCP server disabled/enabled state when a user signs out of a provider mid-session
- Whether to pre-bundle MCP server npm packages in the Tauri binary or resolve at first run (affects cold-start time)
- Token refresh UX — silent refresh vs. user-initiated re-auth on 401
- How packaged desktop builds should source Better Auth social client secrets outside dev-shell env vars

## Open-Source References

- `tauri-plugin-keyring` — https://crates.io/crates/tauri-plugin-keyring
- `@opencode-ai/sdk` auth API — https://opencode.ai/docs/sdk/
- Better Auth introduction — https://better-auth.com/docs/introduction
- Better Auth installation — https://better-auth.com/docs/installation
- Better Auth basic usage — https://better-auth.com/docs/basic-usage
- Better Auth MCP docs — https://better-auth.com/docs/ai-resources/mcp

## Acceptance Criteria

- [x] User can sign in with Google from the FirstRun screen
- [x] User can sign in with GitHub from the FirstRun screen
- [x] Gmail, Calendar, Drive MCP servers are automatically active post-Google sign-in
- [x] GitHub MCP server is automatically active post-GitHub sign-in
- [x] Tokens are stored in system keychain (verified on macOS via Keychain Access app)
- [x] Sign-out removes tokens and disables affected MCP servers
- [x] Workspace still loads and functions if user skips sign-in

## Connections
- [[vision]] — why SSO is a Tinker moat
- [[positioning]] — see SSO row in feature gap table
- [[ramp-glass]] — Okta → 30+ tools reference
- [[decisions]] — SSO provider decisions
