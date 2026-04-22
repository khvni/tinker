---
type: session
date: 2026-04-22
topic: TIN-191 opencode boot-spawn dedupe (narrow slice; superseded by TIN-192 umbrella)
---

# Session — TIN-191 opencode boot-spawn dedupe

## Outcome

PR #110 open + ready-for-review on branch `fix/m2/opencode-boot-dedupe`. TIN-191 → In Review. Not merged (pending human review + TIN-192 umbrella landing).

## What shipped

Two files, `+10 / -5`:

1. `apps/desktop/src-tauri/src/lib.rs` — deleted the unconditional `bootstrap_opencode(&app.handle(), RestartOpencodeOptions::default()).await?;` from `.setup(...)`. `reconcile_opencode_manifests` + `ensure_main_window` remain. `bootstrap_opencode` fn itself stays (still called by `restart_opencode`).
2. `apps/desktop/src/renderer/App.tsx` — loading effect now calls `restartOpencode(await resolveRestartOpencodeOptions(sessions, storedVaultPath))` + `syncConnectorState(...)` instead of `invoke<OpencodeConnection>('get_opencode_connection')`, so the first spawn carries real vault + memory subdir + sessions. Added `initialAuthSyncRef = useRef<boolean>(true)`; auth-change effect's async IIFE returns early on its first post-ready fire and flips the ref to `false`.

Single commit `82dedf6 fix(desktop): dedupe opencode boot spawn (TIN-191)`.

## Why this approach (per ticket)

Ticket offered two options:
- **Delete Rust setup-hook spawn** (picked) — Rust `setup()` has no way to know user-scoped vault + memory subdir; any pre-spawn is necessarily blank, gets SIGKILL'd and respawned by the renderer. Cleaner to not spawn it at all. Also aligns with D27 (lazy boot).
- **Skip renderer first fire if Rust child matches** (rejected) — would keep both spawn paths alive and require a config fingerprint surface across Rust/TS; adds-before-deletes.

## Verification (all green)

- `pnpm -r typecheck` — 10 projects clean.
- `pnpm -r lint` — 10 projects clean.
- `pnpm -r test` — bridge 23/23, memory 110/110, desktop 228/228, scheduler 3/3. 364 tests.
- `cargo test --lib` — 30 passed, 1 ignored (OS keychain).

Reviewer (elon-reviewer subagent) APPROVED. Verifier (independent code-read + full suite) `READY_TO_MERGE`.

## What this DOESN'T fix — handoff to TIN-192

Between opening the PR and wrap-up, user rewrote TIN-191's description to declare it subsumed by **TIN-192** (Urgent / L). TIN-192 is the full umbrella:

- Cold boot shows **exactly one** `opencode server listening` line (this PR reduces the count but TIN-192 reports 3 kill cycles on boot, implying there are other drivers beyond the `setup()` spawn this PR removes — likely the auth-change effect still re-fires on session-reference churn).
- With no folder selected, user can chat from a default `$HOME` sidecar. Not implemented here.
- Picking a folder binds the active Chat pane to a new session rooted in that folder. Not implemented here.
- Multi-pane = multi-session (one OpenCode sidecar per distinct folder or one sidecar with per-request cwd).
- **`restart_opencode` becomes idempotent on no-op**: if `folder_path` + `memory_subdir` match the active sidecar, early-return without killing/respawning. This is the real invariant behind the remaining cycles.
- Requires research doc `agent-knowledge/reference/anomalyco-opencode-session-binding.md` (github + DeepWiki citations of anomalyco/opencode desktop app) + design spec `agent-knowledge/specs/<date>-opencode-session-binding-design.md` reviewed BEFORE implementing.

This PR is compatible with every direction TIN-192 will take — renderer now owns first-spawn config; extending `restart_opencode` to no-op on matching cwd is additive, not conflicting.

## Follow-up tickets to file (out-of-scope here)

- **Dead-code sweep for `get_opencode_connection`** — renderer no longer invokes it on boot. Still exposed as a Tauri command + has a permission file (`apps/desktop/src-tauri/permissions/allow-get-opencode-connection.toml`). Reviewer flagged.
- **Integration-level cold-boot log assertion** — headless Tauri smoke test asserting exactly one `opencode server listening` per cold boot would prevent regression. Manual verification is fine for this slice; TIN-192 should bake a structural assertion.

## Open action items for next agent

1. Implement TIN-192. First step: the mandatory research doc — clone/browse https://github.com/anomalyco/opencode/tree/dev/packages/desktop + DeepWiki cross-reference. No code until research doc + design spec land.
2. Close TIN-191 as duplicate of TIN-192 once the umbrella implementation lands. PR #110 stays as a landed slice or gets folded into the umbrella PR, whichever the umbrella implementer prefers.
3. File the two follow-up tickets above.
