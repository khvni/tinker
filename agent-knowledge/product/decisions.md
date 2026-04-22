---
type: concept
tags: [tinker, decisions, architecture]
---

# Tinker Architectural Decisions

Log of what's explicitly OUT of scope or deferred, with reasoning. Coding agents: check here before proposing anything listed below.

## Decisions Log

### `[2026-04-14]` — No Latent Briefing

- **Decision**: Do NOT implement [[Latent Briefing]] KV cache compaction in v1 (or v2). Optimize with simpler approaches (prompt caching, selective context passing) instead.
- **Why**: Latent Briefing requires direct KV-cache access to the worker model, which means owning the inference runtime (Ramp's setup: Claude orchestrator + Qwen3-14B on A100). Tinker does not own the runtime — OpenCode is the agent backend and it owns all model auth + provider selection (local or cloud). We build a GUI on top of its SDK. KV-cache access is not exposed through that surface, and reaching for it would mean bypassing OpenCode and shipping our own inference stack.
- **Complexity cost**: implementing Latent Briefing means shipping a local GPU runtime + model-weight management + a parallel agent stack alongside OpenCode → violates "complexity invisible, not absent" principle.
- **Exception**: if a hybrid stack emerges later (e.g., Tinker Enterprise edition) where self-hosting is tolerated, revisit. Not before.

### `[2026-04-14]` — Slack-native presence deferred

- **Decision**: No built-in Slackbot / channel listener in v1 or v2. Slack is a regular MCP integration, not a first-class Tinker surface.
- **Why**: Glass's Slack presence is huge at Ramp because Ramp lives in Slack. Most nontechnical teams Tinker targets use Teams, Google Chat, or mixed stacks. Building Slack-native first would be premature specialization.
- **Alternative**: Native scheduler ([[04-native-scheduler]]) posts outputs to vault + optional notification channels via MCP; Slack is one option, not the primary surface.

### `[2026-04-14]` — No local-model pull in first-run path

- **Decision**: Tinker does not own model choice. OpenCode does. First-run path must not auto-install Ollama, pull local model weights, or assume GPU availability. The default model at first launch is whatever OpenCode is configured to use out of the box (a hosted cloud model), chosen so the app is usable immediately on a stock laptop with no GPU.
- **Why**: Nontechnical users do not have strong laptop compute. Model downloads (7–30GB) destroy the "open app → start working" flow. Fans spinning up on first launch = bad first impression. Tinker's role is a GUI on top of the OpenCode SDK, not a model distribution channel.
- **Alternative**: Users (and power users) change provider or model through the in-app model picker, which is a thin UI over OpenCode's existing provider/model configuration (local via Ollama/LM Studio, cloud via Anthropic/OpenAI/etc.). OpenCode already handles the auth + SDK plumbing for every supported provider — we do not replicate that.

### `[2026-04-14]` — v1 identity = Better Auth, Google + GitHub + Microsoft (consumer OSS)

- **Decision**: Tinker does NOT build a custom auth layer. Identity is handled by **Better Auth** (see D2). Upstream Tinker is a consumer-grade OSS app — the Better Auth config enables **Google, GitHub, and Microsoft as sign-in providers**. Enterprise-only SSO paths (dedicated Okta / Entra tenant federation, SAML, SCIM, etc.) are explicitly **NOT** part of upstream and will not be built here.
- **Why**: Writing OAuth loopback + PKCE + session management from scratch is a solved problem — Better Auth already ships that, including a built-in Microsoft provider that accepts personal Microsoft accounts (Outlook, OneDrive, personal Microsoft 365). The three providers cover the three consumer surfaces we care about: Google = Workspace-first users, Microsoft = Outlook/Office personal users, GitHub = developers. That unlocks the majority of consumer users with zero bespoke auth code. Shipping enterprise federation upstream would invite compliance + tenant-admin scope we don't want to own (see D1: consumer-first OSS, enterprise via fork).
- **Note**: This decision is strictly about *identity* (who is signed into the Tinker app). Service-level OAuth for Gmail / Calendar / Drive / Outlook / Linear / etc. is a separate concern handled via MCP servers in `opencode.json` — OpenCode owns that token lifecycle. Identity ≠ integration credentials (see D6).
- **Forks**: Enterprise adopters that need tenant-locked Entra ID, Okta, SAML, or SCIM build that by swapping / extending Better Auth providers in their fork's `packages/auth-sidecar`. That is the canonical fork path per [[D1]] / [[D8]] — upstream contributors should not land enterprise-federation code here.

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
  - Migration order (parallel agents): Chat → Today → Scheduler → Settings → Playbook → VaultBrowser → file renderers. Each migration is its own PR with the matching pane moving to a `kind` in the registry.
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

### `[2026-04-20]` D23 — Reopens D15: dual-theme palette, light default
- **Decision**: D15 ("dark-only") is reopened. Tinker now ships a dual-theme palette: **light mode is the default**, dark mode opts in via `[data-theme="dark"]` on any ancestor of the UI tree. The amber brand value (`#f9c041`) stays constant across themes; only surfaces, ink, and semantic hues flip.
- **Why**: Design exploration against Ramp Glass reference shots showed the workspace + Memory + Agents layouts read more naturally on warm cream paper than on warm near-black — the light ground gives long-session content (tables, markdown, run history) the readability users actually want. Dark mode remains a first-class alternate, not a deprecation.
- **How to apply**:
  - Token-layer change only — `packages/design/src/styles/tokens.css`. No per-app palette branches.
  - Light-mode mood: *bookish editorial* — warm cream (`#fbf8f2`) ground, white elevated surfaces, ink text (`#1a1612`), amber accent with dark ink counterpart.
  - Dark-mode mood (unchanged): *candlelit terminal* — warm near-black ground, warm-white text, amber accent with warm-black ink.
  - New UI work designs in light mode first; dark mode verified as a review pass, not a separate design.
  - Don't introduce light-mode branches in component CSS — tokens are theme-aware, components stay theme-neutral.
  - If `prefers-color-scheme` respect becomes desired later, route it through the same `[data-theme]` attribute (set once at app boot), not per-component media queries.

### `[2026-04-20]` D24 — Rename Dojo → Playbook, Sensei → Coach
- **Decision**: Drop the martial-arts loan. Tinker's skill marketplace is the **Playbook**; the role-based skill discovery layer is **Coach**. Ramp Glass keeps "Dojo" / "Sensei" in its own product; Tinker has its own names.
- **Why**: Two pressures.
  1. The martial-arts frame is a direct lift from Ramp — we are consumer-OSS and should not be read as a Glass clone (per [[D1]]). Distinct names reinforce that.
  2. Dojo/Sensei require cultural-loan vocabulary that doesn't carry equally across audiences. Playbook/Coach is idiomatic English (sports + business) and preserves the same "curated collection + a guide who picks the right one" mental model without the loan.
- **How to apply**:
  - Feature files: `02-playbook-skill-marketplace.md` + `05-coach-skill-discovery.md` (old filenames kept as `aliases:` frontmatter for searchability).
  - Pane + component names: `Playbook.tsx` / `Playbook` component; pane `kind: 'playbook'`.
  - Future package: `packages/coach` (not scaffolded yet — see [[05-coach-skill-discovery]]).
  - CSS class prefix: `.tinker-playbook-*` (replaced `.tinker-dojo-*`).
  - UI copy: eyebrow / heading "Playbook"; prompt-injection header uses "The following Playbook skills are active…".
  - Reference material about Ramp (`ramp-glass.md`, `ramp-ai-adoption.md`, `claude-cowork.md`) keeps the original "Dojo" / "Sensei" terms when describing Ramp — Tinker's rename does not rewrite history of another product.
  - Don't reintroduce "Dojo" or "Sensei" for Tinker-context surfaces (UI, features, code, decisions). Old session summaries stay as-is (historical record).
- **Persistence note**: persisted Dockview layouts predating the rename carry `component: 'dojo'` IDs that will fail to render against the new `'playbook'` registry key. We accept this pre-v1 breakage because the full Dockview schema is being retired under [[D16]] — users re-open the pane (via Chat "Save as skill" or future LeftRail nav) and the new snapshot saves with the correct key. Do not add a backwards-compat alias to the component registry (TypeScript forbids unknown `TabKind` keys anyway).

### `[2026-04-21]` D25 — MVP refocus: ship one chat interface perfectly, defer everything else

- **[2026-04-21] Amended same-day**: Better Auth (identity) is IN scope for MVP. Chat histories are per-user and must persist to the session folder so the app knows what was said where. See pillar M8 + [[28-mvp-identity]]. The rest of the deferral list stands.

- **Decision**: Tinker v0.1 ships exactly eight pillars — panes+tabs workspace, folder-scoped sessions, in-line doc renderer, markdown-rendered chat + model picker, context-usage badge, desktop-native memory filesystem, three preloaded auth-free MCP servers (qmd, smart-connections, exa), and a **Better Auth identity layer with per-user chat-history persistence** (Google + GitHub + Microsoft providers only). Every other feature in the existing backlog (Playbook, Coach, Scheduler, Attention, Workspace Sidebar, Host-service split, full Connection gate, Sub-agents, Session history windowing, full entity-memory pipeline, enterprise SSO / SAML / SCIM, additional MCP integrations beyond the three preloaded, automations, custom agents) is **deferred to post-MVP** and marked as such in the feature files.
- **Why**:
  1. **Breadth was drowning depth.** 15 features in-flight, each 30-70% done, zero perfect. A foundation nobody is shipping on top of is not a foundation — it's overhead.
  2. **MVP must demonstrate one loop perfectly.** Open a folder → chat with OpenCode in it → see markdown-rendered replies → open any file referenced → search memory via built-in MCP. If that loop is tight, every deferred feature slots in cleanly. If it isn't, deferred features inherit brokenness.
  3. **Atomic tasks enable async agent parallelism.** Thin slices (≤1 PR each, explicit acceptance criteria) let delegated agents open PRs without coordinating, which is the unlock the user is targeting.
- **How to apply**:
  - Backlog enumerated in `agent-knowledge/context/tasks.md` under **M0 — MVP** section. Post-MVP table stays below as historical scope.
  - New MVP feature specs live in `agent-knowledge/features/20–27-mvp-*.md`. Old feature files (01–15) keep their content but gain `deferred: post-mvp` in frontmatter + a header note pointing to D25.
  - Any PR outside the M0 table without an explicit "unblocks MVP task X" rationale gets rejected — even if code is good.
  - Re-entry bar for a deferred feature: MVP must ship + user must ask for it. No pre-emptive "while we're here" adds.
  - Deletion vs deferral: feature *files* stay (reasoning > LOC). Runtime *code* for deferred features (scheduler, playbook, attention, auth-sidecar) may stay in-tree but MUST NOT be wired into `Workspace.tsx` / `App.tsx` routing. Dead code is acceptable short-term; dead code on the critical-path UI is not.
- **Non-goals reaffirmed** (from existing PRD §6, relisted so MVP agents don't drift): multi-provider model support, cloud sync, mobile dispatch, enterprise SSO (SAML / SCIM / dedicated-tenant federation — stays per D1 / D8), legacy desktop-shell compatibility, prompt marketplace. Plus D25 adds: no entity extraction / FTS indexing (memory = flat markdown files read top-N-recent), no vault-wide indexing (folder scope = session scope), no sub-agent orchestration, no scheduled jobs, no additional MCP integrations beyond qmd / smart-connections / exa (built-in integrations like GitHub / Linear / Gmail wait until post-MVP), no Playbook / Coach skill marketplace.
- **In scope for MVP identity**: Google + GitHub + Microsoft consumer OAuth via Better Auth (per D2 / D4). Per-user chat-history persistence to `<session-folder>/.tinker/chats/<user-id>/<session-id>.jsonl`. Per-user memory scoping. Tokens in OS keychain (D5).

### `[2026-04-22]` D26 — FirstRun killed; workspace opens direct; folder picker in composer

- **Decision**: Delete `FirstRun.tsx` and the tri-panel sign-in/connected-tools/vault wizard. App boot opens directly into a single Chat pane. Folder selection happens from a button next to ModelPicker in the Chat composer (file icon + "Select folder"). No sign-in screen on cold boot — Better Auth (M8) is reachable from Settings only and is **deferred from the boot path** (per TIN-187 + sibling TIN-188 "Continue as guest" CTA). Sessions schema gains `user_id='local-user'` placeholder until real sign-in attaches.
- **Why**:
  1. **First useful outcome ≠ a setup wizard.** D25 principle: "first useful outcome should come from using the app, not from studying setup docs." Three boxy gray panels before the user sees a chat box violate that.
  2. **Composer-side folder picker = lower friction.** ModelPicker already lives next to the composer; folder picking is the same kind of per-session choice. Co-locating them means "new session" is a single composer interaction, not a route change.
  3. **Auth on boot blocks testing + adds compliance surface we don't want yet.** D1 says enterprise federation stays out of upstream; even consumer OAuth on cold boot creates a permission/loop UX problem before the user knows what they're signing into. Defer until Settings → Account.
- **How to apply**:
  - Delete `FirstRun.tsx` + the route. Workspace mounts directly. (TIN-187)
  - Add folder-picker button next to ModelPicker in Composer per Paper artboard. Click → `open_folder_picker` → bind session → spawn OpenCode. (TIN-187)
  - When no session exists, Chat pane shows a calm "Pick a folder to start" hint inline — not a separate route or modal.
  - Sessions table writes `user_id='local-user'` until M8 sign-in re-enters via Settings; on first real sign-in the placeholder rows migrate to the new user-id (migration scripted later — see M8 follow-up).
  - Sign In screen retains "Continue as guest" CTA (TIN-188) for users who reach it manually but don't want auth.
  - **Don't** reintroduce a boot-time sign-in gate without reopening this decision.
- **Supersedes**: TIN-20 (M2.6 first-run folder picker screen) — closed as superseded by TIN-187. The folder-picker-as-screen idea is replaced by folder-picker-in-composer.
- **Touches**: `apps/desktop/src/renderer/App.tsx` (route), `apps/desktop/src/renderer/panes/Chat/Composer.tsx` (button), `packages/memory/src/sessions.ts` (placeholder user_id), `tinker-prd.md` §2.2 + §2.8, `agent-knowledge/features/21-mvp-session-folder.md`.

### `[2026-04-22]` D27 — Workspace boots as guest; Better Auth starts on demand

- **Decision**: Cold boot lands directly in Workspace under a local `guest` identity. Better Auth is no longer part of boot. The auth sidecar starts only when the user explicitly clicks Google / GitHub / Microsoft from Settings → Account. Operationalises the TIN-188 half of D26.
- **Why**: Boot-time sign-in and setup screens added friction and broke the "first useful outcome happens in the product" rule. The workspace is useful before identity is configured.
- **How to apply**:
  - Always ensure a `users` row exists for `id='guest'`, `provider='local'`, `provider_user_id='guest'`.
  - When no provider session is active, `guest` is the current user for session FKs, memory subdir resolution, and layout persistence.
  - Settings → Account is the sanctioned entry point for consumer sign-in from the workspace.
  - Do not warm-start Better Auth from Tauri `setup()`.
  - Sign-out returns the app to guest workspace mode, not a sign-in gate.

### `[2026-04-22]` D28 — Light tokens follow Paper 9J-0 exactly

- **Decision**: The `:root` light-theme surface tokens (`--color-bg-primary`, `--color-bg-elevated`, `--color-bg-panel`, `--color-bg-input`, `--color-bg-hover`) now match Paper 9J-0 1:1. This implicitly reopens D15 by reasserting the dual-theme direction (D23) and picks a single convention so the token layer stops contradicting the written brief.
  - `bg-primary: #fefcf8` — warm cream canvas (supersedes `#f4f3f2`)
  - `bg-elevated: #ffffff` — pure white cards / modals
  - `bg-panel: #f9f5ec` — deeper cream for sidebar / rail surfaces
  - `bg-input: #fefcf8` — inputs sit on the cream canvas (kept per audit §5; elevated surfaces handle white)
  - `bg-hover: #f4efe4` — cream hover lift (darker than primary)
- **Why**: The prior `:root` block carried a comment ("cool neutral canvas … D23 layer reversal") that described a stale intermediate state and contradicted D23 as written (bookish cream ground, white elevated surfaces). Paper 9J-0 is the designer-authored source of truth; the audit in `agent-knowledge/reference/paper-design-audit.md` documents the drift. Pick one convention and document it — tokens follow Paper.
- **How to apply**:
  - Add or change a surface token in `packages/design/src/styles/tokens.css` only. Never inline the hex in renderer code.
  - The design-system playground swatch data array (`SURFACE_SWATCHES` in `apps/desktop/src/renderer/routes/design-system.tsx`) mirrors these values as documentation labels — keep it in lockstep when tokens move.
  - `[data-theme="dark"]` is untouched — the audit confirms dark is already 1:1 with Paper 6M-0.
  - Accent / text / semantic values are also already Paper-aligned and stay put.
  - `--color-toggle-knob: #ffffff` matches the new elevated token by value — leave it literal since it is a component-local theme token, not a semantic role.
- **Follow-up**: author a dark-mode Paper artboard so future dark-token drift can be audited against a reference the same way light is today. Filed outside this decision; track via a post-MVP design task.

## Open Questions (not yet decided)

- **Scheduler implementation**: in-process TypeScript cron vs. OS-level (launchd/Task Scheduler/systemd). Leaning in-process for cross-platform simplicity; revisit when app sleep/wake behavior is tested.
- **Playbook skill storage**: vault filesystem (human-readable, Git-friendly) vs. SQLite (faster queries). Leaning vault for human readability; Coach can build an SQLite index on top.
- **Memory pipeline trigger**: time-based (every 24hr) vs. event-based (on tool use) vs. hybrid. Glass uses time-based; Tinker likely hybrid — daily sweep + incremental on tool use.

## Connections
- [[vision]]
- [[positioning]]
- [[ramp-glass]]
- [[06-subagent-orchestration]] — where Latent Briefing would have lived
