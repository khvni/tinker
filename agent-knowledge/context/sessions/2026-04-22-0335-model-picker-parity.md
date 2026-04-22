---
type: session
date: 2026-04-22
tickets: [TIN-47]
pr: https://github.com/khvni/tinker/pull/103
branch: khvni/tin47-workspace-ui
---

# Session — Model Picker Parity Audit (M4.10)

## Scope

Deliver the M4.10 review task for `TIN-47`: compare Tinker's model picker against the pinned OpenCode Desktop 4.1 reference, capture the checklist in the PR description, and keep the PR atomic. While doing the audit, one missing prerequisite surfaced: Chat had a `sessions.model_id` column on `main`, but did not actually restore or persist the selected model through that field.

This session fixes that prerequisite, records the parity audit, and files the remaining gaps as a follow-up instead of inflating the PR beyond the stated slice.

## What changed

### Chat model selection persistence

- `apps/desktop/src/renderer/panes/Chat/Chat.tsx`
  - reads prior `modelId` from the active session when restoring a chat
  - resolves default selection in this order: active session model, current folder's latest stored model, current user's latest stored model, OpenCode default / first option
  - persists selection changes back through `updateSession(activeSessionId, { modelId })`
- `apps/desktop/src/renderer/panes/Chat/modelSelection.ts`
  - extracted pure helpers for stored-model lookup + fallback resolution
- `apps/desktop/src/renderer/panes/Chat/modelSelection.test.ts`
  - covers folder-level precedence, user-level fallback, active-session preservation, and default fallback

### Audit artifacts

- `docs/model-picker-parity.md`
  - 20-point parity table with `pass`, `partial`, and `gap` outcomes
  - explains why only `sessions.model_id` persistence was fixed in this slice
- `docs/assets/model-picker-parity/`
  - `tinker-model-picker.png`
  - `opencode-reference.png`
  - `model-picker-pair.png`
  - `opencode-reference.html`
  - `compare.html`

## Decisions

- **Verification task stayed small.** The PR documents parity gaps instead of attempting to close unrelated UI deltas under a "review" ticket.
- **Prerequisite fix was in-scope.** Without wiring `sessions.model_id`, the audit would have knowingly marked parity against behavior Tinker did not actually support, so the minimal persistence fix shipped with the audit.
- **Reference image is reconstructed, not captured from a binary.** M4.1 stored code-level anatomy and behavior, not a historical app screenshot, so the OpenCode artifact is an explicit reconstruction from the pinned source commit `d2181e9273bfcd9727a387527b25aa017ca15410`.

## Verification

- `pnpm --filter @tinker/desktop exec vitest run src/renderer/panes/Chat/modelSelection.test.ts src/renderer/panes/Chat/Chat.test.tsx src/renderer/opencode.test.ts`
- `pnpm --filter @tinker/desktop typecheck`
- `pnpm -r typecheck && pnpm -r lint && pnpm -r test`

All commands passed on this branch. No Rust files changed, so `cargo test --lib` was not needed.

## Follow-up

- `TIN-189` tracks the remaining OpenCode parity gaps identified in `docs/model-picker-parity.md`.

## Post-PR Paper validation

Paper MCP became available after the PR was already open, so a second-pass visual audit was run against the canonical `Tinker Workspace` file:

- `get_basic_info` confirmed the light workspace artboard `9I-0`
- `get_tree_summary` narrowed the target to `StatusDock` (`D1-0`) and `ModelPill` (`DZ-0`)
- `get_screenshot`, `get_jsx`, and `get_computed_styles` captured the exact light-mode pill values
- `get_font_family_info` confirmed `Host Grotesk` + `JetBrains Mono` availability

Result: the Paper source-of-truth also uses a neutral dock pill (`Default · Opus 4.6`) rather than OpenCode's provider-branded trigger. That validates the audit's choice to document the OpenCode parity gaps instead of smuggling a broader Tinker design rewrite into `TIN-47`.
