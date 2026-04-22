---
type: session
date: 2026-04-22
topic: TIN-84 Settings Account panel + sign-out
---

# Session — TIN-84 Settings Account panel + sign-out

## Outcome

Shipped `<Account>` primitive + wired the Settings pane into the workspace pane registry so M8 sign-out flows end-to-end. Draft PR #93 (branch `khvni/tin-84-account-panel`) is ready for human review; a competing Codex PR #96 on `byalikhani/tin-84-…` touches the same ticket, so reviewer picks one. Sign-out calls `auth_sign_out` for every connected provider, which clears the OS keychain and the session store; renderer state reloads and falls back to the sign-in gate because `hasSignedIn` flips to `false`.

## Review iteration

- Reviewer (elon-reviewer) flagged: `defaultActiveSectionId` test-plumbing prop, redundant section-header eyebrows (duplicated by SettingsShell nav), identity-wrapper `pickCurrentSession`, sequential sign-out loop, over-exported `useSettingsConnection`.
- Applied all five: extracted `<Connections>` into its own folder-per-component with dedicated tests (removes the need for the prop), slimmed `Settings.tsx` to a thin shell composer, inlined the session pick, un-exported the hook, and swapped the sign-out loop for `Promise.allSettled` with aggregated failure messaging. Verifier green after the follow-up commit.

## Code delta

- `apps/desktop/src/renderer/panes/Settings/sections/Account/` — new folder-per-component primitive (Account.tsx + Account.css + Account.test.tsx + index.ts). Renders avatar (via `@tinker/design` Avatar), display name, optional email, provider label, and a sign-out button. Handles busy + message + empty (null user) states.
- `apps/desktop/src/renderer/panes/Settings/Settings.tsx` — refactored to render `<SettingsShell>` with two sections (Account + Connections). Dropped the unwired `workspacePreferences` prop pair (the Toggle was dead code before this PR; file a follow-up when preferences state is hoisted from `Workspace.tsx`).
- `apps/desktop/src/renderer/panes/Settings/SettingsConnection.tsx` — new React context + `<ConnectedSettings>` wrapper. Pane renderer consumes context; fallback EmptyPane renders if the provider is missing.
- `apps/desktop/src/renderer/workspace/register-pane-renderers.tsx` — registers `<ConnectedSettings>` for the `settings` pane kind.
- `apps/desktop/src/renderer/workspace/components/SettingsPane/` — deleted (obsolete placeholder).
- `apps/desktop/src/renderer/App.tsx` — added `pickCurrentSession`, `toAccountUser`, `handleSignOut`, `signOutBusy` / `signOutMessage` state, and wraps `<Workspace>` in `<SettingsConnectionProvider>` with a fully-populated `SettingsConnectionValue`.
- `apps/desktop/src/renderer/routes/design-system.tsx` — replaced the mock Account card with the real `<Account>` primitive; added a dedicated "Account" playground tab covering signed-in / busy / no-avatar / not-signed-in states.
- `agent-knowledge/context/tasks.md` — M8.11 row flipped to `review` with branch + PR-ready note.

## Verifier

- `pnpm -r typecheck` — clean
- `pnpm -r lint` — clean
- `pnpm -r test` — 39 desktop test files / 185 tests pass, plus existing @tinker/panes + design suites
- Rust not touched; `cargo test --lib` skipped

## Acceptance check vs TIN-84

- **Current user info rendered** → Account section renders avatar + display name + email + provider from `state.sessions` via `toAccountUser`. Playground verifies the signed-in / no-avatar / empty states.
- **Sign-out clears keychain + returns to sign-in** → `handleSignOut` iterates every connected provider (`state.sessions[p] !== null`) and calls `auth_sign_out` (Rust command already does `clear_refresh_token` + `clear_session`). `reloadConnectionState` refreshes renderer state; `hasSignedIn` flips to `false` → `signInGateVisible` → `<SignIn>` re-renders.
- **Different-provider sign-in creates a second `users` row + different sessions/memory subdir** → unchanged, already handled by `handleProviderConnect` → `upsertUser` + `getActiveMemoryPath`. New user id = `${provider}:${providerUserId}`, which is the key that `Workspace` is remounted with (`key={currentUserId}`).

## Known follow-ups to file

- Workspace preferences toggle (auto-open agent-written files) is no longer shown in Settings; hoist `workspacePreferencesRef` from `Workspace.tsx` to `App.tsx` so the toggle can go live again.
- Per-provider sign-out UI (not just "sign out everybody") would let multi-provider users keep one session while dropping another. Out of MVP scope.
- Sequential `auth_sign_out` could leave a partial state if one provider throws mid-loop; acceptable for MVP, revisit when we have failure analytics.
