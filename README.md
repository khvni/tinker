# Tinker

Tinker is a local-first AI workspace. The desktop shell is Tauri v2, the UI is React + `@tinker/panes` (recursive split tree + tabs), OpenCode runs as a bundled sidecar, and the knowledge base lives in an Obsidian-compatible markdown vault on disk.

## Why it exists

Tinker keeps the agent close to the user and their files. Memory, layout state, and vault notes stay local. LLM access goes through OpenCode and Codex OAuth, so the user can bring a ChatGPT subscription instead of wiring direct API billing into the app.

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

## Architecture

```text
Tinker Desktop (Tauri v2 + React + @tinker/panes)
  |- @tinker/bridge for memory injection + event shaping
  |- @tinker/memory for SQLite-backed memory and layout state
  |- direct HTTP + SSE calls to OpenCode on localhost

OpenCode Sidecar
  |- GPT-5.4 via Codex OAuth
  |- MCP integrations from opencode.json
```

## Status

Early, but bootable. v1 focuses on Google sign-in, Linear via MCP, local vault indexing, and a persistent split-pane workspace.

## Read next

- [tinker-prd.md](./tinker-prd.md) — canonical product spec
- [CLAUDE.md](./CLAUDE.md) — build guide
- [agent-knowledge/](./agent-knowledge/) — feature specs, decisions, session logs

## License

MIT
