---
type: reference
tags: [opencode, sidecar, session-binding, anomalyco, research]
source-repo: anomalyco/opencode
source-commit: 266e965572ccc499b585e4a3558b93e56625e10d
source-branch: dev (at time of capture)
captured: 2026-04-22
---

# Anomalyco OpenCode — session / folder / sidecar binding

Research artifact for TIN-192. Goal: document exactly how anomalyco/opencode
(the Tauri desktop app in `packages/desktop`) binds a user-chosen working
directory to a chat session, and contrast that with Tinker's current
architecture so the TIN-192 fix can cherry-pick the right model without
re-inventing it.

All `raw.githubusercontent.com` / `github.com/.../blob/<sha>/...` citations are
pinned to commit `266e965572ccc499b585e4a3558b93e56625e10d` so they don't rot
as `dev` advances.

---

## 1. Architecture summary (how anomalyco does it)

One long-running `opencode-cli serve` sidecar per Tauri process. **No `--cwd`,
no per-session respawn.** The working directory is passed **per-request** via
an `x-opencode-directory` HTTP header (the SDK rewrites it as a `directory`
query param for GET/HEAD). Switching projects in the UI mutates the SDK
client's `directory` field and fires the next request against the same port.

```
Tauri setup()
  └─ spawn_local_server(hostname="127.0.0.1", port=$(free port), password=uuid)
        └─ cli::serve → spawn_command
              └─ `opencode-cli --print-logs --log-level WARN serve
                   --hostname 127.0.0.1 --port <PORT>`            <-- no --cwd
         └─ HealthCheck polls GET /global/health until 200
App.manage(ServerState { child })
App.manage(SidecarReady { ready_rx })            -- credentials available to renderer

… user picks a folder …
   renderer mutates `sdk.directory = "/new/path"` → next request carries
   `x-opencode-directory: /new/path`. No Rust IPC. No respawn.

RunEvent::Exit
  └─ kill_sidecar → child.kill() → cli::spawn_command's kill_rx fires
     → child.start_kill() → process group teardown (ProcessGroup::leader on
     unix, JobObject + KillOnDrop on windows).
```

---

## 2. Concrete citations (pinned to 266e965)

### 2.1 One sidecar spawned at setup — no `--cwd`

`packages/desktop/src-tauri/src/lib.rs` lines 420–446 — bootstrap:

> <https://github.com/anomalyco/opencode/blob/266e965572ccc499b585e4a3558b93e56625e10d/packages/desktop/src-tauri/src/lib.rs#L420-L446>

```rust
// lib.rs:426-434
let port = get_sidecar_port();                           // free port or $OPENCODE_PORT
let hostname = "127.0.0.1";
let url = format!("http://{hostname}:{port}");
let password = uuid::Uuid::new_v4().to_string();
tracing::info!("Spawning sidecar on {url}");
let (child, health_check) =
    server::spawn_local_server(app.clone(), hostname.to_string(), port, password.clone());
```

`packages/desktop/src-tauri/src/cli.rs` lines 553–572 — serve args (no `--cwd`):

> <https://github.com/anomalyco/opencode/blob/266e965572ccc499b585e4a3558b93e56625e10d/packages/desktop/src-tauri/src/cli.rs#L553-L572>

```rust
// cli.rs:566-572
let (events, child) = spawn_command(
    app,
    format!("--print-logs --log-level WARN serve --hostname {hostname} --port {port}").as_str(),
    &envs,
)
```

`packages/desktop/src-tauri/src/lib.rs` lines 553–564 — port discovery:

> <https://github.com/anomalyco/opencode/blob/266e965572ccc499b585e4a3558b93e56625e10d/packages/desktop/src-tauri/src/lib.rs#L553-L564>

```rust
// lib.rs:553-564
fn get_sidecar_port() -> u32 {
    option_env!("OPENCODE_PORT").map(|s| s.to_string())
        .or_else(|| std::env::var("OPENCODE_PORT").ok())
        .and_then(|port_str| port_str.parse().ok())
        .unwrap_or_else(|| {
            TcpListener::bind("127.0.0.1:0").expect("…").local_addr().expect("…").port()
        }) as u32
}
```

### 2.2 How `directory` reaches the server per-request

`packages/desktop/src/bindings.ts` (generated tauri-specta) exposes only
sidecar lifecycle commands — **no** `set_session_folder` / `bind_directory`
command exists:

> <https://github.com/anomalyco/opencode/blob/266e965572ccc499b585e4a3558b93e56625e10d/packages/desktop/src/bindings.ts#L7-L22>

