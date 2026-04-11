# W2 · Memory

You are building Glass's cross-session memory — the thing that lets the agent enter every conversation already knowing the user's people, projects, and references.

## Context
- `ramp-glass-prd.md` §2.4 (memory system), §3.3 (entity/relationship model), §3.4 runtime flows (a) first-launch bootstrap and (c) daily synthesis.
- `AGENTS.md` §6 memory discipline.
- `packages/shared-types/src/memory.ts` — **FROZEN. Do not edit.**

## Exclusive write scope
- `packages/memory/**`
- `apps/desktop/src/renderer/panes/Today.tsx` (new file; delete `TodayPlaceholder.tsx` in the same PR and update `Workspace.tsx` to import `Today.tsx`)

## What to build
1. `packages/memory/src/sqlite.ts`: `better-sqlite3` schema for `entities`, `relationships`, `sessions`, `session_entity_refs`. Use prepared statements. All IDs are ULIDs.
2. `packages/memory/src/vector.ts`: embedding index via `sqlite-vss` (or a pure-TS fallback if sqlite-vss fails to build). Store embeddings for entity names + aliases + summaries.
3. `packages/memory/src/store.ts`: real `createMemoryStore` implementing the `MemoryStore` interface. Hybrid search = BM25 (SQLite FTS5) ∪ vector, re-ranked by score.
4. `packages/memory/src/bootstrap.ts`: `runMemoryBootstrap` — takes a `MemoryBootstrapInput`, calls a pluggable `IntegrationFetcher` interface (you define it) to pull a bounded slice of entities from each connected integration, dedupes, writes to store. This phase: take the fetcher as a constructor arg so integrations can be stubbed.
5. `packages/memory/src/synthesis.ts`: `runDailySynthesis` — mines the last 24h of sessions, reconciles entities, decays old ones, writes a "what changed today" session summary.
6. `apps/desktop/src/renderer/panes/Today.tsx`: renders the user's top-N recent entities, active projects, and a "what changed today" panel. Read-only for this phase.

## Dependencies (read-only)
- `@ramp-glass/shared-types`.

## Stubs you may use
- The `IntegrationFetcher` interface is yours to define and stub with fixtures. Do not import `@ramp-glass/integrations`.

## Tests (Vitest)
- Unit: `upsertEntity`, `upsertRelationship`, `search` (text-only + vector + hybrid) against an in-memory SQLite.
- Unit: dedupe via aliases works.
- Unit: `runMemoryBootstrap` against a fixture fetcher returns expected counts and writes expected rows.
- Unit: `runDailySynthesis` with a seeded history produces a non-empty summary and updates `lastSeenAt` for touched entities.

## Acceptance
- [ ] `pnpm --filter @ramp-glass/memory test` passes.
- [ ] `apps/desktop` boots with the new Today pane showing fixture data.
- [ ] A `runDailySynthesis` smoke test runs in <2s on a fixture of 500 entities.

## What you must NOT do
- Do not edit `packages/shared-types`.
- Do not import any other Wave-1 package.
- Do not store memory data outside the OS's per-user app-data directory.
- Do not upload memory data anywhere. Memory is local.

## When done
`feat(memory): sqlite store, bootstrap, daily synthesis, Today pane`. PR to `main`.
