---
type: concept
tags: [tinker, feature, mcp, proxy, performance]
status: not started
priority: p1
deferred: post-mvp
---

> **[2026-04-21] DEFERRED — post-MVP per [[decisions]] D25.** MVP spawns its three preloaded MCPs directly via OpenCode (see [[27-mvp-builtin-mcp]]). Proxy layer becomes relevant only at scale (~10+ MCPs or cross-session reuse across distinct memory roots) — neither is MVP scope.

> **[2026-05-05] STALE-PARTS NOTICE.** This spec was drafted 2026-04-19 against an architecture that has since shifted. Until a refreshed version lands, treat the following as superseded:
>
> - **Home package**: spec says `packages/bridge/src/mcpProxy.ts`. Wrong. `@tinker/bridge` is a renderer-side TS lib (chat-history / memory-injector / skill-injector / stream / memory-extractor) and cannot host long-lived processes. The natural home is `packages/host-service` ([[11-host-service]] / TIN-99) once that scaffold exists. See §Implementation Notes for the corrected boundary.
> - **"Cross-session reuse" framing**: TIN-192 / PR #120 already gives multiple panes that share a `(folder, user_id, memory_subdir)` key one OpenCode sidecar — and therefore one set of MCP handshakes — via per-request `x-opencode-directory`. The remaining bottleneck is **distinct memory roots / users**, not multiple panes within a root.
> - **`@tinker/panes` references**: PR #128 retired `@tinker/panes` and `dockview-react` for FlexLayout. Any pane-coupling notes here are vestigial.
>
> Tracking ticket: [TIN-98](https://linear.app/tinker/issue/TIN-98).

# Feature 08 — MCP Proxy Layer

Persistent per-service MCP connections, shared across chat sessions and across OpenCode sidecars. Target: cold start → first-prompt-ready ≤ 3s with 10+ MCP servers.

## Goal

Open Tinker → integrations ready ≤ 3s. Never re-handshake on every new chat session. Glass parity.

## Reference Implementation ([[ramp-glass]])

- `[2026-04-15]` Glass: 45s → 2s startup via persistent MCP proxy layer
- `[2026-04-15]` "One persistent pipe per service, unlimited sessions on top"
- `[2026-04-15]` Each chat session gets a fresh lightweight wrapper around the shared connection

## Tinker Scope

### Prerequisites (must land before v1)
- `[2026-05-05]` [[11-host-service]] / TIN-99 scaffold (proxy lives there, not in `packages/bridge`)
- `[2026-05-05]` Decision recorded in [[decisions]] on fork-vs-upstream-contribute (see Open Questions)
- `[2026-05-05]` Confirmation that OpenCode's `type: remote` MCP entry can stand in for both stdio and SSE upstreams (research spike — see Implementation Notes §Transport coverage)

### v1
- `[2026-05-05]` Singleton proxy in `packages/host-service/src/mcp-proxy/` ([[11-host-service]] dependency). Co-resident with the host's other long-lived runtimes (chat runtime, vault indexer, OpenCode coordinator). Renderer / OpenCode sidecars talk to it over the host PSK boundary.
- `[2026-04-19]` Parses `opencode.json` MCP server list at boot, spawns connections in parallel with OpenCode sidecar.
- `[2026-04-19]` Per-session wrapper API multiplexes tool calls, tags with session ID.
- `[2026-04-19]` Reconnect + backoff + in-flight buffering (≤ 5s reconnect window).
- `[2026-04-19]` `healthcheck()` + event emitter per service → feeds [[11-self-healing-integrations]].
- `[2026-04-19]` Integration with [[01-sso-connector-layer]] — `IntegrationCredentialStore.get(service)` supplies tokens.
- `[2026-04-19]` Integration with [[01-sso-connector-layer]] `FederationAdapter` — silent exchange when available (enterprise fork path).
- `[2026-05-05]` Cutover surface: rewrite `opencode.json` entries to `type: remote` pointing at the proxy; OpenCode sidecars stop spawning their own MCP children and become thin clients of the proxy. Behind a feature flag — easy rollback to direct-spawn until the proxy is stable.

### v2
- `[2026-04-19]` Investigate OpenCode upstream shared-MCP support — adopt native if it lands. See [anomalyco/opencode#22787](https://github.com/anomalyco/opencode/issues/22787) for the closest upstream signal.
- `[2026-04-19]` Per-server connection pooling if parallelism bottlenecks emerge.
- `[2026-05-05]` Stdio multiplexing — v1 may ship remote-only (SSE / HTTP-streaming) if the v0 transport spike confirms `qmd` / `smart-connections` can be wrapped behind a remote MCP shim. Native stdio fan-in defers to v2.

## Architecture

### Boot Sequence

```
1. Tauri launches OpenCode sidecar (parallel)
2. Tauri launches Better Auth sidecar (parallel)
3. Tauri reads opencode.json → MCP server list
4. For each MCP server (parallel):
   a. federationAdapter.canFederate(service)?
      Yes: credential = federationAdapter.exchangeForService(idpToken, service)
      No:  credential = integrationCredentialStore.get(service)
           On miss: mark "needs_consent", defer
   b. proxy.connect(service, credential)
   c. healthcheck() → emit("service:connected", service)
5. After all settled: emit("ready")
```

Target: step 4 completes ≤ 3s for 10+ servers. Parallelism critical.

### Connection Types

Per MCP spec, servers are one of:
- **stdio** — local process, no auth beyond env vars
- **SSE** — HTTP long-poll, uses bearer token
- **HTTP streaming** — newer standard, uses bearer token

Proxy must handle all three. Credential injection differs per transport.

### Per-Session Wrapper

```ts
interface ProxySession {
  sessionId: string
  callTool(server: string, tool: string, args: unknown): Promise<unknown>
  listTools(): Promise<ToolDescriptor[]>
  dispose(): void
}

class McpProxy {
  connect(service: string, credential: string): Promise<void>
  disconnect(service: string): Promise<void>
  createSession(sessionId: string): ProxySession
  healthcheck(): Record<string, ServiceStatus>
  on(event: 'service:connected' | 'service:failed' | 'ready', handler): void
}
```

Session wrappers are ephemeral — created per chat, disposed on chat end. Underlying connections persist across sessions, sidecars, and memory roots.

### Failure Modes

| Event | Handling |
|---|---|
| Initial connect fails | Log + emit `service:failed` + mark `needs_reconnect` — chat starts without that service, UI shows status |
| Mid-session 401 | Signal [[01-sso-connector-layer]] credential store to refresh, retry once |
| Mid-session network drop | Buffer in-flight calls, attempt reconnect ≤ 5s, then surface as "retrying" |
| Server crash | Kill connection, respawn via existing MCP server config, reconnect |
| Server unresponsive > timeout | Surface as degraded; don't block unrelated services |

## Implementation Notes

- `[2026-05-05]` **Home boundary.** Proxy runs inside `packages/host-service` per [[11-host-service]] — co-resident with the host's chat runtime and OpenCode coordinator. Replaces the original `packages/bridge` claim, which predates the device/host split. The Better Auth sidecar stays a separate Node process; do not collapse them.
- `[2026-05-05]` **Transport coverage.** Three upstream transports per the MCP spec: stdio (local process), SSE (HTTP long-poll), HTTP-streaming. Tinker's MVP servers are mixed: `qmd` + `smart-connections` are stdio, `exa` / `linear` / `github` are remote. The proxy must terminate all three transports upstream and re-export them as a single `type: remote` endpoint downstream that OpenCode sidecars can consume. Stdio fan-in is the highest-risk leg — see Open Questions.
- `[2026-05-05]` **OpenCode integration shape.** Two compatible models: (a) proxy exposes one virtual remote MCP per service, OpenCode lists each by name; (b) proxy exposes a single multiplexed remote MCP that namespaces tools as `<service>_<tool>`. Pick one in the v0 design spec; do not ship both.
- `[2026-04-19]` Credentials injected at MCP server spawn via env vars (per CLAUDE.md §5) — never passed via IPC that logs.
- `[2026-04-19]` Session wrappers are zero-cost when idle — just closures over shared connection.
- `[2026-04-19]` Tool call routing: wrapper tags each call with `X-Tinker-Session-Id` header for audit/debug; underlying MCP server may ignore. Verify before shipping that this header doesn't break the official `linear` / `github` remote MCPs.
- `[2026-04-19]` Circuit-breaker pattern for repeatedly failing services — open circuit after N failures, periodic retry.

## Acceptance Criteria

- [ ] Cold start (fresh DB, prior auth) → all 10+ configured services reachable in ≤ 3s
- [ ] Opening a second chat does NOT trigger new MCP handshakes
- [ ] Proxy survives network drops (tested: airplane mode for 30s, recovery)
- [ ] Token refresh via credential store propagates to live connections without dropping them
- [ ] Failed service does not block other services from being available
- [ ] Graceful shutdown on app quit — all connections closed, no orphaned processes

## Out of Scope ([[decisions]])

- `[2026-04-19]` Cross-machine proxy sharing (no; local-first)
- `[2026-04-19]` MCP server auto-discovery (no; `opencode.json` is source of truth)
- `[2026-04-19]` Hot-reload of MCP server config (deferred; restart app)
- `[2026-05-05]` Within-memory-root pane sharing (already free via TIN-192 / PR #120 `x-opencode-directory`; not a v1 goal of this layer)

## Open Questions

- How aggressively to parallelize boot? All 10+ at once might overwhelm slow networks. Initial cap: 6 concurrent.
- Should we expose per-service latency metrics in UI ("Notion is slow today")? Recommend defer — not on critical path.
- Circuit breaker thresholds — 3 failures? 5? time-based or count-based?
- `[2026-05-05]` **Sequencing**: TIN-98 strictly after TIN-99, or parallel with shared scaffolding work?
- `[2026-05-05]` **Fork vs upstream**: build the proxy inside Tinker, or upstream-contribute shared-MCP support to OpenCode? See v2 above and [anomalyco/opencode#22787](https://github.com/anomalyco/opencode/issues/22787).
- `[2026-05-05]` **Stdio coverage in v1**: must v1 multiplex stdio MCPs (`qmd`, `smart-connections`), or can we ship remote-only first and address stdio in v2? Depends on whether OpenCode is willing to accept a `type: remote` shim in front of what was a local MCP.
- `[2026-05-05]` **Per-session header audit**: does `X-Tinker-Session-Id` round-trip cleanly through the official Linear / GitHub remote MCPs? One-call test gate before commit.
- `[2026-05-05]` **OpenCode → proxy contract**: virtual-MCP-per-service vs single multiplexed endpoint with `<service>_<tool>` namespacing? Decide in the v0 design spec.

## Open-Source References

- MCP spec — https://spec.modelcontextprotocol.io
- Glass architecture article — referenced in [[ramp-glass]]
- `@opencode-ai/sdk` MCP integration — https://opencode.ai/docs/sdk/

## Connections
- [[01-sso-connector-layer]] — supplies credentials via `IntegrationCredentialStore`
- [[11-self-healing-integrations]] — consumes `healthcheck()` events
- [[03-memory-pipeline]] — consumes MCP tool responses for entity extraction
- [[ramp-glass]] — 45→2s benchmark source
- [[auth-architecture]] — federation adapter integration
- [[decisions]] — D10 MCP-only, D13 vault separation
