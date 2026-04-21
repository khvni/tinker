---
type: session
date: 2026-04-21
topic: MVP refocus + atomic task decomposition
---

# Session — MVP refocus (D25)

## What happened

User observed development was spread across 15 features, none of which were shipping to finished quality. Requested tabula-rasa refocus on a tight MVP: seven pillars, each delivered well, with task breakdowns atomic enough to hand to async PR-creating agents in parallel.

The seven pillars:

1. **Panes + tabs workspace** (M1) — `@tinker/panes` only; Dockview removed; single-Chat-pane default.
2. **Folder-scoped session** (M2) — every session binds to a local folder; OpenCode spawned with `--cwd`; no sign-in.
3. **In-line document renderer** (M3) — PDF / XLSX / DOCX / PPTX / HTML / code / markdown, library-picks research-gated.
4. **Chat markdown + model picker** (M4) — GFM render, collapsed tool calls/thinking, rAF-debounced streaming, OpenCode-Desktop-parity picker.
5. **Context usage badge** (M5) — pill in Chat header, three-color scale, SDK-sourced usage.
6. **Memory filesystem** (M6) — desktop-global folder of markdown, user-relocatable, top-N recency injection.
7. **Built-in MCPs** (M7) — qmd + smart-connections + exa, zero-config, env-wired to memory folder.

## What changed in the repo

- **New decision**: D25 in `agent-knowledge/product/decisions.md` — MVP refocus, explicit deferral list, re-entry bar.
- **PRD rewrite**: `tinker-prd.md` fully rewritten around the seven pillars. Old feature table replaced. Architecture section updated to reflect folder-scoped-session model + MVP pane kinds. Non-goals list expanded with MVP-specific deferrals (no Better Auth, no entity extraction, no vault-wide indexing, no scheduled jobs, no sub-agents).
- **Tasks rewrite**: `agent-knowledge/context/tasks.md` is now a per-pillar atomic task matrix (M1–M7). Each row = 1 PR-sized thin slice with size (S/M/L), explicit dependencies, acceptance criteria, and claim rules for async agents.
- **New MVP feature specs**: `features/20-27-mvp-*.md` — one per pillar (split M4 into 23-chat-markdown + 24-model-picker for atomic delegation).
- **Deferred banners** on features 01–08 and 11–15. Feature 09 (design-system) left untouched (shipped). Feature 10 (tinker-panes) flagged as architectural reference; MVP execution continues under 20-mvp-panes-workspace.
- **Vision update**: tech-foundation line corrected to `@tinker/panes` (Dockview was stale). MVP lens note prepended.

## Research tasks created (deliverable = reference doc)

- M3.1 → `reference/inline-renderers.md` (library picks per format, licenses, bundle sizes)
- M4.1 → `reference/opencode-desktop-model-picker.md` (UI parity doc)
- M5.1 → `reference/opencode-sdk-usage.md` (SDK field paths for token usage + context window)

These gate downstream impl tasks. An async agent should pick these up first.

## Follow-ups for human maintainer

- Linear setup: user offered to configure. Recommend accepting — parallel-agent model benefits from ticket-per-atomic-task + dependency graph + auto-PR wiring. Keep `context/tasks.md` as the canonical text-mirror so agents without Linear access aren't blocked.
- `.github/copilot-instructions.md` or `.cursor/rules` (task X.1) is the cheapest onramp for delegated agents — single pointer to D25 + tasks.md + claim rules.
- CI gate (task X.2): `pnpm -r typecheck && pnpm -r test` required before merge.

## Deferred packages (in-tree but unwired)

- `packages/scheduler` — keep; unreferenced from MVP UI.
- `packages/attention` — keep; unreferenced from MVP UI.
- `packages/auth-sidecar` — keep; unreferenced from MVP UI.
- `apps/desktop/src/renderer/panes/{Today,SchedulerPane,Playbook,VaultBrowser}.tsx` — to be retired during M3.11 (delete or move to `_deferred/`).

## What did NOT change

- Decisions D1–D24 remain in force.
- `@tinker/design`, `@tinker/panes`, `@tinker/memory` runtime code unchanged.
- `opencode.json` unchanged (M7.1 will clean it up during MVP impl).
- `apps/desktop/src/renderer/` runtime code unchanged (M1 tasks will sweep Dockview usage).
- `CLAUDE.md` / `AGENTS.md` build-guide-level content intact. MVP scope is a tasks.md + decisions.md + PRD concern; build rules stay the same.

## Open questions I did not answer

- **Linear vs tasks.md authority**: recommended Linear for tracking + tasks.md as text mirror. User to decide.
- **Where to put deferred pane .tsx files**: delete vs `apps/desktop/_deferred/`. M3.11 defers this to the implementing agent; both options are fine as long as they're removed from build.
- **Exact OpenCode SDK field names** for usage + picker parity: gated on M4.1 + M5.1 research tasks.

## Amendment — same-day scope correction (2026-04-21)

User corrected the deferral call on identity: **Better Auth IS MVP**. Chat histories are per-user and need to persist to the session folder so the app knows what was said where.

Changes applied on top of the original commit:

- **D25 amended** — removed "no Better Auth in MVP" non-goal; added explicit in-scope bullet for Google/GitHub/Microsoft consumer OAuth + per-user chat-history persistence; enterprise SSO (SAML/SCIM) stays deferred per D1/D8.
- **Eighth pillar added**: M8 Identity + per-user chat-history persistence.
- **PRD** §2.8 added; §1 summary + §3 architecture diagrams + §3 runtime flows all updated to include sign-in, per-user subdirs, JSONL history, silent sign-in. §5 quality bar + §7 acceptance checklist + §6 non-goals reframed.
- **tasks.md** — new M8 section with 15 atomic tasks (1 L, 7 M, 7 S). M2 gains 2.11 (JSONL writer) + 2.12 (hydration) + updated rows for user_id FK + current-user filtering. M6 rewritten to use `<memory_root>/<user-id>/` per-user subdir. M7 7.7 extended to trigger on user switch too. Acceptance checklist now covers sign-in, silent re-auth, user-switch scoping, JSONL persistence, keychain discipline.
- **Features** — `01-sso-connector-layer.md` banner updated from "DEFERRED" to "post-mvp-partial": consumer subset moves to M8, enterprise stays deferred. New `28-mvp-identity.md` spec created.
- **Post-MVP table in tasks.md** — row 01 updated to reflect partial deferral (enterprise only).

What stayed deferred from the original refocus: Playbook (02), Coach (05), memory-pipeline-full (03), scheduler (04), sub-agents (06), MCP-proxy-layer (08), host-service (11), attention-wiring (12), sidebar (13), session-history-windowing (14), full connection-gate (15). Plus: additional MCP integrations beyond the three preloaded, automations, custom agents.

Research tasks now four:
- M3.1 → `reference/inline-renderers.md`
- M4.1 → `reference/opencode-desktop-model-picker.md`
- M5.1 → `reference/opencode-sdk-usage.md`
- **M8.1 → `reference/better-auth-config.md`** (new — blocks provider wiring)
- **M8.14 → `reference/chat-history-format.md`** (new — schema for 2.11 + 2.12)
