# Tinker

Tinker is a local-first AI workspace. The desktop shell is Tauri v2, the UI is React + `@tinker/panes` (recursive split tree + tabs), OpenCode runs as a bundled sidecar, and the knowledge base lives in an Obsidian-compatible markdown vault on disk.

## Why it exists

Tinker keeps the agent close to the user and their files. Memory, layout state, and vault notes stay local. The agent runtime is OpenCode — Tinker wraps OpenCode's SDK with a GUI, so model choice (local or cloud) and provider auth are handled by OpenCode, not by the app. Identity sign-in (Google, GitHub, Microsoft) runs through Better Auth as a local sidecar.

## Quick start

Prerequisites:

- Node.js 20+
- pnpm 9+
- Rust 1.77.2+
- Xcode Command Line Tools on macOS

Development:

```bash
pnpm install
pnpm --filter @tinker/desktop dev
```

Manual verification:

- [docs/development.md](./docs/development.md) — MVP smoke-test checklist for local runs

## Architecture

```text
Tinker Desktop (Tauri v2 + React + @tinker/panes)
  |- @tinker/bridge for memory injection + event shaping
  |- @tinker/memory for SQLite-backed memory and layout state
  |- direct HTTP + SSE calls to OpenCode on localhost

OpenCode Sidecar
  |- model + provider auth (OpenCode-owned; Tinker does not replicate)
  |- MCP integrations from opencode.json

Better Auth Sidecar (packages/auth-sidecar)
  |- identity sign-in (Google, GitHub, Microsoft)
  |- session management
```

## Status

Early, but bootable. v1 focuses on Better Auth sign-in (Google / GitHub / Microsoft), Linear via MCP, local vault indexing, and a persistent split-pane workspace.

## Read next

- [tinker-prd.md](./tinker-prd.md) — canonical product spec
- [CLAUDE.md](./CLAUDE.md) — build guide
- [agent-knowledge/](./agent-knowledge/) — feature specs, decisions, session logs

## License

MIT
