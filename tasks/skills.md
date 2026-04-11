# W3 · Skills loader + Dojo pane

You are building the skills system — the thing that lets one person's breakthrough become everyone's baseline. Skills are markdown files with YAML frontmatter, git-backed, reviewed like code.

## Context
- `ramp-glass-prd.md` §2.2 (Dojo), §2.3 (Sensei — the recommender lives in `apps/dojo-web`, not here; you just consume it).
- `AGENTS.md` §5 skill format.
- `packages/shared-types/src/skills.ts` — **FROZEN. Do not edit.**
- `dojo/skills/**` — three seed skills already exist. Use them as your fixtures.

## Exclusive write scope
- `packages/skills/**`
- `apps/desktop/src/renderer/panes/Dojo.tsx` (new file; delete `DojoPlaceholder.tsx` and update `Workspace.tsx`)
- `dojo/skills/**` (to add any more seed skills you need for testing, but keep the existing three intact)

## What to build
1. `packages/skills/src/frontmatter.ts`: parse YAML frontmatter from a markdown file. Use `gray-matter` or write a minimal parser. Validate the frontmatter against the `SkillFrontmatter` type — reject skills with missing required fields and log a warning.
2. `packages/skills/src/loader.ts`: walk `dojo/skills/**/*.md`, parse each, return `Skill[]`.
3. `packages/skills/src/store.ts`: real `createSkillStore` implementing `SkillStore`. Installation state is persisted to a local SQLite file (or JSON file — your call, keep it simple).
4. `packages/skills/src/watch.ts`: `chokidar`-based watcher that re-parses skills when files change and fires the `watch` callback.
5. `packages/skills/src/prompt.ts`: `buildSkillSystemPrompt(installed: InstalledSkill[]): string` — concatenates enabled skills into a single system-prompt snippet that the agent runtime will inject. Order skills deterministically by name.
6. `apps/desktop/src/renderer/panes/Dojo.tsx`: full Dojo pane with search box, filter by tag, install/uninstall toggles. Calls into the main process via the `glass` preload API — main process owns the `SkillStore`.

## Dependencies (read-only)
- `@ramp-glass/shared-types`.

## Stubs you may use
- Sensei recommendations: fetch from a stub HTTP endpoint that returns a static top-5 list. The real Dojo-web / Sensei is built by W6.

## Tests (Vitest)
- Unit: frontmatter parser rejects missing fields, accepts valid.
- Unit: loader walks a fixture directory and returns expected count.
- Unit: install → listInstalled → uninstall round-trip.
- Unit: `buildSkillSystemPrompt` output is deterministic and includes all enabled skill bodies.
- Unit: watcher fires on a file change in a tmp dir.

## Acceptance
- [ ] `pnpm --filter @ramp-glass/skills test` passes.
- [ ] Dojo pane lists the 3 seed skills and allows installing them.
- [ ] Installing a skill and reloading the agent runtime causes the skill's body to appear in `TurnContext.systemPrompt`.

## What you must NOT do
- Do not build a GUI skill editor — skills are markdown files reviewed via git.
- Do not edit `packages/shared-types`.
- Do not import `@ramp-glass/agent-runtime` or `@ramp-glass/memory` at runtime — the desktop app composes them.

## When done
`feat(skills): loader, Dojo pane, system-prompt builder`. PR to `main`.
