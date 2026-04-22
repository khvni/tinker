# Model Picker Parity Audit

Date: 2026-04-22

Ticket: `TIN-47`

Reference: [agent-knowledge/reference/opencode-desktop-model-picker.md](../agent-knowledge/reference/opencode-desktop-model-picker.md)

Pinned OpenCode source commit: `d2181e9273bfcd9727a387527b25aa017ca15410`

## Scope

This audit verifies Tinker's current model picker against the pinned OpenCode Desktop behavior captured in M4.1.

This PR also patches one blocker discovered during the audit: Chat now reads and writes `sessions.model_id`, restores the folder's prior model choice, and falls back to the user's last-used model for new sessions. Without that fix, the parity check would have been knowingly evaluating a missing prerequisite from M4.9.

## Evidence

- Tinker current picker: `docs/assets/model-picker-parity/tinker-model-picker.png`
- OpenCode reference reconstruction: `docs/assets/model-picker-parity/opencode-reference.png`
- Side-by-side pair: `docs/assets/model-picker-parity/model-picker-pair.png`
- Tinker workspace design reference (Paper MCP, light mode): `Tinker Workspace — Light` → `StatusDock` (`D1-0`) → `ModelPill` (`DZ-0`)

Note: the OpenCode image is a static reconstruction from the pinned source + M4.1 anatomy notes. M4.1 captured code-level behavior, not a shipped binary screenshot artifact.

## Paper Reference Check

After the PR was opened, Paper MCP was used against the canonical `Tinker Workspace` file to confirm the current Tinker workspace design intent for the dock-level model pill. In the light artboard, `ModelPill` (`DZ-0`) is:

- white fill with a subtle `#1A16121A` border
- full-pill radius
- padding `5px 9px 5px 8px` with `6px` internal gap
- muted 12/16 provider label (`Default`) plus stronger 12/16 medium-weight model label (`Opus 4.6`)
- neutral ring glyph at the leading edge, not a provider-branded icon

This matters for the audit because it confirms Tinker's current workspace design language is already intentionally different from OpenCode Desktop's branded trigger pill. TIN-47 still stays a verification task: it documents those deltas, fixes the missing `sessions.model_id` prerequisite, and leaves any deliberate Tinker-vs-OpenCode visual reconciliation to follow-up work.

## Checklist

| # | Check | Status | Notes |
|---|---|---|---|
| 1 | Trigger pill shows provider icon + truncating model name + chevron | partial | Tinker shows a generic square glyph instead of provider-specific icon. |
| 2 | Popover opens above trigger with fixed 288 × 320 panel | pass | Dimensions and above-trigger placement match. |
| 3 | `Cmd/Ctrl + '` opens the picker | pass | Implemented in `ModelPicker`. |
| 4 | `/model` slash command opens the picker | gap | No slash-command path exists in Tinker Chat. |
| 5 | Search input autofocus + OpenCode input affordances | pass | Autofocus and input flags match. |
| 6 | Search uses fuzzy matching across provider name, model name, and id | gap | Tinker still uses substring matching. |
| 7 | Non-empty search shows clear button and resets scroll to top | gap | Clear affordance and reset behavior are missing. |
| 8 | Provider grouping + OpenCode provider ordering | gap | Tinker orders only a reduced provider subset. |
| 9 | Sticky group headers with scroll-edge shadow | partial | Headers are sticky, but shadow treatment is missing. |
| 10 | Rows show model name + `Free`/`Latest` tags + trailing check glyph | gap | Tinker shows provider/context/pricing instead of OpenCode tag layout. |
| 11 | Row tooltip shows provider/model metadata | gap | Tooltip is not implemented. |
| 12 | Keyboard nav: loop, Enter, Escape bubble, Ctrl+N/P, native text-nav escape hatches | pass | Current keyboard behavior matches the pinned reference. |
| 13 | Mouse hover can take active row, keyboard disables mouse-active mode | partial | Hover activation exists; auto-scroll arbitration does not fully match OpenCode. |
| 14 | Current selection and active row auto-scroll into view | gap | Auto-scroll-on-open and keyboard-follow scroll are missing. |
| 15 | Selecting a model persists it for the session and recent-selection path | partial | This PR restores per-session persistence; recents list and unhide behavior remain absent. |
| 16 | Data comes from `client.config.providers()` without refetching per open | pass | Picker options are loaded from OpenCode config providers. |
| 17 | Latest-visibility heuristic follows OpenCode release-window logic | gap | Tinker renders all provider models; no latest-visibility heuristic exists. |
| 18 | Empty copy matches OpenCode (`No model results` / filtered variant) | gap | Tinker uses app-specific empty strings and has no filtered empty-state copy. |
| 19 | Search bar includes provider-connect + manage-models icon actions | gap | Actions are not present. |
| 20 | Zero paid providers route to unpaid dialog fallback | gap | Tinker renders a simple empty state instead of the unpaid dialog flow. |

## Known Intentional Deviations In This Slice

- TIN-47 stays a verification task. This PR only patches missing `sessions.model_id` persistence because it blocks a truthful audit.
- The remaining gaps are documented rather than bundled here to keep the PR atomic and reviewable.
- Tinker keeps the stronger accessibility baseline already present in `@tinker/design`; parity work should preserve that rather than regress to OpenCode's looser ARIA story.
- Paper MCP confirms the Tinker workspace's own light-theme `ModelPill` is a neutral dock pill, so provider-branded parity changes need an explicit product decision, not a drive-by style swap inside this review PR.

## Follow-up

- Remaining parity gaps tracked in follow-up issue `TIN-189`.
