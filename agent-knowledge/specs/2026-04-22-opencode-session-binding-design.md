---
type: spec
tags: [tinker, opencode, session-binding, tauri, panes]
ticket: TIN-192
reference: agent-knowledge/reference/anomalyco-opencode-session-binding.md
decisions-honoured: [D16, D17, D22, D25, D26, D27]
created: 2026-04-22
---

# TIN-192 — OpenCode session binding fix (design)

> **Companion doc:** `agent-knowledge/reference/anomalyco-opencode-session-binding.md` explains the upstream pattern. This spec decides what Tinker ships.

---

## 1. Target state

- Cold boot spawns **exactly one** OpenCode sidecar rooted in `$HOME`. No respawn before the user acts.
- Guest + no folder → chat goes to the $HOME sidecar. Fine for "talk to the agent without a project" use cases (per D27: workspace boots as guest).
- Folder pick = upsert a sidecar keyed by `(folder_path, memory_subdir)`. If the key already has a live sidecar, reuse it (no kill, no spawn). Otherwise spawn a new one.
- Multiple panes may reference the same key and share its sidecar.
- Closing a pane decrements the refcount on its key; hitting zero stops the sidecar (SIGTERM → 2s → SIGKILL) and removes its manifest.
- App quit SIGTERMs all manifests (existing `stop_all_opencodes`).

This reuses anomalyco's "don't kill what you don't have to" ethos (see reference doc §2.2) but preserves Tinker's per-user `SMART_VAULT_PATH` memory isolation, which anomalyco does not need.

---

## 2. Files to modify

### Rust (`apps/desktop/src-tauri/src/`)

- `commands/opencode.rs` — extend `start_opencode` to be idempotent on `(folder_path, memory_subdir, user_id)`. Add `find_live_sidecar_by_key` helper reading manifests + health check.
- `commands/opencode.rs` — add `release_opencode` command that decrements refcount; stops sidecar only when zero.
- `lib.rs` — delete `OpencodeState`, `OpencodeConnection`, `get_opencode_connection`, legacy `bootstrap_opencode`, `restart_opencode`, `terminate_legacy_opencode`. Replace with a single `boot_home_opencode` called from `setup()` that delegates to `commands::opencode::start_opencode` with `folder_path=$HOME` + `user_id="guest"`.
- `lib.rs` — register `start_opencode`, `stop_opencode` (already exists), and new `release_opencode` commands; drop `get_opencode_connection` + `restart_opencode`.

### TypeScript (`apps/desktop/src/renderer/`)

- `App.tsx` — replace single `opencode: OpencodeConnection` in `ReadyAppState` with `opencodes: Record<string, OpencodeConnection>` keyed by `bindingKey(folder_path, memory_subdir)`. Boot receives the $HOME sidecar's handle; each folder pick acquires (or reuses) an entry for its key.
- `App.tsx` — delete `restartOpencode`, `restartWorkspaceOpencode`. Replace with `acquireOpencode(key)` and `releaseOpencode(key)` helpers that invoke `start_opencode` / `release_opencode`.
- `App.tsx` — delete the auth-refresh effect at lines 504–545 (`restart-on-auth` is the source of the mysterious second respawn on cold boot). Auth tokens should flow through `client.auth.set` against *every* live sidecar, not by respawning.
- `workspace/Workspace.tsx` — pass the per-pane connection through `ChatPaneRuntimeContext` (`chatPaneRuntime.opencode` becomes a function: `(paneData) => connectionFor(paneData.folderPath, paneData.memorySubdir)`), or have each `RegisteredChatPane` ask the runtime for its connection via a hook.
- `panes/Chat/Chat.tsx` — already reads `sessionFolderPath` + builds `createWorkspaceClient(opencode, getOpencodeDirectory(vaultPath))`. No behavioural change at the Chat layer; only the upstream `opencode` prop becomes pane-specific.
- `panes/Chat/Chat.tsx` — on unmount (existing effect at lines 292–310), also call `releaseOpencode(key)` through the runtime.
- `panes/Chat/Composer` folder-picker click handler (`handleSelectSessionFolder` in `App.tsx:1094-1106` today) — instead of `setSessionFolder` (which calls `restart`), call `acquireOpencode(newFolder, memorySubdir)` and update the **active Chat pane's** `sessionId` + folder-scoped state. Global `state.vaultPath` becomes per-Chat-pane data (stored in `TinkerPaneData` for `chat` kind) or a derived "most-recently-used" pointer. See §3 for the state shape decision.

