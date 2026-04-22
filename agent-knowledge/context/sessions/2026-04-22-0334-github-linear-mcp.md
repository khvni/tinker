---
type: session
date: 2026-04-22
topic: TIN-158 + TIN-159 GitHub and Linear MCP integration PR
---

# Session — TIN-158 + TIN-159 GitHub + Linear MCP

## What shipped

- Added GitHub and Linear MCP entries back into `opencode.json`.
- Used current official remote MCP endpoints instead of stale package references:
  - GitHub: `https://api.githubcopilot.com/mcp/`
  - Linear: `https://mcp.linear.app/mcp`
- Expanded Better Auth GitHub scopes to include `read:org` + `repo` so the signed-in GitHub token can drive MCP repo/issue/PR access.
- Passed GitHub and optional Linear bearer auth headers into OpenCode sidecar startup from Tauri.
- Replaced the Exa-only boot MCP status check with tracked status handling for Exa + GitHub + Linear.
- Added GitHub reconnect guidance when an existing signed-in session lacks repo scopes.

## Why scope changed from ticket wording

- `TIN-159` referenced `@tacticlaunch/mcp-linear`, but current official Linear docs now point to the hosted remote MCP with OAuth and bearer-token fallback. Using the official remote server matches current OpenCode OAuth support and avoids wiring an outdated local package.
- `TIN-158` referenced `@modelcontextprotocol/server-github`, but the published package README is deprecated in favor of GitHub's current MCP docs/repo. The official remote GitHub MCP endpoint fits Tinker's existing auth flow better because we already have a GitHub access token in keychain-backed app state.

## Verification

- `pnpm -r typecheck`
- `pnpm -r lint`
- `pnpm -r test`
- `cd apps/desktop/src-tauri && cargo test --lib`

## Follow-ups / caveats

- Existing GitHub users who signed in before this PR will need to reconnect GitHub once to grant the new repo scopes.
- Linear API-key fallback is env-based (`TINKER_LINEAR_API_TOKEN` / `LINEAR_API_TOKEN`) for now; no dedicated in-app secret entry UI was added in this slice.
- PR: #102
