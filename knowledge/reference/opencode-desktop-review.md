---
type: tool
tags: [opencode, desktop, tauri, reference, architecture]
---

# OpenCode Desktop (dev branch) — Architecture Review

Scope: review of `anomalyco/opencode` `dev` branch, focused on `packages/desktop` and `packages/desktop/src-tauri`.

## Sources Reviewed

- `[2026-04-15]` Repo: `https://github.com/anomalyco/opencode` (branch `dev`) cloned locally for code reading
- `[2026-04-15]` Desktop shell entry + platform adapter: `packages/desktop/src/index.tsx`
- `[2026-04-15]` Loading screen orchestration: `packages/desktop/src/loading.tsx`
- `[2026-04-15]` Native menu + updater + CLI install flows: `packages/desktop/src/menu.ts`, `src/updater.ts`, `src/cli.ts`
- `[2026-04-15]` Typed command/event bridge: `packages/desktop/src/bindings.ts` (Tauri Specta-generated)
- `[2026-04-15]` Sidecar lifecycle + init gating: `packages/desktop/src-tauri/src/lib.rs`, `src-tauri/src/server.rs`

## High-Value Patterns Worth Copying

- `[2026-04-15]` **Typed Rust↔TS contract via Specta bindings**: command/event interfaces generated into TypeScript; avoids stringly-typed `invoke` drift and reduces runtime mismatch bugs
- `[2026-04-15]` **Two-phase sidecar readiness**: sidecar URL/credentials exposed immediately after spawn, health check continues in background; UI can boot early while readiness settles
- `[2026-04-15]` **Migration-aware loading UX**: loading window appears only when SQLite bootstrap/migration crosses threshold; avoids blocking fast-start path
- `[2026-04-15]` **Loopback health checks bypass proxy env**: localhost probes explicitly disable proxy behavior; prevents enterprise proxy config from breaking local sidecar checks
- `[2026-04-15]` **Storage writes debounced + flush-on-hide/pagehide**: desktop store API batches writes and flushes on lifecycle transitions; better durability with lower write churn
- `[2026-04-15]` **Graceful fallback to in-memory storage** when persistent store load fails; app remains usable instead of hard failing startup
- `[2026-04-15]` **Deep-link buffering before app hydration**: queued URL events emitted once runtime listeners mounted; reduces OAuth callback race conditions
- `[2026-04-15]` **Operator recovery actions in app menu**: restart app, kill sidecar, check updates, install CLI exposed as explicit user actions

## Gaps Relative to Cowork-Style Desktop Direction

- `[2026-04-15]` `packages/desktop` appears optimized for single-window chat/sessions + project sidebar, not split-pane multi-tool workspace orchestration
- `[2026-04-15]` No first-class desktop scheduler primitives surfaced in `packages/desktop`/`src-tauri` (native recurring task UX not present in reviewed scope)
- `[2026-04-15]` No obvious desktop-native sub-agent orchestration controls in reviewed desktop package (capability may exist deeper in core SDK, but not desktop-shell surfaced)
- `[2026-04-15]` UX polish and reliability are strong; cowork-like automation surface area still narrower than the "assistant that keeps working" model

## Translation for Tinker

- `[2026-04-15]` Keep Tinker's Dockview-first plan (split-pane remains core differentiator) while borrowing OpenCode's startup resilience patterns
- `[2026-04-15]` Prioritize lifecycle hardening before new feature flags: robust sidecar gate + migration-aware loading + proxy-safe loopback checks
- `[2026-04-15]` Add explicit operator controls (restart sidecar / diagnostics) into desktop chrome; shortens failure-to-recovery loop
- `[2026-04-15]` Preserve typed cross-boundary contract discipline (generated bindings, no ad-hoc invoke strings)

## Connections

- [[07-workspace-persistence]]
- [[04-native-scheduler]]
- [[06-subagent-orchestration]]
- [[feature-gap-table]]
