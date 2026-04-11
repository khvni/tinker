# Per-worktree task briefs

These files are the hand-offs for Conductor. The human operator spawns one Conductor workspace per brief and pastes (or `@`-references) the brief into the Conductor chat with a one-line framing:

> *"You are the W<N> agent. Follow `tasks/<name>.md` end-to-end. Do not touch any path outside your Exclusive Write Scope. When done, open a PR to `main`."*

Each brief is self-contained: scope, contract, dependencies, stubs allowed, acceptance test, and the PRD sections that govern it.

## Wave 1 — parallelizable (6 agents)

Run all six simultaneously. They only depend on `packages/shared-types`, which is frozen.

| Brief | Package/App | PRD sections |
|---|---|---|
| [`agent-runtime.md`](./agent-runtime.md) | `packages/agent-runtime` + `apps/desktop` Chat pane | §2.1 tone, §3.2 runtime |
| [`memory.md`](./memory.md) | `packages/memory` + Today pane | §2.4, §3.3 Entity model |
| [`skills.md`](./skills.md) | `packages/skills` + Dojo pane + seed skills | §2.2, §3.3 Skill model |
| [`integrations.md`](./integrations.md) | `packages/integrations` | §2.1, §4.3 self-heal |
| [`auth.md`](./auth.md) | `packages/auth` + Electron main auth window | §2.1 Okta SSO |
| [`dojo-web.md`](./dojo-web.md) | `apps/dojo-web` (Next.js on Vercel) | §2.3 Sensei |

## Wave 2 — sequential (start after Wave 1 is merged)

| Brief | Package/App | PRD sections |
|---|---|---|
| [`scheduler.md`](./scheduler.md) | `packages/scheduler` + `apps/mobile-approvals` | §2.5, §2.7 |
| [`slack-bot.md`](./slack-bot.md) | `packages/slack-bot` | §2.6, §2.9 |
| [`workspace-polish.md`](./workspace-polish.md) | `apps/desktop` workspace layout + renderers | §2.8 |
| [`e2e.md`](./e2e.md) | `tests/e2e` Playwright-Electron | §9 fidelity checklist |

## Rules that apply to every brief

- **`packages/shared-types` is frozen.** Need a new type? Stop, open a coordinator PR against `shared-types`, wait for merge, rebase.
- **Exclusive write scope.** Your brief names the exact paths you may write to. No others.
- **Stub, don't import runtime.** Wave-1 agents must not import another Wave-1 package at runtime. Code against the `shared-types` interface and stub the implementation in tests.
- **`pnpm-lock.yaml` is single-writer.** Rebase onto `main` immediately before adding a dependency.
- **Don't delete placeholder panes** in `apps/desktop/src/renderer/panes/` unless your brief says you own them — another agent may still be racing you.
- **Conventional commits.** Scope = your package (`feat(memory): add sqlite schema`).

See `AGENTS.md` / `CLAUDE.md` at the repo root for the full coding standard.
