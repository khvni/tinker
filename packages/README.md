# packages/

Every directory here is a pnpm workspace package owned by exactly one Conductor agent. Wave 1 agents run in parallel; Wave 2 agents wait for Wave 1 to merge.

| Package | Owner | Wave | Brief |
|---|---|---|---|
| `shared-types` | coordinator (FROZEN after foundation) | 0 | `tasks/foundation.md` |
| `agent-runtime` | W1 | 1 | `tasks/agent-runtime.md` |
| `memory` | W2 | 1 | `tasks/memory.md` |
| `skills` | W3 | 1 | `tasks/skills.md` |
| `integrations` | W4 | 1 | `tasks/integrations.md` |
| `auth` | W5 | 1 | `tasks/auth.md` |
| `scheduler` | W7 | 2 | `tasks/scheduler.md` |
| `slack-bot` | W8 | 2 | `tasks/slack-bot.md` |

Apps live in `apps/` (see `apps/desktop`, `apps/dojo-web`, `apps/mobile-approvals`).

## Rules

- **`shared-types` is frozen after F0 merges.** Need a new type mid-wave? Open a coordinator PR against `shared-types`; everyone rebases.
- **Do not import another Wave-1 package at runtime.** Code against the type only; stub the implementation in tests. The desktop app is the composition root.
- **Each package has its own `vitest.config` and its own test suite.** Run `pnpm --filter @ramp-glass/<pkg> test` to run just yours.
- **Conventional commits with package scope**: `feat(memory): ...`, `fix(auth): ...`.
