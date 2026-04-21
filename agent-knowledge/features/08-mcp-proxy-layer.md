---
type: concept
tags: [tinker, feature, mcp, proxy, performance]
status: not started
priority: p1
deferred: post-mvp
---

> **[2026-04-21] DEFERRED — post-MVP per [[decisions]] D25.** MVP spawns its three preloaded MCPs directly via OpenCode (see [[27-mvp-builtin-mcp]]). Proxy layer becomes relevant only at scale (~10+ MCPs or cross-session reuse) — neither is MVP scope.

# Feature 08 — MCP Proxy Layer

Persistent per-service MCP connections, shared across chat sessions. Target: cold start → first-prompt-ready ≤ 3s with 10+ MCP servers.

## Goal

Open Tinker → integrations ready ≤ 3s. Never re-handshake on every new chat session. Glass parity.

## Reference Implementation ([[ramp-glass]])

- `[2026-04-15]` Glass: 45s → 2s startup via persistent MCP proxy layer
- `[2026-04-15]` "One persistent pipe per service, unlimited sessions on top"
- `[2026-04-15]` Each chat session gets a fresh lightweight wrapper around the shared connection

## Tinker Scope

### v1
- `[2026-04-19]` Singleton proxy at `packages/bridge/src/mcpProxy.ts`
- `[2026-04-19]` Parses `opencode.json` MCP server list at boot, spawns connections in parallel with OpenCode sidecar
- `[2026-04-19]` Per-session wrapper API multiplexes tool calls, tags with session ID
- `[2026-04-19]` Reconnect + backoff + in-flight buffering (≤ 5s reconnect window)
- `[2026-04-19]` `healthcheck()` + event emitter per service → feeds [[11-self-healing-integrations]]
- `[2026-04-19]` Integration with [[01-sso-connector-layer]] — `IntegrationCredentialStore.get(service)` supplies tokens
- `[2026-04-19]` Integration with [[01-sso-connector-layer]] `FederationAdapter` — silent exchange when available (enterprise fork path)

### v2
- `[2026-04-19]` Investigate OpenCode upstream shared-MCP support — adopt native if it lands
- `[2026-04-19]` Per-server connection pooling if parallelism bottlenecks emerge

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

Session wrappers are ephemeral — created per chat, disposed on chat end. Underlying connections persist.

### Failure Modes

| Event | Handling |
|---|---|
| Initial connect fails | Log + emit `service:failed` + mark `needs_reconnect` — chat starts without that service, UI shows status |
| Mid-session 401 | Signal [[01-sso-connector-layer]] credential store to refresh, retry once |
| Mid-session network drop | Buffer in-flight calls, attempt reconnect ≤ 5s, then surface as "retrying" |
| Server crash | Kill connection, respawn via existing MCP server config, reconnect |
| Server unresponsive > timeout | Surface as degraded; don't block unrelated services |

## Implementation Notes

- `[2026-04-19]` Proxy runs inside `packages/bridge` — same process as Better Auth sidecar since both are Node-based, but separate module responsibilities
- `[2026-04-19]` Credentials injected at MCP server spawn via env vars (per CLAUDE.md §5) — never passed via IPC that logs
- `[2026-04-19]` Session wrappers are zero-cost when idle — just closures over shared connection
- `[2026-04-19]` Tool call routing: wrapper tags each call with `X-Tinker-Session-Id` header for audit/debug; underlying MCP server may ignore
- `[2026-04-19]` Circuit-breaker pattern for repeatedly failing services — open circuit after N failures, periodic retry

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

## Open Questions

- How aggressively to parallelize boot? All 10+ at once might overwhelm slow networks.
- Should we expose per-service latency metrics in UI ("Notion is slow today")?
- Circuit breaker thresholds — 3 failures? 5? time-based or count-based?

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
