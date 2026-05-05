---
type: concept
tags: [host-service, device, architecture]
status: in-flight
---

> **[2026-05-05] In flight.** Glass parity audit raised priority — host-service is required for headless and scheduled work (TIN-218 approval queue, TIN-141 scheduler migration). The previous `[2026-04-21]` deferral has been reopened.

# Feature 11 — Device ↔ Host-service split

**Status**: scaffold landing on TIN-99 (`packages/host-service` + `packages/host-client`). Steps 2–7 of the migration plan land in follow-ups (TIN-141, TIN-218, …).

**Rooted in**: [[D17]]. Inspired by `superset-sh/superset` `HOST_SERVICE_ARCHITECTURE.md`, adapted to Tinker's Tauri stack.

## Terminology

- **Device** — anything that displays workspaces: Tauri desktop, future mobile app, future browser attach.
- **Host** — anything that runs workspaces: the user's laptop, a remote server, a future cloud instance.
- **Co-resident** — the common case: a MacBook is both device and host.

## Boundaries

### Host service (`packages/host-service`)

Owns — any concern a headless / remote deployment also needs:

- workspace lifecycle (create, open, close, delete)
- vault indexing + memory store (SQLite backing)
- OpenCode sidecar lifecycle (spawn, health, adopt, shutdown) — keep our existing Rust coordinator logic, surface via host-service endpoints
- git operations (status, diff, branch switch) — used by agent file events + session worktrees
- scheduled job engine (`@tinker/scheduler` migrates inward)
- integration credential lookups (read-only interface to the keychain-backed `IntegrationCredentialStore`)
- host registration (intrinsic identity — never configured)
- chat runtime: session create/prompt/abort bridge + memory injection (migrated out of `@tinker/bridge`)

Does NOT own:

- how it was started (Tauri vs systemd vs launchd vs docker)
- credential **storage** (keychain write is the device layer — host only reads through an injected provider)
- tray/menu/titlebar/updater
- Tauri plugin invocations

### Device (Tauri shell — `apps/desktop`)

Owns — any concern tied to the current device:

