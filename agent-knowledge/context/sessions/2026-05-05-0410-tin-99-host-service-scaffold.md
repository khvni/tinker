---
type: session
tags: [host-service, device, architecture, scaffold]
ticket: TIN-99
related: [TIN-141, TIN-218]
date: 2026-05-05
---

# 2026-05-05 0410 — TIN-99 Device ↔ host-service split (scaffold)

## Context

Glass parity audit on 2026-05-05 reopened `[[11-host-service]]` (deferred 2026-04-21 per [[D25]]). Host-service is now required for headless and scheduled work — TIN-218 long-running task runtime + permission approval queue is blocked on it, and TIN-141 scheduler migration is the immediate follow-up. TIN-99 was raised to High priority and delegated to Devin.

## Scope this session

Foundation only — steps 1 + 6 of the migration plan in `agent-knowledge/features/11-host-service.md`. Steps 2–5 and 7 are explicitly deferred to follow-up tickets:

- TIN-141 owns step 2 (scheduler under host-service).
- TIN-218 owns the long-running task + approval queue layered on top of host-service.
- Steps 3 (memory + vault indexing), 4 (OpenCode sidecar lifecycle), 5 (Rust `HostCoordinator`), and 7 (`@tinker/bridge` retirement) stay parked for follow-ups.

## Changes

- New `packages/host-service`:
  - `createHostApp({ config, providers })` returning a `HostAppHandle` (`start()`, `stop()`, `hostId`).
  - Endpoints: `GET /health.check` (unauth) + `GET /host.info` (PSK).
  - PSK validation via injected `HostAuthProvider`; helper `createSharedSecretAuth(secret)` for the typical case (timing-safe `Buffer.compare` semantics via `crypto.timingSafeEqual`).
  - Intrinsic identity per [[D17]]: `hostId = sha256(hostname + persisted-suffix)[0..16]`. Suffix file written 0600 to `~/.tinker/host-identity.json` on first run, reused on subsequent runs, regenerated on parse failure.
  - Strict config contract per spec (no defaults). Provider contract typed for all four future fields (`hostAuth`, `credentials`, `modelResolver`, `secretsWriter`); only `hostAuth` is wired into route handlers at this phase.
  - Config picks free port via `listenPort: 0`. CORS allowlist honored on preflight; non-listed origins receive 204 with no `Access-Control-Allow-Origin` (deny).
  - Built on `node:http` to match `@tinker/auth-sidecar` precedent — no Express, no Fastify (per [[D25]] anti-deps stance).
  - 21 unit tests (`identity`, `auth`, `createHostApp`).
- New `packages/host-client`:
  - `createHostClient({ baseUrl, secret, fetchImpl? })` returning `{ healthCheck(), hostInfo() }`.
  - Bearer-injection for authed routes; runtime guards reject malformed payloads with `HostRequestError` (status `0` reserved for transport failures).
  - Trailing-slash normalization on `baseUrl`.
  - 6 unit tests using `vi.fn`-backed `fetchImpl` seam.
- Knowledge updates:
  - `agent-knowledge/features/11-host-service.md`: removed `deferred: post-mvp` banner, replaced with 2026-05-05 in-flight banner, marked migration steps 1 + 6 as in-flight against TIN-99, called out TIN-141 + TIN-218 dependencies, added a "long-running work + approval queue" subsection.
  - `agent-knowledge/context/tasks.md`: added rows for TIN-99 (review), TIN-141 (not started, depends on this scaffold), TIN-218 (not started).

## Out of scope (intentional)

- No Tauri / Rust changes. Step 5 (Rust `HostCoordinator`) is its own slice and only useful once there is real work to host.
- No `bin/host-service.mjs` runnable entry yet — added when memory / scheduler / OpenCode lifecycle move over.
- No movement of `@tinker/scheduler`, `@tinker/memory`, or `@tinker/bridge` modules.
- No CORS/PSK changes to existing `@tinker/auth-sidecar`.

## Verification

- `pnpm --filter @tinker/host-service lint typecheck test` — clean.
- `pnpm --filter @tinker/host-client lint typecheck test` — clean.
- `pnpm lint` (repo): clean (3 pre-existing apps/desktop console warnings unchanged).
- `pnpm typecheck` (repo): clean across all 11 packages + apps/desktop.
- `pnpm test` (repo): 302 + 27 = 329 tests passing.

## Open questions

- Manifest-on-disk format (per spec §Coordinator) not yet defined here; lands with Rust coordinator slice.
- `deviceCount` is hardcoded `1`. Real device tracking comes with the device-pairing surface.
- Decision needed before TIN-141: do we ship `bin/host-service.mjs` (Node entry) before or after step 4 (OpenCode lifecycle move)? Recommendation: after, so the headless invocation has something to spawn beyond a no-op listener.
