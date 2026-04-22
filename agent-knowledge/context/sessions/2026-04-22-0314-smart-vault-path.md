---
type: session
date: 2026-04-22
topic: TIN-68 + TIN-69 smart vault path wiring
---

# 2026-04-22 03:14 — TIN-68 + TIN-69 smart vault path wiring

## Shipped

- Updated `apps/desktop/src-tauri/src/lib.rs` so `restart_opencode(user_id, memory_subdir)` takes per-call config, validates it, and injects `SMART_VAULT_PATH` into the legacy OpenCode bootstrap env.
- Added a small Rust unit test block covering the bootstrap env builder with and without `SMART_VAULT_PATH`.
- Updated `apps/desktop/src/renderer/App.tsx` so app boot no longer trusts the setup-time OpenCode instance blindly; it resolves the active user memory subdir and restarts OpenCode with that path before entering ready state.
- Reused the same restart path after auth sign-in/sign-out so switching the active user also switches the MCP memory scope immediately.

## Verification

- `pnpm -r typecheck`
- `pnpm -r lint`
- `pnpm -r test`

## Blockers / follow-up

- `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --lib` is blocked in this workspace because Tauri's build script expects the bundled sidecar resource `apps/desktop/src-tauri/binaries/opencode-aarch64-apple-darwin`, which is absent here.
- A live qmd probe was attempted. `pnpm --allow-build=better-sqlite3 dlx @tobilu/qmd ls` runs after allowing native builds, but qmd CLI remains collection-scoped there and the MCP init probe timed out before handshake in this environment. End-to-end qmd / smart-connections validation still needs a fully provisioned desktop runtime.

## PR

- PR #91 — `feat(m7): wire SMART_VAULT_PATH on restart (TIN-68, TIN-69)`