- Tauri window + menu + tray
- Platform bridges (dialogs, clipboard, notifications, shell, updater)
- Credential writer adapter (keychain) passed to host as a `GitCredentialProvider` / `IntegrationCredentialWriter`
- Host service coordinator (spawn, adopt, restart) — see §Coordinator
- React renderer + `@tinker/panes` workspace
- Deep link routing (opencode:// scheme)

## Public host-service contract (`createHostApp`)

```ts
createHostApp({
  config: {
    dbPath: string,              // SQLite path
    vaultRoot: string | null,    // optional on first-run
    migrationsPath: string,
    allowedOrigins: string[],    // CORS
    listenHost: string,          // '127.0.0.1' for co-resident, '0.0.0.0' for LAN host
    listenPort: number | 0,      // 0 = pick free port
  },
  providers: {
    hostAuth: HostAuthProvider,        // validates inbound PSK
    credentials: GitCredentialProvider,// passes tokens to git ops
    modelResolver: ModelProviderResolver,// gives OpenCode env vars
    secretsWriter: IntegrationCredentialWriter, // device-side keychain writer
  },
});
```

All fields required. Never defaults — a default silently leaks presentation concerns into host.

### Endpoints (PSK-auth unless noted)

- `GET /health.check` (unauth) → `{ status: 'ok', hostId, version }`
- `GET /host.info` → `{ hostId, hostName, platform, version, uptime, deviceCount }`
- `POST /workspace.create`, `POST /workspace.delete`, `GET /workspace.list`
- `POST /session.start`, `POST /session.prompt`, `POST /session.abort`, `GET /session.messages`
- `WS /session.events` (SSE or WS — Tauri shell already consumes SSE)
- `WS /terminal.open` — used by future terminal pane
- `WS /filesystem.watch` — vault events
- `POST /attention.signal`, `GET /attention.state` — feeds [[12-attention-coordinator]]

PSK auth in header: `Authorization: Bearer <secret>`.

## Identity rules

- `hostId` = `sha256(os.hostname() + persisted-random-suffix)[0..16]`. Persist the suffix in `~/.tinker/host-identity.json`. Do not pass `hostId` as config.
- `hostName` = `os.hostname()` at startup. Runtime overridable via `POST /host.rename` only from the device that spawned it.
- Version read from `packages/host-service/package.json` at build time.

## Coordinator (lives in `apps/desktop/src-tauri`)

Rust-side child-process manager. One instance per running host (today: exactly one).

```rust
struct HostCoordinator {
  fn start(config: SpawnConfig) -> Result<{pid: u32, port: u16, secret: String}>;
  fn stop() -> ();
  fn restart(config: SpawnConfig) -> ...;
  fn discover() -> ();          // scan manifest-on-disk, adopt running hosts
  fn release() -> ();           // detach; let host survive app quit (headless mode)
  fn release_all() -> ();
  fn stop_all() -> ();
  fn status() -> ProcessStatus; // starting | running | degraded | restarting | stopped
  fn events() -> Receiver<StatusEvent>;
}

struct SpawnConfig {
  db_path: PathBuf,
  migrations_path: PathBuf,
  allowed_origins: Vec<String>,
  vault_root: Option<PathBuf>,
  listen_host: String,
  listen_port: u16,   // 0 = free
}
```

Rules:
- Pick a free port, pass it as env var `TINKER_HOST_PORT`.
- Generate PSK (32 random bytes), pass as env var `TINKER_HOST_SECRET`. Never log.
- Poll `GET /health.check` until ok or 30s timeout.
- Record `{pid, port, secret}`. Discard the `Child` handle — host survives app quit unless `stop` is called.
- Write `~/.tinker/manifests/<hostId>.json` with `{pid, port, secret_hash, startedAt}`. Secret **hash** on disk, not the secret itself — device keeps the secret in memory.
- `discover()` on startup: read manifests, probe each, adopt those whose hashes validate against an in-memory secret the device still holds (paired sessions). Otherwise skip and leave the process orphaned for the user to terminate.
- Exponential backoff on unhealthy states. Max 5 restarts/minute.
- `release()` vs `stop()`: quit menu exposes both ("Quit, keep workspaces running" / "Quit and stop workspaces"). Default is release if any scheduled job is pending, else stop.

## Migration plan

1. **Scaffold `packages/host-service`** — copy nothing, write fresh. `createHostApp()` + health + host.info endpoints only. **TIN-99 (in flight).**
2. **Move `@tinker/scheduler` under host-service** — in-process scheduler owns host-side work. **TIN-141.**
3. **Move memory + vault indexing** — both already live in `packages/memory`; rewire them to host-service.
4. **Move OpenCode sidecar lifecycle** — today in Rust. Migrate orchestration logic into host-service; keep Rust as the process launcher only.
5. **Coordinator in Rust** — implement `HostCoordinator` per §Coordinator.
6. **Device-side client** (`packages/host-client`) — typed Fetch/WS wrapper over host endpoints. Lets renderer talk to any host (local or future remote). **Scaffolded alongside step 1 on TIN-99 so steps 2–4 can be exercised against a typed client from the start.**
7. **Retire `@tinker/bridge` as a grab-bag** — split into `packages/host-client` (transport + typed RPC) and `@tinker/chat-client` (stream shaping + memory injection glue).

### Long-running work + approval queue

Glass parity requires headless long-running tasks plus a permission approval queue layered on top of host-service — **TIN-218**. Lands once steps 1–4 are merged.

## What this unlocks

- Headless mode: run `packages/host-service` under launchd/systemd; device can attach later.
- Mobile companion: phone = device, connects to laptop host over LAN.
- Remote host (v2+): run host on a cloud instance; device attaches over TLS. Don't build sync (see [[D18]]).

## Follow-ups

- [[12-attention-coordinator]] binds to `POST /attention.signal`.
- [[14-session-history-windowing]] is a host concern (message pagination) with a device-side renderer.
- [[15-connection-gate]] is device-only (splash + retry loop against `/health.check`).
