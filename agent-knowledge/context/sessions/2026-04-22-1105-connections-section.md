---
type: session
date: 2026-04-22
topic: Settings Connections section + per-MCP retry + Add-tool picker (TIN-70 + TIN-71 + TIN-175)
tickets: [TIN-70, TIN-71, TIN-175]
pr: 105
branch: khvni/tin-70-71-175
---

# Session — Connections section + MCP retry + Add-tool picker

Bundled PR landing the three M7 Settings tickets as dispatch row ε from the [2026-04-22 workspace UI push handoff](2026-04-22-workspace-ui-push.md). One worktree, one branch, one draft → ready PR. Executor → Reviewer → Executor (fix pass) → Verifier loop.

## What shipped

- **TIN-70 (M7.5)** — Settings **Connections** section with three rows (qmd, smart-connections, exa). `<StatusDot>` state per row. Status sourced from OpenCode SDK `client.mcp.status()` polled on a 1.5s interval (stays inside the "within 1s" intent on a localhost sidecar; MCP status is not exposed over the SSE stream so polling is the only path). Error rows carry actionable copy derived from the SDK's `error` field with category defaults for qmd/smart-connections (memory-path hints) and exa (network hints).
- **TIN-71 (M7.6)** — Per-row **Retry** button rendered when status ≠ `connected`/`checking`. Clicks call `client.mcp.connect({ name })` when the SDK exposes it (v2 `McpConnect*` surface). If the call throws or the method is missing against an older sidecar, falls through to `onRequestRespawn` (prop → App.tsx `refreshWorkspaceConnection` → Tauri `restart_opencode`). Null-opencode case surfaces a "OpenCode is not connected yet" failure row instead of silently looping.
- **TIN-175 (M7.9)** — **"+ Add tool"** CTA below the rows opens a `<Modal>` with six disabled MCP cards (GitHub, Linear, Gmail, Calendar, Drive, Slack). Each card: label + shared "Coming soon — needs sign-in" blurb + Linear-ticket link (TIN-158..163). Config-driven — flipping `available: true` in `available-mcps.ts` + wiring a click handler is the only post-MVP change required.

## Files

Created (D21 folder-per-component):

- `apps/desktop/src/renderer/panes/Settings/ConnectionsSection/ConnectionsSection.{tsx,css,test.tsx}` + `index.ts`
- `apps/desktop/src/renderer/panes/Settings/ConnectionsSection/AddToolPicker/AddToolPicker.{tsx,css,test.tsx}` + `index.ts`
- `apps/desktop/src/renderer/panes/Settings/ConnectionsSection/AddToolPicker/available-mcps.ts`
- `apps/desktop/src/renderer/panes/Settings/useMcpStatusPolling.ts`

Modified:

- `apps/desktop/src/renderer/panes/Settings/Settings.tsx` + `Settings.test.tsx` — mounts `<ConnectionsSection />` in place of `<IntegrationsStrip />`. New props (`opencode?`, `memoryPath?`, `onRequestRespawn?`) are optional so existing call sites stay green.
- `apps/desktop/src/renderer/App.tsx` — single `client.mcp.status()` call per boot effect (collapsed from two). Derives exa via `normalizeExaBootStatus` and qmd / smart-connections via `normalizeMcpRowStatus` from the same response. Respawn path resets all three rows to `checking` in one `setState`.
- `apps/desktop/src/renderer/integrations.ts` — added `'reconnecting'` to `MCPStatus['status']`, `BUILTIN_MCP_NAMES` export, `formatErrorMessage` export, and `normalizeMcpRowStatus` helper.
- `agent-knowledge/context/tasks.md` — M7.5 / M7.6 / M7.9 flipped to `review` with PR #105. Added follow-up row for deleting the legacy `IntegrationsStrip` once `FirstRun.tsx` + `Workspace.tsx` retire.

Not deleted: `apps/desktop/src/renderer/components/IntegrationsStrip.tsx` — still imported by `panes/FirstRun.tsx` + `workspace/Workspace.tsx`. Deletion follow-up captured in `tasks.md` post-MVP active slices.

## Review loop

- **Round 1 — Reviewer: BLOCK**. Two S1s: (a) duplicate `client.mcp.status()` call on boot + duplicate inline type cast, (b) `EXA_CHECKING_STATUS` constant being assigned to non-exa rows. Four S2s: 4s polling cadence vs 1s spec, null-opencode stuck state, `as unknown as Promise<X>` cast, redundant three-phase setState. Four S3 nits.
- **Round 2 — Executor fix pass**. Collapsed the boot effect to a single `client.mcp.status()` call and a single finalizing `setState`. Dropped `EXA_CHECKING_STATUS` in favor of `{ status: 'checking' }` everywhere the name isn't `exa`. Tightened polling to 1.5s with a WHY comment. Null-opencode now surfaces `{ status: 'failed', error: 'OpenCode is not connected yet.' }`. Replaced the double-cast with a structural type (`McpStatusApiShape`) the SDK union assigns into. Consolidated `AVAILABLE_MCPS` blurbs behind a `DEFAULT_UNAVAILABLE_BLURB` constant + strengthened the AddToolPicker test to assert the blurb appears once per unavailable row.
- **Round 3 — Verifier: PASS**. Every Linear acceptance bullet maps to a file:line. Token-only CSS confirmed. No `[data-theme="dark"]` branches in new CSS. D21 tree obeyed. No `any` / `@ts-ignore` / `--no-verify`.

## Gates

```
pnpm -r typecheck  -> exit 0
pnpm -r lint       -> exit 0
pnpm -r test       -> 40 files · 184 tests · 0 fail
```

## Open flags for reviewer

- **P2** — `handleRetry` treats any `mcp.connect()` throw as "fall through to respawn". A legitimate connect failure (bad env, permissions) is masked by a full sidecar respawn. Worth a follow-up once the SDK error shape stabilizes.
- **P2** — No Paper artboard exists for Settings → Connections yet. Composition reuses `Settings.tsx`'s existing `tinker-list-item` rhythm + shipping primitives only. Reconciliation pass blocks on TIN-176 follow-ups.
- **P2** — `showRetry` also hides during `checking`, which technically over-reads the ticket ("not connected") but matches intended UX. Land as-is.

## Non-goals / out-of-scope

- No new design primitives (Button / Modal / StatusDot already cover the surface).
- No Rust / Tauri command changes.
- No `opencode.json` edits — M7.1 already stripped to the three MCPs.
- No OAuth flows for the six disabled post-MVP MCPs (TIN-158..163 owns that).

## Next

- Land PR #105 (human review).
- Follow-up row (tasks.md, post-MVP slice) to delete `IntegrationsStrip.tsx` once `FirstRun` + `Workspace` drop their imports.
