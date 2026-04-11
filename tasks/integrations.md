# W4 · Integrations (MCP clients)

You are wiring every external tool Glass ships with on day one. The PRD calls these out explicitly: Slack, Notion, Linear, Salesforce, Gong, Snowflake, Zendesk, Google Calendar, plus Ramp Research / Ramp Inspect / Ramp CLI stubs.

## Context
- `ramp-glass-prd.md` §2.1 (pre-wired integrations, self-healing), §3.2 (MCP), §3.4 runtime flows.
- `AGENTS.md` §4.3 error handling — integrations must self-heal, never surface stack traces.
- `packages/shared-types/src/integrations.ts` — **FROZEN. Do not edit.**

## Exclusive write scope
- `packages/integrations/**`

## What to build
1. `packages/integrations/src/base.ts`: an abstract `BaseMCPClient` that implements the `MCPClient` contract and handles: connection lifecycle, 401-triggered self-heal (calls a `reauth` callback provided at construction), retries with exponential backoff on 5xx, and structured logging.
2. One file per integration under `packages/integrations/src/clients/`:
   - `slack.ts`
   - `notion.ts`
   - `linear.ts`
   - `salesforce.ts`
   - `gong.ts`
   - `snowflake.ts`
   - `zendesk.ts`
   - `google-calendar.ts`
   - `ramp-research.ts`  (stub — see below)
   - `ramp-inspect.ts`   (stub — see below)
   - `ramp-cli.ts`       (stub — see below)
3. Each client wraps the corresponding MCP server via `@modelcontextprotocol/sdk`. For integrations without a publicly available MCP server, wrap the vendor's REST API directly and present the same `MCPClient` interface. Document the choice in a comment at the top of each file.
4. The three Ramp-built integrations (`ramp-research`, `ramp-inspect`, `ramp-cli`) are stubbed with the same `MCPClient` interface so they can be swapped later when real backends exist. Each stub exposes at least one typed no-op tool.
5. `packages/integrations/src/registry.ts`: real `createIntegrationRegistry` that tracks health of every registered client and implements `healAll`.

## Dependencies (read-only)
- `@ramp-glass/shared-types`.
- `@modelcontextprotocol/sdk` (add as a dep; you may touch `pnpm-lock.yaml` — rebase onto `main` first).

## Stubs you may use
- Tokens: take a `getToken: () => Promise<string>` callback at construction. The real token vault is the auth package's job.
- For tests, pass a mock fetcher that simulates 401 → reauth → 200 to prove self-heal works.

## Tests (Vitest)
- Unit: `BaseMCPClient` self-heals on 401 — exactly one reauth call, then success.
- Unit: retries 5xx with backoff, surrenders after N attempts.
- Unit: each client's `listTools` returns the expected tool names (use vendor OpenAPI schemas or MCP manifests where available).
- Unit: `healAll` attempts to reconnect every unhealthy client.

## Acceptance
- [ ] `pnpm --filter @ramp-glass/integrations test` passes.
- [ ] A forced 401 in any client triggers exactly one silent reauth; the caller never sees the error.
- [ ] All 11 clients instantiate without network access (useful for CI).

## What you must NOT do
- Do not edit `packages/shared-types`.
- Do not persist tokens. Tokens are always passed in via callback.
- Do not import `@ramp-glass/auth` — auth holds the vault; you only receive tokens.
- Do not let an integration error propagate as a raw exception past the registry boundary.

## When done
`feat(integrations): BaseMCPClient + 11 clients with self-heal`. PR to `main`.
