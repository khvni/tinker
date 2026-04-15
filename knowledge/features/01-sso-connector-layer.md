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
- `[2026-04-14]` **Google OAuth** (loopback flow) — primary, already in PRD. Unlocks Gmail, Calendar, Drive via pre-configured MCP servers
- `[2026-04-14]` **GitHub OAuth** — secondary, covers developer sub-segment. Unlocks GitHub repos, issues, PRs via MCP

### v1 Pre-wired Integrations (MCP servers in `opencode.json`)
- `[2026-04-14]` `@google/gmail-mcp-server` — already in `opencode.json`
- `[2026-04-14]` `@google/calendar-mcp-server` — already in `opencode.json`
- `[2026-04-14]` `@google/drive-mcp-server` — already in `opencode.json`
- `[2026-04-14]` `@tacticlaunch/mcp-linear` — already configured, gated on env var
- `[2026-04-15]` GitHub MCP server = `@modelcontextprotocol/server-github`, wired behind `TINKER_GITHUB_TOKEN`

## Implementation Outline

### 1. Auth layer (Rust — Tauri plugin boundary)
- `[2026-04-14]` `tauri-plugin-keyring` for system keychain storage of OAuth tokens
- `[2026-04-14]` Google loopback OAuth command runs in Rust (`src-tauri/src/auth.rs` pattern) — opens browser → receives callback → stores token in keychain
- `[2026-04-15]` GitHub auth uses device flow in desktop build. Reason: GitHub web-flow token exchange needs `client_secret`, while device flow works with `client_id` only and fits local-first desktop constraints
- `[2026-04-14]` Rust exposes minimal `invoke` commands: `auth_sign_in(provider)`, `auth_sign_out(provider)`, `auth_status()`

### 2. Connector activation (TypeScript — renderer)
- `[2026-04-14]` On successful auth, renderer reloads sidecar state, forwards Google auth into OpenCode, and re-reads MCP status for UI
- `[2026-04-15]` GitHub MCP is activated by restarting OpenCode with `TINKER_GITHUB_TOKEN` in process env, then connecting `github` server from renderer
- `[2026-04-14]` UI reflects connection state in a compact status indicator (not a modal)

### 3. First-run flow (PRD §2.5)
- `[2026-04-14]` Sign-in step is **optional** — skip button leads to "work without connected tools" path
- `[2026-04-14]` If user signs in, connected tools light up in an "Integrations" strip; each shows status (connected / needs reconnect / not available)
- `[2026-04-14]` If user skips, they can trigger sign-in later from a settings drawer

## Security Boundaries

- `[2026-04-14]` Tokens stored **only** in system keychain (never in files, never in SQLite)
- `[2026-04-14]` MCP server processes inherit tokens via env vars at spawn time — not passed across IPC
- `[2026-04-14]` Rust auth commands use loopback redirect URIs (`http://127.0.0.1:<random-port>/callback`) — no wildcard domains
- `[2026-04-14]` Treat external content returned from MCP as untrusted prompt input (per CLAUDE.md §5)

## Out of Scope ([[decisions]])

- `[2026-04-14]` Okta / SAML / Azure AD — defer to enterprise edition
- `[2026-04-14]` Multi-account-per-provider — one Google account per Tinker install, one GitHub account. Revisit on user ask.
- `[2026-04-14]` Custom OAuth providers (Dropbox, Notion, Slack) — MCP only; each provider picks up its own MCP server

## Open Questions

- How to handle MCP server disabled/enabled state when a user signs out of a provider mid-session
- Whether to pre-bundle MCP server npm packages in the Tauri binary or resolve at first run (affects cold-start time)
- Token refresh UX — silent refresh vs. user-initiated re-auth on 401

## Open-Source References

- `tauri-plugin-keyring` — https://crates.io/crates/tauri-plugin-keyring
- `@opencode-ai/sdk` auth API — https://opencode.ai/docs/sdk/
- Google loopback OAuth guide — https://developers.google.com/identity/protocols/oauth2/native-app#loopback
- GitHub Device Flow (alternative to loopback) — https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app

## Acceptance Criteria

- [ ] User can sign in with Google from the FirstRun screen
- [ ] User can sign in with GitHub from the FirstRun screen
- [ ] Gmail, Calendar, Drive MCP servers are automatically active post-Google sign-in
- [ ] GitHub MCP server is automatically active post-GitHub sign-in
- [ ] Tokens are stored in system keychain (verified on macOS via Keychain Access app)
- [ ] Sign-out removes tokens and disables affected MCP servers
- [ ] Workspace still loads and functions if user skips sign-in

## Connections
- [[vision]] — why SSO is a Tinker moat
- [[positioning]] — see SSO row in feature gap table
- [[ramp-glass]] — Okta → 30+ tools reference
- [[decisions]] — SSO provider decisions