### Shared types (`packages/shared-types/src/`)

- `pane.ts` — extend the `chat` variant: `{ kind: 'chat'; sessionId?: string; folderPath?: string; memorySubdir?: string }`. `folderPath` lets each Chat pane remember its binding across restarts. Update `pane.test-d.ts`.

### Design tokens / other packages

- None. This is a coordinator-layer fix.

---

## 3. New state shape

### 3.1 Rust side — `OpencodeManifest` already carries what we need

`OpencodeManifest` at `commands/opencode.rs:30-41` already has `folder_path`, `user_id`, `memory_subdir`, `base_url`, `pid`, `port`, `secret`, `session_id`. The manifest *is* the source of truth. No new fields.

New in-memory structure: **none.** Every `start_opencode` call:

1. Builds `key = (canonical(folder_path), user_id, memory_subdir)`.
2. Lists manifests; if a manifest's `(folder_path, user_id, memory_subdir)` matches and `process_alive(pid)` and `/health` returns 200, **return** its `base_url` + username + password without respawning.
3. Otherwise spawn (existing code path) and write a new manifest.

No mutex, no global state. Per D22: config flows per-call. The filesystem (manifest dir) is the coordinator.

### 3.2 TypeScript side — `App.tsx` shape

```ts
type BindingKey = string; // `${folder}\0${memorySubdir}\0${userId}`

type ReadyAppState = {
  status: 'ready';
  // …existing stores…
  // Replace `opencode: OpencodeConnection` with:
  opencodes: Record<BindingKey, OpencodeConnection>;
  defaultBindingKey: BindingKey; // the $HOME-boot one
  // …etc.
};

const bindingKey = (folderPath: string, memorySubdir: string, userId: string): BindingKey =>
  `${folderPath}\u0000${memorySubdir}\u0000${userId}`;

const connectionFor = (state: ReadyAppState, key: BindingKey): OpencodeConnection =>
  state.opencodes[key] ?? state.opencodes[state.defaultBindingKey];
```

### 3.3 Pane-local state (stored in `TinkerPaneData`)

```ts
// packages/shared-types/src/pane.ts
export type TinkerPaneData =
  | {
      readonly kind: 'chat';
      readonly sessionId?: string;
      readonly folderPath?: string;       // new
      readonly memorySubdir?: string;     // new
    }
  | // …other kinds unchanged…
```

This persists across restarts — `WorkspaceState<TinkerPaneData>` is what Workspace layout stores. On reload, each Chat pane re-calls `acquireOpencode(pane.data.folderPath, pane.data.memorySubdir)`; the manifest layer returns existing sidecars if alive, else spawns.

---

## 4. Tauri command contract changes

### 4.1 `start_opencode` — now idempotent

**Signature unchanged:**
```rust
#[tauri::command]
pub async fn start_opencode(
  app: AppHandle,
  folder_path: String,
  user_id: String,
  memory_subdir: String,
) -> Result<OpencodeHandle, String>
```

**New idempotency rule:** before spawning, scan manifests. If one matches `(canonical(folder_path), user_id, memory_subdir)` and its pid is alive and its `/health` returns 200, return an `OpencodeHandle { base_url, pid }` built from it. Do **not** kill it. Do **not** rewrite its manifest.

`OpencodeHandle` gains `username` + `password` (or we introduce a new `OpencodeConnection` response shape that merges the two). TS callers need the creds to build the SDK client.

Add to the hot path (sketch):

```rust
pub async fn start_opencode(app, folder_path, user_id, memory_subdir) -> Result<OpencodeConnection, String> {
    let folder_path = canonicalize(&folder_path)?;
    let home = app.path().home_dir()?;
    let manifests_dir = manifests_dir(&home)?;

    // --- idempotency check ---
    if let Some(existing) = find_live_matching(&manifests_dir, &folder_path, &user_id, &memory_subdir).await? {
        return Ok(OpencodeConnection::from_manifest(&existing));
    }

    // --- existing spawn path (unchanged) ---
    …
}

async fn find_live_matching(
  dir: &Path, folder: &str, user: &str, memory: &str,
) -> Result<Option<OpencodeManifest>, String> {
    for (_, m) in list_manifests(dir)? {
        if m.folder_path != folder || m.user_id != user || m.memory_subdir != memory {
            continue;
        }
        if !process_alive(m.pid) { continue; }
        if wait_for_health(&m.base_url, OPENCODE_SERVER_USERNAME, &m.secret).await.is_err() {
            continue;
        }
        return Ok(Some(m));
    }
    Ok(None)
}
```

