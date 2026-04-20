---
type: concept
tags: [tinker, decisions, architecture]
---

# Tinker Architectural Decisions

Log of what's explicitly OUT of scope or deferred, with reasoning. Coding agents: check here before proposing anything listed below.

## Decisions Log

### `[2026-04-14]` — No Latent Briefing

- **Decision**: Do NOT implement [[Latent Briefing]] KV cache compaction in v1 (or v2). Optimize with simpler approaches (prompt caching, selective context passing) instead.
- **Why**: Latent Briefing requires direct KV cache access to the worker model, which means self-hosting a model (Ramp's setup: Claude orchestrator + Qwen3-14B on A100). Tinker's target user (nontechnical masses) does not have A100s, will not run Ollama, and should not be asked to pick a model tier. GPT-5.4 via Codex OAuth is the default path (per `tinker-prd.md`) — no KV cache exposure there.
- **Complexity cost**: implementing Latent Briefing means shipping a local GPU runtime + model-weight management → violates "complexity invisible, not absent" principle.
- **Exception**: if a hybrid stack emerges later (e.g., Tinker Enterprise edition) where self-hosting is tolerated, revisit. Not before.

### `[2026-04-14]` — Slack-native presence deferred

- **Decision**: No built-in Slackbot / channel listener in v1 or v2. Slack is a regular MCP integration, not a first-class Tinker surface.
- **Why**: Glass's Slack presence is huge at Ramp because Ramp lives in Slack. Most nontechnical teams Tinker targets use Teams, Google Chat, or mixed stacks. Building Slack-native first would be premature specialization.
- **Alternative**: Native scheduler ([[04-native-scheduler]]) posts outputs to vault + optional notification channels via MCP; Slack is one option, not the primary surface.

### `[2026-04-14]` — No local-model pull via Ollama in first-run path

- **Decision**: Tinker ships with GPT-5.4 via Codex OAuth as the default model. Do NOT auto-install Ollama / pull local models / assume GPU availability.
- **Why**: Nontechnical target users do not have strong laptop compute. Model downloads (7–30GB) destroy the "open the app and start working" flow. Fans spinning up = bad first impression.
- **Alternative**: Power users can configure a different model in `opencode.json` (OpenCode SDK supports this). First-run path uses hosted GPT.

### `[2026-04-14]` — SSO limited to Google + GitHub for v1

- **Decision**: v1 SSO supports Google OAuth (already in PRD) and GitHub OAuth. No Okta, no Azure AD, no SAML.
- **Why**: Enterprise SSO is in PRD §6 non-goals. Google covers Gmail/Calendar/Drive (the most common nontechnical-user tools) + most of Workspace-first companies. GitHub covers the developer sub-segment. These two unlock 80% of target integrations with minimal auth complexity.
- **Revisit**: If enterprise adopters ask for Okta/SAML, build then. Not speculatively.

### `[2026-04-14]` — No mobile dispatch in v1

- **Decision**: No mobile app, no remote trigger, no phone-to-desktop kickoff.
- **Why**: Out of scope per PRD. Desktop-first, local-first. Mobile dispatch is a Glass/Cowork convenience, not a capability gap.

### `[2026-04-14]` — No custom integration clients — MCP only

- **Decision**: Every integration is an MCP server configured in `opencode.json`. No bespoke TypeScript/Rust API wrappers for Gmail, Calendar, Linear, etc.
- **Why**: Already in CLAUDE.md. Reaffirmed here because pre-wired integrations are a Tinker moat and it's tempting to "just write a small wrapper for Gmail." Don't.

### `[2026-04-14]` — Rust stays thin

- **Decision**: Already in CLAUDE.md. Listed here because scheduler and memory pipeline might tempt agents to move work into Rust. Don't.
- **Boundary**: Rust handles sidecar lifecycle, OAuth loopback, keychain, and OS-level scheduling primitives (launchd/Task Scheduler bridge). Everything else is TypeScript.

### `[2026-04-19]` D1 — Consumer-first OSS, enterprise fork path preserved
- **Decision**: Upstream Tinker targets consumer solo users (Gmail/Microsoft/GitHub personal). Enterprise adoption via fork + docs guide, not built into upstream.
- **Why**: User's personal IP ownership; Keysight-style forks add their own compliance/federation without polluting upstream.
- **How to apply**: Never mention specific enterprises by name upstream. Use "enterprise adopters" / "your org". Enterprise-specific features = TODO markers for forks.

### `[2026-04-19]` D2 — Better Auth for identity
- **Decision**: Better Auth is the identity provider for upstream OSS and recommended default for enterprise forks. WorkOS/Clerk/Auth0 NOT adopted.
- **Why**: Local-first desktop app doesn't need SaaS-enterprise features (SCIM, SAML, audit logs, compliance certs). Free + self-hosted + TS-native aligns with local-first principle.
- **How to apply**: If enterprise fork's compliance team mandates WorkOS/Clerk/Auth0, they swap `packages/auth-sidecar/src/main.ts`. Vendor-agnostic contracts (D3) make swap localized.

### `[2026-04-19]` D3 — Vendor-agnostic contracts
- **Decision**: `IdentitySession`, `FederationAdapter`, `IntegrationCredentialStore`, `ServiceCredential` are TypeScript interfaces, not vendor SDK types.
- **Why**: Protects against vendor lock-in; enables swaps without cascading rewrites.
- **How to apply**: If adding a new vendor integration, model its output to fit these contracts — don't leak vendor-specific fields.

### `[2026-04-19]` D4 — Public OAuth client + PKCE everywhere
- **Decision**: No `client_secret` ever embedded in desktop binary. All OAuth flows use PKCE.
- **Why**: Desktop binaries are extractable — any client_secret in code is a public secret.
- **How to apply**: Entra apps must have "Allow public client flows" = Yes. Google Cloud OAuth client type = "Desktop app". Never commit secrets to `opencode.json`.

### `[2026-04-19]` D5 — OS keychain as sole secret store
- **Decision**: Refresh tokens, access tokens, and all bearer-equivalent credentials live only in OS keychain via `tauri-plugin-keyring`.
- **Why**: OS-level encryption; survives filesystem snapshots; user-transparent.
- **How to apply**: Never write tokens to files, SQLite, or config. Metadata (scopes, status, timestamps) may live in SQLite; tokens themselves may not.

### `[2026-04-19]` D6 — Identity and integration are separate layers
- **Decision**: Better Auth handles user identity; `IntegrationCredentialStore` handles per-service tokens. Do not combine.
- **Why**: Lifecycles differ — user session = minutes to hours; integration refresh tokens = weeks to months. Coupling = wrong invalidation behavior.
- **How to apply**: When adding a new integration, store its tokens via `IntegrationCredentialStore`, not via Better Auth's session store.

### `[2026-04-19]` D7 — Per-service JIT consent for consumer
- **Decision**: Consumer users consent per-service at first-use moment, not in a first-run wizard.
- **Why**: Preserves "open app → immediately useful" principle. Wizards feel like Glass-style setup friction we're avoiding.
- **How to apply**: Agent emits `needs_connection` event; UI renders modal; user consents; flow continues. One-time click per service, silent every launch after.

### `[2026-04-19]` D8 — Enterprise fork pattern: org-deploys + single-tenant
- **Decision**: Enterprise fork pattern: one dev + IT admin configure the fork once (app registration, admin consent). Users click sign-in, silent federation. Nontechnical users never register Entra apps.
- **Why**: Scales to every employee with zero per-user setup. Matches Glass's Ramp-wide Okta model.
- **How to apply**: `docs/enterprise-fork-guide.md` is the canonical recipe. Multi-tenant Entra apps only when fork explicitly supports multi-org distribution.

### `[2026-04-19]` D9 — Cross-tenant integration forbidden
- **Decision**: If user logs in with work Microsoft, only work apps can auto-connect. Personal apps need separate OAuth.
- **Why**: Compliance — enterprise tenants don't allow arbitrary external integrations. Prevents accidental work-data leakage to personal services.
- **How to apply**: Federation adapter scopes tokens to the logged-in tenant only. Personal services fall through to per-service OAuth.

### `[2026-04-19]` D10 — MCP-only integrations (reaffirmed)
- **Decision**: Reaffirmation of existing rule. Every integration is an MCP server. No bespoke clients.
- **Why**: Glass + Anthropic both bet on MCP. Building custom clients = duplicate work + maintenance burden.
- **How to apply**: New integration = new MCP server config in `opencode.json`. Never add a custom TypeScript/Rust API wrapper.

### `[2026-04-19]` D11 — Disconnect is narrow by default
- **Decision**: "Disconnect Notion" revokes connection only. Memory entities + mirrored vault files persist. Separate "Wipe Notion data" action handles nuclear cleanup.
- **Why**: Matches user mental model ("disconnect" ≠ "delete"). Avoids accidental data loss + reconnect-friendly.
- **How to apply**: Settings UI shows "Disconnect" as primary action; "Wipe data" as secondary with entity/file counts + irreversibility warning.

### `[2026-04-19]` D12 — Memory entity provenance required
- **Decision**: Every memory entity + relationship carries `sources: Array<{service, ref, lastSeen}>`. Enables clean wipes.
- **Why**: Without provenance, nuclear wipe either deletes too much (wipe cross-referenced entity that also has Slack source) or leaves orphaned edges.
- **How to apply**: Extraction pipeline must tag every entity + edge with its source. Wipe = filter sources array; entity dies only if array empties.

### `[2026-04-19]` D13 — Vault layout separation
- **Decision**: `<vault>/` top-level is user-authored, never touched by agent. `.tinker/mirrors/<service>/` is app-owned and wipeable.
- **Why**: User trust — a disconnect wipe must never delete user's own notes, even if those notes happened to mention content from the disconnected service.
- **How to apply**: Mirror files written by the app go exclusively into `.tinker/mirrors/<service>/`. Top-level edits are user-only territory.

### `[2026-04-19]` D14 — `@tinker/design` is the single source of UI truth
- **Decision**: All UI in `apps/desktop` composes primitives from `packages/design` and references CSS variables from `@tinker/design/styles/tokens.css`. No other palette, font stack, or button/chip/tab implementation is allowed.
- **Why**: Before this refactor, `apps/desktop/src/renderer/styles.css` carried a parallel `--tinker-*` cyan palette, hand-rolled button classes (`.tinker-button`, `.tinker-button-secondary`, `.tinker-button-ghost`), bespoke tab strips, and raw `<input>` fields. That meant two competing design systems lived in-repo. Every pane drifted independently.
- **How to apply**:
  - `Button` / `IconButton` for anything that clicks with a label or icon
  - `Badge` / `ClickableBadge` for status chips (not `.tinker-pill` — that class stays only as a layout shell for edge cases)
  - `SegmentedControl` for tab strips
  - `Toggle` for on/off switches
  - `TextInput` / `SearchInput` for form fields
  - `StatusDot` for live indicator dots
  - Surfaces, borders, spacing, radius, typography → read `--color-*` / `--space-*` / `--radius-*` / `--font-*` tokens only
  - Adding a new token belongs in `packages/design` (separate PR). Never inline hex or `rgba()` in renderer code.
  - If a primitive is missing, extend `packages/design`; do not build a competing component in the app.
- **Canonical reference**: `apps/desktop/src/renderer/routes/design-system.tsx` (playground at `?route=design-system`). If the playground breaks, the app breaks.

### `[2026-04-19]` D15 — Dark-only warm palette, Host Grotesk
- **Decision**: Tinker is dark-only. Accent is amber (`#f9c041`), surfaces are warm near-black (`#1a1612` canvas, `#221d17` elevated). Body font is Host Grotesk Variable.
- **Why**: Matches "workspace, not a chat window" tone — desktop-first, quiet, long-session-friendly. Amber is distinct from the cyan-on-dark AI-slop default. Host Grotesk carries geometric warmth without looking like every other Inter/DM Sans clone.
- **How to apply**: Never reintroduce `Space Grotesk`, `Inter`, `Avenir Next`, or radial cyan gradients. Never add light-mode branches without a design decision first. If a light mode lands, it's a token-layer change in `@tinker/design`, not a per-app override.

### `[2026-04-19]` D16 — Replace Dockview with `@tinker/panes`
- **Decision**: Retire `dockview-react` as the workspace layout engine. `@tinker/panes` (recursive split tree + tabs + zustand store) is the only sanctioned layout primitive going forward. Existing panes migrate feature-by-feature; no big-bang rip-out.
- **Why**: Dockview solves VS Code-style dockable panels with floating windows and cross-group tab merging — capabilities Tinker does not need per PRD. The cost we paid was:
  - Workspace state serialization is opaque (whatever Dockview emits).
  - Tab ordering + pane focus semantics live in a third-party runtime we don't fully own.
  - Plugging cmux-style attention rings and Superset-style workspace metadata into Dockview means fighting its APIs.
  - Layout persistence schema leaks Dockview's internal model into `packages/shared-types`, making migrations brittle.
- **How to apply**:
  - New panes register with `PaneRegistry` keyed by `pane.kind`.
  - Layout state serializes via `selectWorkspaceSnapshot()`; persistence uses the `WorkspaceState<TData>` type, not Dockview's JSON.
  - Migration order (parallel agents): Chat → Today → Scheduler → Settings → Dojo → VaultBrowser → file renderers. Each migration is its own PR with the matching pane moving to a `kind` in the registry.
  - Don't add new `dockview-react` imports. Don't extend `packages/shared-types/LayoutState.dockviewModel`.
  - Remove the `dockview-react` dependency in the PR that ships the last migrated pane.
- **Reference**: See `agent-knowledge/reference/panes-heritage.md` for the architectural synthesis (cmux + OpenCode + Superset) behind this choice.

### `[2026-04-19]` D17 — Device / Host service split
- **Decision**: Separate the process that runs workspace state from the process that displays it. `@tinker/host-service` (standalone server: workspace CRUD, vault + memory I/O, OpenCode sidecar lifecycle, git ops) is spawned and adopted by the Tauri shell but is deployable without Electron/Tauri awareness.
- **Why**: Three pressures converge on this:
  - Headless mode (Ramp Glass's "works while you don't") needs a host with no window.
  - A future mobile companion app should be a device connecting to a laptop host, not a second desktop.
  - Our current `@tinker/bridge` + Rust sidecar conflate workspace logic with presentation; every new feature (e.g. scheduled prompts) accumulates coupling.
- **How to apply**:
  - Host owns: workspace lifecycle, vault indexing, memory store, OpenCode sidecar lifecycle, git operations, scheduled jobs, integration credential store.
  - Device owns: Tauri shell, renderer UI, platform bridges (dialogs, clipboard, notifications), tray/menu, updater.
  - Host identity (`hostId`, `hostName`) is intrinsic — generated at first run from machine metadata. NEVER passed in as config.
  - Host exposes a PSK-authenticated HTTP/WS surface with `health.check`, `host.info`, `workspace.*`, and streaming endpoints for terminal + filesystem + chat.
  - Coordinator pattern for sidecar: spawn → health-poll → record `{pid, port, secret}` → discard ChildProcess handle → `unref` so it survives app quit → manifest-file-based adoption across restarts. No mutate-then-call managers; pass `SpawnConfig` per call.
  - Don't build a cloud sync layer yet (see D18). But don't close the door either — keep host interfaces cloud-reachable in principle.
- **Reference**: `agent-knowledge/features/11-host-service.md`.

### `[2026-04-19]` D18 — Defer cloud sync / ElectricSQL
- **Decision**: No cloud sync, no ElectricSQL proxy, no device-to-device pairing in v1. The host/device split (D17) must be buildable without this, but the sync runtime stays off the roadmap.
- **Why**: Local-first principle still overrides. Glass's collab features came after Ramp validated the single-user story. Adding sync prematurely = premature schema lock-in + cloud dependency.
- **How to apply**: If you're about to add `electric-sql`, a WebSocket sync client, or a "share workspace" flow — stop. Revisit once we have opinionated user behavior to sync.

### `[2026-04-19]` D19 — Workspace attention coordinator
- **Decision**: Every workspace surface gets a single attention coordinator (`@tinker/attention`) modeled after cmux's `WorkspaceAttentionCoordinator`. Unread rings, focus flashes, manual-unread toggles, and notification-arrival decisions go through it.
- **Why**: Notification UX rots fast without a coordinator — panes ring when they shouldn't, flashes compete, focus-state isn't respected. cmux already solved this; we codify the rules.
- **How to apply**:
  - Pane generates a signal via `attention.signal({ paneId, reason })`.
  - Coordinator decides `flash | skip` based on focus state + competing indicators.
  - Navigation flashes (teal) get suppressed when a notification flash (blue) is active on the same workspace.
  - Rendering hooks: pane edge ring, tab dot, workspace sidebar card badge. All three read from the same store.
- **Reference**: `agent-knowledge/features/12-attention-coordinator.md`.

### `[2026-04-19]` D20 — `ask_user` overlay for agent-initiated clarifications
- **Decision**: Any clarification an agent needs from the user mid-run renders as an interactive overlay with clickable options, not plain-text prose the user has to type a reply to.
- **Why**: Superset shipped this for a reason — plain-text questions get lost in a chat log. Overlays force the decision and give the agent a typed response.
- **How to apply**:
  - Agent emits an `ask_user` event with `{ id, prompt, options[] }`.
  - Chat pane pauses streaming + renders overlay.
  - User click resolves to a typed answer that the agent resumes on.
  - Keyboard-navigable; Esc does NOT dismiss (must pick an option) unless `options` includes `{id: 'cancel'}`.
  - Don't use this for freeform input — use a textbox pane for that.

### `[2026-04-19]` D21 — Co-located component folder convention
- **Decision**: One folder per component. `ComponentName/` contains `ComponentName.tsx`, `index.ts` barrel, co-located `ComponentName.test.tsx`, `ComponentName.module.css` (when needed), and any component-local hooks / utils under `ComponentName/{hooks,utils}/`.
- **Why**: Cuts time spent discovering tests, makes deletion safe (remove the folder, gone), and matches Superset's AGENTS.md structure which multiple parallel agents can follow without conflict.
- **How to apply**:
  - Used once under a parent → nest under the parent's `components/`.
  - Used in 2+ places → promote to the smallest shared parent's `components/`.
  - Last-resort shared location is `apps/desktop/src/renderer/components/` or `packages/design/src/components/`.
  - Exception: `packages/design` primitives may stay as flat files (`Button.tsx` + `Button.css`) because they predate this rule and are already flat.
  - Don't create multi-component files. One component per file.

### `[2026-04-19]` D22 — No mutate-then-call managers
- **Decision**: Never stage state onto a service before invoking it (`mgr.setConfig(x); mgr.start()`). Pass config as arguments to each call.
- **Why**: Temporal coupling hides bugs. The mutate + call pair often races with restart/retry logic and makes unit-testing impossible.
- **How to apply**: New APIs take `(config, args)`. Retry logic calls with a fresh config object, not a bound value.

## Open Questions (not yet decided)

- **Scheduler implementation**: in-process TypeScript cron vs. OS-level (launchd/Task Scheduler/systemd). Leaning in-process for cross-platform simplicity; revisit when app sleep/wake behavior is tested.
- **Dojo skill storage**: vault filesystem (human-readable, Git-friendly) vs. SQLite (faster queries). Leaning vault for human readability; Sensei can build an SQLite index on top.
- **Memory pipeline trigger**: time-based (every 24hr) vs. event-based (on tool use) vs. hybrid. Glass uses time-based; Tinker likely hybrid — daily sweep + incremental on tool use.

## Connections
- [[vision]]
- [[positioning]]
- [[ramp-glass]]
- [[06-subagent-orchestration]] — where Latent Briefing would have lived
