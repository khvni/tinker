---
type: session
date: 2026-04-22
topic: TIN-118..122 memory pipeline bundle
---

# Session — TIN-118 + TIN-119 + TIN-120 + TIN-121 + TIN-122

## What changed

- Reworked memory provenance to match D12 in code: `EntitySource` is now `{ service, ref, lastSeen, url? }`; relationships now carry `sources[]` instead of a single opaque `source` string.
- Added relationship-schema migration in `packages/memory/src/database.ts` so existing DBs gain `relationships.sources_json`.
- Extended `packages/memory/src/entity-extractor.ts` to:
  - preserve per-line context as `attributes.description`
  - recognize additional typed markers (`ORG:`, `TOOL:`, `CHANNEL:`, `ACCOUNT:`, `EVENT:`, `DOC:`, `CONCEPT:`)
  - emit D12-shaped vault provenance for extracted entities
- Updated `packages/memory/src/memory-pipeline.ts` to persist provenance into note frontmatter via `sources`, so re-indexing no longer loses upstream service refs.
- Updated `packages/memory/src/memory-store.ts` to:
  - normalize legacy + new source shapes
  - prefer `attributes.relativePath` for note lookup
  - keep FTS content fed from descriptions/previews/excerpts/links
  - write relationship provenance to SQLite
  - expand related-entity lookup through a recursive SQLite CTE
  - expose `wipeMemorySource()`, `pruneEntitiesWithoutSources()`, and `runMemoryMaintenanceSweep()`
- Updated renderer sweep path in `apps/desktop/src/renderer/memory.ts` so daily memory sweep now runs a maintenance re-index/prune pass before LLM extraction.
- Updated bridge memory extractor/injector to speak the new provenance shape.

## Tests

- Added `packages/memory/src/entity-extractor.test.ts`.
- Extended `packages/memory/src/memory-utils.test.ts` for source normalization/merge behavior.
- Extended `packages/memory/src/database.test.ts` for relationship provenance migration.
- Verified with:
  - `pnpm -r typecheck`
  - `pnpm -r lint`
  - `pnpm -r test`

## Follow-up risk

- `wipeMemorySource()` currently updates SQLite only; file deletion/rewrite for disconnected service mirrors still needs the future disconnect UI/path that passes an explicit vault root. Current bundle lays the provenance/filtering core without inventing that UI prematurely.
