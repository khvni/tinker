---
type: feature
status: not started
priority: p0
pillar: M7
depends_on: ["M6.3 (memory path resolved)"]
supersedes: ["08-mcp-proxy-layer (MVP subset: direct spawn only)"]
mvp: true
---

# M7 — Built-in MCP servers (qmd, smart-connections, exa)

## Goal

Three MCP servers ship pre-wired and zero-config so every MVP session has working search over memory + the web the moment the workspace opens.

- **qmd** — local search engine over markdown files; scopes to the memory folder.
- **smart-connections** — semantic connections between notes in the memory folder.
- **exa** — remote web search; no auth needed.

## Scope

- `opencode.json` has exactly these three MCPs, all `enabled: true`, none requiring API keys.
- `SMART_VAULT_PATH` env var (consumed by qmd + smart-connections) = memory folder from M6.3. Injected at OpenCode sidecar spawn time by Tauri's `start_opencode` command.
- Exa is a remote MCP — works out of the box, confirmed by a boot-time health ping.
- Settings pane has an "Integrations" section showing the three MCPs with status dots (connected / error / reconnecting). Status read via OpenCode SDK's `mcp.list()` (verify method in research or during impl).
- Per-MCP retry button in Settings triggers a reconnect. If SDK doesn't expose reconnect, fall back to respawn-all.
- Memory-path change (M6.6) cascades: stop OpenCode → respawn with new env → MCPs reconnect.
- First-run verification: on a newly-created session, wait for all three MCPs to report `connected` before enabling the chat composer. Typical wait: 3–5s. Show a minimal `<ConnectionGate>` variant during wait.

## Out of scope

- The full MCP proxy layer ([[08-mcp-proxy-layer]] — deferred). MVP spawns MCPs directly via OpenCode.
- Additional MCPs (github, linear, slack, gmail, etc.) — all require auth and are deferred until the identity layer ships.
- User-editable MCP config. Settings is read-only in MVP.
- Custom env vars per MCP. MVP wires `SMART_VAULT_PATH` only.

## Acceptance

- Fresh install → open app → pick folder → three MCPs report connected within 5s.
- Changing memory folder → three MCPs reconnect with new path.
- Removing a memory file → within the next MCP query, it's no longer returned.
- Exa query from chat works without any user setup.
- Killing an MCP externally → Settings retry button restores it.
- `opencode.json` contains exactly `qmd`, `smart-connections`, `exa` — nothing else, nothing disabled, no env placeholders requiring user values.

## Atomic tasks

See `agent-knowledge/context/tasks.md` §M7.

## Notes for agents

- Env injection happens at spawn — don't try to hot-update env after spawn. That's why M6.6 respawns.
- OpenCode may already auto-restart failed MCPs. Verify this in research before writing retry logic — we may only need to forward the SDK's own retry.
- `<ConnectionGate>` in MVP is a single-screen "Connecting to MCP servers…" splash with a spinner and three status rows. Do NOT build the full [[15-connection-gate]] feature (which includes health checks for every component, retry policies, etc.) — that is deferred.
- Do not remove the `qmd`, `smart-connections`, `exa` entries from `opencode.json` during testing. If they break, fix them — don't disable them.