### 4.2 `release_opencode` — new

```rust
#[tauri::command]
pub async fn release_opencode(
  app: AppHandle,
  folder_path: String,
  user_id: String,
  memory_subdir: String,
) -> Result<(), String>
```

Caller semantics: "this pane no longer needs the sidecar bound to this key." Implementation:

1. Read pane-counts from a pane-ref file (`~/.tinker/manifests/.refs.json`) or from an in-memory map in the renderer — whichever the design chooses. **Recommendation: keep refcount in the renderer (React has the authoritative pane graph anyway); Rust only stops sidecars when told to.**
2. Therefore `release_opencode` is *not* strictly necessary as a Tauri command — it is equivalent to `stop_opencode` once the renderer knows the last pane using this key has closed. Keep `stop_opencode` (by pid) and have `App.tsx` maintain refcounts in memory.

**Updated plan:** no new Rust command. `App.tsx` maintains `refcounts: Record<BindingKey, number>`; when it hits zero, `stop_opencode(pid)` with the existing command.

### 4.3 `restart_opencode` — deleted

Delete. No caller should ever kill + respawn for an unchanged folder. The idempotent `start_opencode` is the only acquisition path.

### 4.4 `get_opencode_connection` — deleted

No longer useful once boot state flows through `start_opencode`'s return value and the renderer stores them in `opencodes: Record<BindingKey, OpencodeConnection>`.

---

## 5. State transitions

Pseudo-code; `state` = `ReadyAppState`, `store` = `WorkspaceStore<TinkerPaneData>`.

### Boot

```
rust setup():
  boot_home_opencode():
    home = $HOME
    start_opencode(folder_path=home, user_id="guest", memory_subdir=memoryPathFor("guest"))
  ensure_main_window()

ts App.tsx mount:
  const homeKey = bindingKey($HOME, memoryPathForGuest, 'guest')
  const homeConn = await invoke('start_opencode', { folderPath: $HOME, userId: 'guest', memorySubdir: memoryPathForGuest })
  setState({ opencodes: { [homeKey]: homeConn }, defaultBindingKey: homeKey, … })

→ ONE sidecar live. Zero respawns.
```

Per D27 this matches "guest workspace is immediately useful."

### Folder pick (first time on a folder)

```
user clicks "Select folder" on Chat pane P:
  const folder = await openFolderPicker()
  const key = bindingKey(folder, memoryPathForCurrentUser, currentUser.id)
  if key in state.opencodes:          // same-folder pick; no-op
    attachPaneToKey(P, key)
    return
  const conn = await invoke('start_opencode', { folderPath: folder, userId, memorySubdir })
  setState(s => ({ …s, opencodes: { …s.opencodes, [key]: conn } }))
  store.updatePaneData(P.id, { kind: 'chat', folderPath: folder, memorySubdir })
  refcount.incr(key)
```

### Folder pick (same folder already bound to another pane)

