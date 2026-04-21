---
type: feature
status: not started
priority: p0
pillar: M8
depends_on: ["@tinker/auth-sidecar scaffold (present)"]
supersedes: ["01-sso-connector-layer (consumer subset)"]
mvp: true
---

# M8 — Identity (Better Auth) + per-user chat-history persistence

## Goal

Tinker is a per-user app. Each user signs in once with Google, GitHub, or Microsoft. Sessions, memory, and chat history are scoped to their user id. Chat histories persist as append-only JSONL inside the session folder so the folder tells you what was said where — even if the app database is lost.

## Scope

### Identity

- **Better Auth v1** as the local identity sidecar in `packages/auth-sidecar` (scaffold exists; MVP wires real providers).
- Three providers, consumer only: **Google**, **GitHub**, **Microsoft** (personal / consumer Microsoft 365). No enterprise SSO (SAML, SCIM, tenant-locked federation) — that stays deferred per D1 / D8.
- PKCE flow over loopback redirect URIs. No `client_secret` embedded in the desktop binary (D4).
- Rust binds OS-level loopback ports for the redirect URIs and spawns the auth sidecar as a coordinated process (same coordinator pattern as OpenCode sidecar — D22).
- Refresh tokens live only in the OS keychain via `tauri-plugin-keyring` (D5). SQLite stores session metadata only, never tokens.
- SQLite `users` table: `{ id, provider, provider_user_id, display_name, avatar_url?, email?, created_at, last_seen_at }` with a unique composite index on `(provider, provider_user_id)`. Sign-in upserts.

### Per-user scoping

- `sessions.user_id` FK → `users.id`. Session switcher filters to the current user only.
- Memory root contains per-user subdirs (`<memory_root>/<user-id>/`). MCP env vars point at the active user's subdir.
- User switch (sign-out → sign-in different account) → re-resolve active user → refresh memory subdir → respawn OpenCode with new `SMART_VAULT_PATH`.

### Per-user chat-history persistence

- Every OpenCode SSE event for a session is appended as a single JSON line to `<session.folderPath>/.tinker/chats/<user-id>/<session-id>.jsonl`. User prompts, assistant deltas, tool uses, reasoning — everything.
- Event shape: `{ ts: ISO8601, event: string, data: unknown }`. Exact schema in `agent-knowledge/reference/chat-history-format.md`.
- On session open, renderer reads the JSONL first + populates the Chat pane with prior messages before resuming the SSE subscription. No "first paint" gap.
- The JSONL is the durable source of truth. If SQLite is lost, the folder still carries the history.
- No encryption in MVP — already on user's disk in a user-chosen folder. Encryption is post-MVP if asked for.

### Silent sign-in

- On cold launch: Rust checks keychain for any refresh token → Better Auth sidecar validates it → renderer resolves current user without showing the sign-in screen. Invalid/expired token falls through to the sign-in screen.

## Out of scope

- Enterprise SSO (SAML, SCIM, Okta, Entra ID tenant federation). Enterprise forks only per D1 / D8.
- Passwordless / magic-link sign-in. Providers only in MVP.
- Multi-account concurrent sign-in. One user active at a time.
- Social graph / team / workspace sharing.
- Avatar upload or local edits. Provider avatars only, read-only.
- Encrypted chat history. JSONL is plain text on disk.
- Federated identity pools / account merging across providers. Post-MVP.

## Acceptance

- Three provider sign-in flows complete successfully (research doc `reference/better-auth-config.md` lists exact redirect URIs + app registrations per provider).
- Refresh tokens found only in OS keychain. `grep`ing SQLite dumps or files for token strings finds nothing.
- Sign-in → `users` row upserted → session switcher shows that user's sessions only.
- Sign-out → keychain cleared → app returns to sign-in screen.
- Sign-in as different provider on the same machine → different user row → different session list → different memory subdir.
- Silent sign-in works on cold launch with a valid refresh token.
- Every streamed message appended to `<folder>/.tinker/chats/<user-id>/<session-id>.jsonl`.
- Reopening a session hydrates the Chat pane from JSONL before any SSE subscription.
- Integration test from M8.15 passes end-to-end.

## Atomic tasks

See `agent-knowledge/context/tasks.md` §M8. 15 tasks, most S/M, one L (sign-in UX) flagged for subdivision if needed.

## Notes for agents

- **OAuth app registration is a human step.** The research doc (M8.1) specifies redirect URIs; the human maintainer registers apps with Google / GitHub / Microsoft once and writes the client IDs into a local-only `auth-config.local.json` (gitignored). Agents do not register apps.
- **Loopback redirect URIs**: Better Auth on desktop uses `http://127.0.0.1:<random-port>/auth/callback`. Rust binds the port at sidecar spawn and passes it to Better Auth via the sidecar's startup config. Not via mutate-then-call (D22).
- **Chat-history write path must not block streaming.** Append via an async queue; drop the write + log if disk is full, don't stall the UI. M2.11 is a bridge module that subscribes to the same event stream Chat.tsx does and writes in parallel.
- **Hydration ordering matters**: on session open, set Chat pane to "hydrating" state → read JSONL → render messages → subscribe to new SSE events. Don't subscribe first or you'll race.
- **Token refresh**: Better Auth handles refresh internally — sidecar manages it. Renderer calls `auth/session` periodically (e.g. on workspace mount) and the sidecar silently refreshes if needed. If refresh fails, sidecar returns `unauthenticated` → renderer routes to sign-in.
- **Cross-reference**: feature [[01-sso-connector-layer]] contains the enterprise spec; do not extend that for MVP. The consumer subset described here is the only auth scope in MVP.
