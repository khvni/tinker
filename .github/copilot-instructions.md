# Tinker — async-agent onramp

Tinker is a local-first desktop AI workspace. Tauri v2 shell + React 19 renderer + OpenCode sidecar (agent backend) + a user-owned memory folder.

## Read in this order before writing code

1. [`agent-knowledge/context/tasks.md`](../agent-knowledge/context/tasks.md) — atomic MVP task matrix + claim rules. Pick any `not started` row whose dependencies are `done`, flip status to `claimed`, commit, then open a draft PR.
2. [`agent-knowledge/product/decisions.md`](../agent-knowledge/product/decisions.md) — especially **D25** (MVP refocus: ship eight pillars; every other feature is deferred, not rejected).
3. [`CLAUDE.md`](../CLAUDE.md) / [`AGENTS.md`](../AGENTS.md) — build rules, tech stack, coding standards. Identical files, keep in sync.

## Supporting references

- [`tinker-prd.md`](../tinker-prd.md) — canonical what-to-build spec.
- [`agent-knowledge/README.md`](../agent-knowledge/README.md) — feature specs, reference implementations, session logs.
- Linear workspace: team key **TIN** at https://linear.app/tinker. Task rows in `tasks.md` link the matching Linear issue.

## Non-negotiable guardrails

- TypeScript strict. No `any`, no `@ts-ignore`, no `--no-verify`.
- Function components only. Folder-per-component layout per D21.
- UI values come from `@tinker/design` tokens only (D14 / D23). No inline hex, no raw `rgba()`.
- `@tinker/panes` is the only layout engine — never add `dockview-react` imports (D16).
- OpenCode owns provider + model auth. Do not call provider APIs directly (D25 non-goals).
- Conventional commits: `feat(<scope>): <summary>`. Scope matches the pillar or package.
- Out-of-scope work belongs in a new Linear issue, not in the current PR.
