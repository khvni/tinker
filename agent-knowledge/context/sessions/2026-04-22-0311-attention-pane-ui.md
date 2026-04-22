---
type: session
date: 2026-04-22
topic: Attention pane rings + tab dots
---

# Session — TIN-146 + TIN-147

## Shipped

- Opened PR #89: `feat(attention): add pane rings and tab dots (TIN-146, TIN-147)`.
- Added optional `attention` wiring to `@tinker/panes` so stack frames and pane tabs subscribe to `@tinker/attention`.
- Pane focus now clears unread state and the transient flash for the active workspace, matching the requested tab-dot behavior.
- Desktop chat panes now raise `notification-arrival` attention when assistant output starts in an unfocused pane.
- `apps/desktop/src/renderer/routes/panes-demo.tsx` can manually trigger unread and navigation attention states for visual verification.

## Verification

- `pnpm -r typecheck`
- `pnpm -r lint`
- `pnpm -r test`

## Notes

- Paper MCP was not available in this session: `plugin_paper-desktop_paper` server was missing, so UI work matched the existing tokens and local workspace chrome instead of a Paper diff.
- No Rust touched, so `cargo test --lib` was intentionally skipped.