No spawn. Refcount of `key` goes from 1 → 2. `state.opencodes[key]` untouched. Second pane reuses the sidecar (matches anomalyco's "same sidecar, different directory header" — except here the sidecar is already the right one, so the header is redundant).

### Folder pick (different folder on a pane that already had one)

```
oldKey = bindingKey(pane.oldFolder, pane.oldMemorySubdir, userId)
newKey = bindingKey(newFolder, pane.memorySubdir, userId)
refcount.decr(oldKey)
if refcount[oldKey] === 0:
  await invoke('stop_opencode', { pid: state.opencodes[oldKey].pid })
  setState(s => { const { [oldKey]: _drop, …rest } = s.opencodes; return { …s, opencodes: rest } })
const newConn = await invoke('start_opencode', { folderPath: newFolder, …})  // no-op if another pane already acquired newKey
refcount.incr(newKey)
setState(s => ({ …s, opencodes: { …s.opencodes, [newKey]: newConn } }))
store.updatePaneData(P.id, { kind: 'chat', folderPath: newFolder, memorySubdir })
```

### Pane split

`@tinker/panes` `actions.splitStack(...)` clones the pane-id + data. The new pane inherits `folderPath` + `memorySubdir`. `refcount.incr(key)` when the clone mounts. No sidecar changes.

### Pane close

```
effect cleanup on Chat pane unmount:
  if pane.data.folderPath:
    const key = bindingKey(pane.data.folderPath, pane.data.memorySubdir, userId)
    refcount.decr(key)
    if refcount[key] === 0 and key !== state.defaultBindingKey:
      await invoke('stop_opencode', { pid: state.opencodes[key].pid })
      setState(s => { const { [key]: _drop, …rest } = s.opencodes; return { …s, opencodes: rest } })
```

Never stop the `defaultBindingKey` ($HOME) sidecar during normal operation — it's the fallback for new panes that haven't picked a folder. It dies at app quit via `stop_all_opencodes`.

### App quit

Unchanged. `RunEvent::Exit` at `lib.rs:465-472` runs `stop_all_opencodes` (SIGTERM all manifests). Tinker is stronger than anomalyco here — retain.

---

## 6. Sequencing (ship order)

Goal: never break `main` between commits.

1. **Commit 1 — Idempotency on `start_opencode`.** Add `find_live_matching` + early return. Add Rust unit tests (§7.1). Existing TS callers still work (legacy `restart_opencode` still exists). This commit is a pure superset — no behaviour changes for current callers.

2. **Commit 2 — Renderer state refactor.** Replace `opencode: OpencodeConnection` with `opencodes: Record<…>` + `defaultBindingKey`. Keep `restart_opencode` calls but route them through the new map. Every access now goes through `connectionFor(state, key)`. Callers that don't know a key fall through to `defaultBindingKey`. App still works end-to-end; just structurally ready for multi-sidecar.

3. **Commit 3 — Wire folder pick to `start_opencode` (idempotent) + refcounts.** Delete `restartWorkspaceOpencode` and the auth-refresh effect at `App.tsx:504-545`. Replace with `acquireOpencode` / `releaseOpencode` helpers. This is the commit that actually fixes TIN-192.

4. **Commit 4 — Delete legacy.** Remove `OpencodeState`, `OpencodeConnection` Rust struct, `get_opencode_connection`, `bootstrap_opencode`, `restart_opencode`, `terminate_legacy_opencode` from `lib.rs`. `boot_home_opencode` calls `commands::opencode::start_opencode` directly. Drop `restart_opencode` from `invoke_handler!`. Drop TS `restartOpencode` helper.

5. **Commit 5 — Pane data schema bump + persistence test.** Extend `TinkerPaneData['chat']`. Add migration in workspace layout hydration that reads old-shape panes (no `folderPath` field) and leaves them anchored to `defaultBindingKey`.

Each commit passes `pnpm -w test` and manual smoke test. Commit 3 is the cut-over; commits 4–5 are cleanup.

---

## 7. Test plan

### 7.1 Rust unit tests (`apps/desktop/src-tauri/src/commands/opencode.rs`)

Add to the existing `#[cfg(test)] mod tests`:

- `find_live_matching_returns_none_when_no_manifest` — empty manifest dir → `Ok(None)`.
- `find_live_matching_returns_none_on_dead_pid` — write a manifest with a reaped pid; expect `Ok(None)`.
- `find_live_matching_returns_none_on_key_mismatch` — write manifest with `folder_path="/a"`, call with `"/b"`; expect `Ok(None)`.
- `find_live_matching_returns_manifest_for_live_match` — spawn a tokio HTTP stub on port 0 (or skip by injecting an alternative health-check fn via trait); expect `Some(manifest)`. **If stubbing `/health` is too much for a unit test, move this to an integration test at `apps/desktop/src-tauri/tests/`.**
- `start_opencode_refuses_empty_folder_path` — existing validation, keep.
- `start_opencode_refuses_empty_user_id` — existing validation, keep.

Cannot unit-test `start_opencode`'s sidecar spawn end-to-end without a real `opencode` binary. Smoke tested in CI via playwright script (deferred, not in this spec).

### 7.2 TS tests (`apps/desktop/src/renderer/App.test.tsx`)

Mock `@tauri-apps/api/core`'s `invoke`. Scenarios:

- **Boot spawns one sidecar, $HOME-rooted.** Assert `invoke` called once with `start_opencode` + `{folderPath: homeDir, userId: 'guest', memorySubdir: guestMemoryPath}`.
- **No-op on same-folder pick.** After boot, simulate folder-pick for a folder A. Then simulate folder-pick for folder A again on the same pane. Assert `invoke('start_opencode', …)` called exactly twice total (once for boot, once for the first A pick) — the second A pick is a pure state update.
- **Different-folder respawn.** Pick folder A, then folder B on the same pane. Assert `invoke('stop_opencode', {pid: connA.pid})` called once; `invoke('start_opencode', …)` called with folder B.
- **Multi-pane, same folder.** Open two Chat panes, bind both to folder A. Assert only one `start_opencode` call for A. Close one pane — no `stop_opencode`. Close the other — now `stop_opencode`.
- **Multi-pane, different folders.** Pane P1 → folder A, pane P2 → folder B. Assert two distinct `start_opencode` calls, two distinct connections stored in `state.opencodes`.
- **Auth refresh does not respawn.** Simulate auth-status change while panes exist; assert zero `stop_opencode` / `start_opencode` calls. (Token propagation goes through `client.auth.set` instead — covered by existing connector tests.)
- **App quit teardown.** Assert unmount cleanup path calls `stop_opencode` for every key in `state.opencodes`. (In practice `RunEvent::Exit` handles this in Rust, but the renderer should also be idempotent on forced unmount.)

### 7.3 Integration smoke (manual or e2e)

- `pnpm dev:desktop` → observe boot logs show *one* `[opencode] spawning sidecar` line, not two.
- Click folder-picker → observe *one* additional spawn.
- Click folder-picker again with the same folder → observe *zero* additional spawns.
- Split pane → observe zero additional spawns.
- Close one of the two panes → observe zero stop.
- Close last pane on that folder → observe SIGTERM, manifest file removed.
- Quit app → observe SIGTERM for all remaining manifests.

---

## 8. Rollback plan

If the fix regresses:

1. **Fast rollback:** revert commits 3 → 4 → 5 on `main`. Commit 1 (idempotency) and commit 2 (state shape) are safe to keep — commit 1 is a pure addition, commit 2 is structurally equivalent to the old shape because `defaultBindingKey` always wins when only one entry exists.
2. **Narrow rollback (if only the refcount logic is wrong):** revert commit 3 only. The state shape from commit 2 still routes all traffic through `defaultBindingKey`, matching pre-fix behaviour exactly.
3. **Restoring `restart_opencode` if commit 4 ships and something downstream broke:** `git revert <commit-4-sha>` restores the Rust command. Renderer still works because `acquireOpencode` only calls `start_opencode` (idempotent) — `restart_opencode` being gone does not affect the new path, only the old one.

No schema migration is needed on rollback — `WorkspaceState<TinkerPaneData>` tolerates the additional optional `folderPath` / `memorySubdir` fields on reload because they're `?` in the type (commit 5 adds them as optional).

Manifest files left on disk from a newer version are handled by the existing `reconcile_opencode_manifests` at setup — they get adopted and stopped cleanly.

---

## 9. Open questions — resolved 2026-04-22

1. **$HOME vs `app_local_data_dir()` for boot sidecar.** **Use `$HOME`.** TIN-192 body is explicit: *"scoped to the user's OS home directory by default (macOS `~/` — i.e. what `$HOME` resolves to, same as a freshly-opened terminal session)"*. Privacy risk is accepted as a deliberate product choice (matches terminal UX expectation). Ship $HOME; reopen if we get privacy feedback post-MVP.
2. **Memory subdir per folder or per user.** **Keep per-user.** `<memory_root>/<user-id>/` is read-heavy (MCP qmd + smart-connections index). Writes are append-only per-session via M6.8 (`sessions/YYYY-MM-DD-HHMM-<session-id>.md` — unique filename per session, no concurrent write to same file). Acceptable for MVP. If concurrent-write symptoms appear, revisit by scoping memory subdir per `(user, folder)` in a follow-up.
3. **Pane data schema migration.** **Graceful fall-through.** Existing persisted `chat` panes without `folderPath` route to `defaultBindingKey` (the $HOME sidecar) on reload. Matches D27 guest-workspace intent. `sessionFolderPath = null` is already a tolerated Chat state.
4. **Canonical folder path.** **Canonicalise both sides.** Rust: `std::fs::canonicalize(&folder_path)` in `start_opencode` before computing the manifest match. TS: `@tauri-apps/api/path::resolve()` before the `bindingKey` computation. Agree on resolved absolute path (no symlink chase beyond what `canonicalize` does). Two string-different paths pointing at the same inode share a sidecar.
