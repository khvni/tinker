# Ramp Glass × Conductor

This directory is read by [Conductor](https://www.conductor.build/) — the macOS app for orchestrating parallel coding agents across git worktrees.

## How this repo is laid out for parallel agents

Glass is a monorepo of TypeScript packages. Each **package** is a self-contained unit of work an agent can own end-to-end without stepping on anyone else's files.

```
packages/
  shared-types/     ← FROZEN. Contracts every agent codes against. Do not edit.
  agent-runtime/    ← Wave 1 · W1
  memory/           ← Wave 1 · W2
  skills/           ← Wave 1 · W3
  integrations/     ← Wave 1 · W4
  auth/             ← Wave 1 · W5
  scheduler/        ← Wave 2 · W7
  slack-bot/        ← Wave 2 · W8
apps/
  desktop/          ← Electron shell. Wave 1 panes land in src/renderer/panes/*.
  dojo-web/         ← Wave 1 · W6 (Next.js on Vercel)
  mobile-approvals/ ← Wave 2 · W7
```

Each package / app has a matching brief in `tasks/*.md` at the repo root. Hand that brief to the agent when you spawn its workspace.

## Operator workflow

For each parallel agent you want to run:

1. Open Conductor → **New workspace** against this repo.
2. Base branch: `main` (already configured as `worktree.default_branch`).
3. In chat, `@`-reference the matching brief, e.g. `@tasks/agent-runtime.md`. Tell the agent: *"You are the W1 agent. Follow this brief end-to-end. Do not edit any path outside your Exclusive Write Scope."*
4. Conductor runs `.conductor/scripts/setup.sh` on workspace creation (pnpm install + typecheck of shared-types).
5. Agent works. When done, use ⌘⇧P to open a PR to `main`.
6. Human merges on GitHub. Conductor archives the workspace.

## Parallelism plan

- **Wave 1 (run all 6 in parallel):** `agent-runtime`, `memory`, `skills`, `integrations`, `auth`, `dojo-web`.
- **Wave 2 (start after Wave 1 is merged):** `scheduler`, `slack-bot`, `workspace-polish`, `mobile-approvals`, `e2e`.

`recommendations.parallel_agents` in `conductor.json` is set to 6.

## Non-negotiables for every agent

These are enforced by `AGENTS.md` / `CLAUDE.md` at the repo root; Conductor passes those through to Claude Code automatically.

- **`packages/shared-types` is frozen.** Need a new type? Open a PR against shared-types first via a coordinator.
- **Exclusive write scope.** Each task brief names the exact paths an agent may write to. Nothing else.
- **`pnpm-lock.yaml` is single-writer.** Rebase onto `main` before adding a dependency.
- **Stub, don't import.** Wave-1 agents don't import other Wave-1 packages at runtime. They stub the interface from `shared-types`.

## Env vars available to scripts

Provided by Conductor:

- `CONDUCTOR_ROOT_PATH` — original repo path
- `CONDUCTOR_WORKSPACE_NAME` — workspace (branch) name
- `CONDUCTOR_PORT` — a free port reserved for this workspace (use it if you run a dev server)