```ts
// bindings.ts:7-22 — all Rust commands
killSidecar, installCli, awaitInitialization,
getDefaultServerUrl, setDefaultServerUrl,
getWslConfig, setWslConfig,
getDisplayBackend, setDisplayBackend,
parseMarkdownCommand, checkAppExists,
wslPath, resolveAppPath, openPath
```

DeepWiki confirms the header path end-to-end (question asked 2026-04-22):

> *"The OpenCode HTTP server associates a chat session with a user-chosen
> working directory or project folder primarily through a `directory` query
> parameter in API requests and an `x-opencode-directory` HTTP header. […]
> The SDK automatically adds an `x-opencode-directory` header to requests if a
> `directory` is provided during client creation. This header is then
> rewritten into a query parameter for GET/HEAD requests."*
> ([DeepWiki answer](https://deepwiki.com/search/since-the-opencodecli-sidecar_80ce5b4c-2bf0-4bba-aee0-d7cca36f78c7))

DeepWiki follow-up on folder switching (asked 2026-04-22):

> *"When you switch projects or folders in the Tauri desktop app, the
> `opencode-cli` sidecar is kept running, and the `directory` value in the
> SDK client is updated for subsequent requests. The sidecar is not
> restarted. […] The `kill_sidecar` command is primarily used for
> terminating the `opencode-cli` process during application shutdown or
> when an update requires a restart."*
> ([DeepWiki answer](https://deepwiki.com/search/in-the-tauri-desktop-app-packa_3d60c456-a1d1-4821-a243-79bf0898378b))

The renderer-side decision point (per DeepWiki) is `packages/app/src/pages/layout.tsx::navigateToProject` which updates the active project, and `packages/app/src/pages/session.tsx` whose `createEffect(() => sdk.directory)` re-hydrates the file tree + session when the directory changes. This is client-side only — no Tauri IPC round-trip.

### 2.3 Teardown lifecycle

`packages/desktop/src-tauri/src/lib.rs` lines 73–87 — `kill_sidecar`:

> <https://github.com/anomalyco/opencode/blob/266e965572ccc499b585e4a3558b93e56625e10d/packages/desktop/src-tauri/src/lib.rs#L73-L87>

```rust
// lib.rs:73-87
#[tauri::command]
#[specta::specta]
fn kill_sidecar(app: AppHandle) {
    let Some(server_state) = app.try_state::<ServerState>() else { … };
    let Some(server_state) = server_state.child.lock().expect("…").take() else { … };
    let _ = server_state.kill();
}
```

`packages/desktop/src-tauri/src/lib.rs` lines 363–371 — `RunEvent::Exit`:

> <https://github.com/anomalyco/opencode/blob/266e965572ccc499b585e4a3558b93e56625e10d/packages/desktop/src-tauri/src/lib.rs#L363-L371>

```rust
// lib.rs:363-371
.run(|app, event| {
    if let RunEvent::Exit = event {
        tracing::info!("Received Exit");
        kill_sidecar(app.clone());
    }
});
```

`packages/desktop/src-tauri/src/cli.rs` lines 484–513 — kill channel → `start_kill()`:

> <https://github.com/anomalyco/opencode/blob/266e965572ccc499b585e4a3558b93e56625e10d/packages/desktop/src-tauri/src/cli.rs#L484-L513>

```rust
// cli.rs:484-513 (excerpt)
let (kill_tx, mut kill_rx) = mpsc::channel(1);
…
tokio::select! {
    …
    msg = kill_rx.recv(), if kill_open => {
        if msg.is_some() {
            let _ = child.start_kill();
        }
        kill_open = false;
    }
}
…
Ok((event_stream, CommandChild { kill: kill_tx }))
```

Process-group containment (unix: `ProcessGroup::leader`, windows: `JobObject + KillOnDrop`) at `cli.rs:467-482` guarantees children die with the parent, not orphan when the Tauri app crashes:

> <https://github.com/anomalyco/opencode/blob/266e965572ccc499b585e4a3558b93e56625e10d/packages/desktop/src-tauri/src/cli.rs#L467-L482>

### 2.4 Health check / readiness

`packages/desktop/src-tauri/src/server.rs` lines 101–135 — `HealthCheck`:

> <https://github.com/anomalyco/opencode/blob/266e965572ccc499b585e4a3558b93e56625e10d/packages/desktop/src-tauri/src/server.rs#L101-L135>

Every 100ms, GET `/global/health` with basic-auth `opencode:{password}` until 200. `tokio::select!` between `ready` and `terminated` so a crashing sidecar fails fast instead of timing out.

### 2.5 Port reuse — manifest adoption?

Anomalyco does **not** implement the manifest-file adoption pattern Tinker already has (no `.tinker/manifests/*.json` equivalent). A crashed sidecar from a previous run is orphaned until the OS reaps it or the user kills the process manually. The process-group wrap is their only line of defence. Tinker's manifest + `reconcile_opencode_manifests` (at `apps/desktop/src-tauri/src/commands/opencode.rs:474-481`) is strictly stronger.

---

## 3. Tinker's current architecture (for the diverge matrix)

Facts as of branch `khvni/san-diego-v1` (commit visible in git status at research time):

| Layer | File | Behaviour |
|---|---|---|
| Rust boot | `apps/desktop/src-tauri/src/lib.rs:447-459` | `tauri::Builder.setup()` → `reconcile_opencode_manifests` → `bootstrap_opencode(RestartOpencodeOptions::default())` → `ensure_main_window`. Boot spawns a sidecar in `opencode.json`'s parent dir (not $HOME). |
| Rust spawn-A (legacy) | `apps/desktop/src-tauri/src/lib.rs:287-398 `bootstrap_opencode` | Stores `child` + `connection` in a single shared `OpencodeState`. `restart_opencode` calls `terminate_legacy_opencode` + `bootstrap_opencode` in series. **One sidecar per app.** |
| Rust spawn-B (new) | `apps/desktop/src-tauri/src/commands/opencode.rs:176-287 `start_opencode` | Takes `{folder_path, user_id, memory_subdir}`. Writes `~/.tinker/manifests/<session-id>.json` with pid + port + secret + folder_path. Drain task detaches child. `.current_dir(folder_path)` sets cwd. |
| Rust stop | `apps/desktop/src-tauri/src/commands/opencode.rs:341-363 `stop_opencode_inner` | SIGTERM → 2s grace → SIGKILL → remove manifest. Idempotent for dead pids. |
| TS state | `apps/desktop/src/renderer/App.tsx:41-54 `ReadyAppState` | Single `opencode: OpencodeConnection` shared by every pane via `Workspace` props → `ChatPaneRuntimeContext`. |
| TS rebind | `apps/desktop/src/renderer/App.tsx:864-891 `setSessionFolder` | Every folder pick calls `restartWorkspaceOpencode` (kill + respawn) — even when the new folder equals the old one. |
| TS auth-refresh | `apps/desktop/src/renderer/App.tsx:504-545` | After auth state changes, unconditionally calls `restartWorkspaceOpencode`. Runs on every mount of the ready app. |
| Client wiring | `apps/desktop/src/renderer/opencode.ts:136-144 `createWorkspaceClient` | Forwards `directory: vaultPath` to `createOpencodeClient`. Already uses the anomalyco pattern at the SDK layer — but the connection object on top of it is global. |

### 3.1 Why the bug happens

1. `bootstrap_opencode` at Tauri setup spawns a sidecar with `.current_dir` set to `opencode.json`'s parent (the repo root in dev, `Resources/` in prod). This sidecar has a folder, but it isn't any folder the user cares about.
2. The auth-refresh effect at `App.tsx:504-545` fires after the initial `get_opencode_connection` completes, and calls `restartWorkspaceOpencode` even when auth hasn't actually changed. That kills sidecar #1 and spawns sidecar #2 before the user has clicked anything.
3. Clicking folder-picker calls `setSessionFolder` → `restartWorkspaceOpencode` → sidecar #3 regardless of whether sidecar #2's `folder_path` already matches.
4. Second pane opened on the same folder produces no new sidecar, but also doesn't get an isolated OpenCode session — they both read `state.opencode.baseUrl` so the second pane's chat attaches to the first pane's sidecar. That's fine for one folder, catastrophic for two.

---

## 4. Reuse / Diverge matrix

| Concern | Anomalyco approach | Reuse as-is? | Tinker divergence (with citation) |
|---|---|---|---|
| **Server process count** | One `opencode-cli serve` per app. | **Reuse the idea of a single root sidecar for N panes on the same folder.** | Tinker needs *N sidecars* when panes are on *different* folders (Tinker allows multi-folder per workspace — anomalyco only shows one project at a time). So: reuse "one sidecar per folder", not "one sidecar per app". |
| **`--cwd` on spawn** | Not used; removed upstream. | **Reuse — must not reintroduce.** | Tinker already hit this (`opencode.rs:202-205` comment: *"`opencode serve` no longer accepts `--cwd`"*). Keep passing cwd via `.current_dir()` at spawn + the SDK `directory` header. |
| **Folder switch** | SDK client mutation only; no Rust IPC, no respawn. | **Reuse for same-folder rebinding of different panes.** | **Diverge for cross-folder** — anomalyco can reuse because the single sidecar works in the folder the user spawned it in, and `directory` header lets it read/write inside that folder. Tinker's sidecar runs one memory subdir (`SMART_VAULT_PATH`) per user; multi-folder needs multi-sidecar or we'd have to stop the per-sidecar memory isolation we have at `lib.rs:153-158`. Keep multi-sidecar. |
| **Port picking** | `TcpListener::bind("127.0.0.1:0")` → ephemeral; also honours `OPENCODE_PORT`. | **Already in Tinker** (`opencode.rs:205` `--port 0`, parses announced URL). | No divergence. |
| **Credentials** | `username="opencode"`, `password=uuid::Uuid::new_v4()`, basic auth. | **Already in Tinker** (`opencode.rs:21` + `lib.rs:314`). | Tinker uses `OPENCODE_SERVER_USERNAME` env var named `tinker` in the new flow, `tinker-{rand}` in the legacy flow. Fine — just pick one. |
| **Health check** | `GET /global/health`, 100ms poll, basic-auth. | **Already in Tinker** (`opencode.rs:120-140` + `lib.rs:208-225`). | `opencode.rs` uses `/health` (without `/global`). Minor — confirm which the bundled server answers and unify. |
| **Teardown signal** | `child.start_kill()` via `CommandChild { kill: mpsc::Sender }`. Process-group leader on unix. `RunEvent::Exit` triggers. | **Tinker is stronger here.** | `opencode.rs:341-363` implements SIGTERM → grace → SIGKILL. Manifest-file adoption also covers crash recovery, which anomalyco lacks. Keep. |
| **Crash adoption** | None (orphan sidecars live until OS reaps). | **Tinker-only feature — keep.** | `opencode.rs:400-481` `reconcile_manifest_entry`. |
| **Renderer state shape** | `sdk.directory` stored in a global SolidJS context; switching panes updates it imperatively. | **Partially reuse.** | Tinker has N chat panes simultaneously visible (anomalyco shows one). So `state.opencode` becomes a map keyed by `(folder_path, memory_subdir)`, and each Chat pane reads the entry matching its pane's `sessionFolderPath`. |
| **Lifecycle events** | `kill_sidecar` is an exposed Tauri command. Menu → Restart calls it from TS. | **Reuse as our `restart_opencode` contract.** | Tinker's current `restart_opencode` always kills + spawns. Make it idempotent (see design doc §3). |

---

## 5. Key takeaway for TIN-192

Anomalyco's central insight: **OpenCode already supports per-request directory
via `x-opencode-directory`** — there is no architectural reason to respawn
the sidecar when the user picks a folder that matches an existing sidecar's
working directory. Tinker reuses that at the SDK layer already
(`createWorkspaceClient(..., directory)`), but the coordinator layer in
`App.tsx` + `lib.rs` still treats every pick as a respawn.

The fix is to make the Rust coordinator and TS state **keyed by
(folder_path, memory_subdir)** so repeat picks are no-ops, different-folder
picks spawn a new sidecar for that key, and a pane closing triggers stop
only when no other pane still references the key.

Tinker keeps its stronger teardown + manifest-adoption story. It only adopts
anomalyco's *"don't kill what you don't have to"* ethos.

---

## 6. Dead ends / caveats

- The `packages/desktop-electron` subtree in anomalyco/opencode is an older
  Electron shell. DeepWiki mentions it for historical context; we do not
  borrow from it.
- DeepWiki cites `packages/app/src/pages/session.tsx` and
  `packages/app/src/pages/layout.tsx` as the renderer call-sites. Those live
  in `packages/app/`, not `packages/desktop/`, and were not re-fetched as
  raw files because the Rust layer is authoritative for the binding model.
  If a future task needs the SolidJS navigation code, fetch from
  `github.com/anomalyco/opencode/blob/266e965572ccc499b585e4a3558b93e56625e10d/packages/app/src/pages/session.tsx`.
- `--cwd` was present on earlier versions of `opencode serve`. Comments in
  Tinker's `lib.rs:321-324` and `opencode.rs:202-205` already record that it
  was removed upstream; `.current_dir(folder_path)` is the only supported
  path. Do not resurrect `--cwd`.
