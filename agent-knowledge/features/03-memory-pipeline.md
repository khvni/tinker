---
type: concept
tags: [tinker, feature, memory, vault, pipeline]
status: review
priority: p2
---

# Feature 03 — Self-Building Memory Pipeline

Agent enters each conversation with context it didn't have to be given. Memory accumulates from connected tools and past sessions without user curation.

## Goal

Every 24 hours (and on demand), mine connected MCP integrations (Gmail, Calendar, Drive, Linear, GitHub) for entities, relationships, and evolving state. Extract atomic facts. Write to vault as markdown (human-readable). Index into SQLite (fast queries). Inject relevant memory into each new session.

## Reference Implementation ([[ramp-glass]])

- `[2026-04-10]` On first open: full memory system built from authenticated connections — context on people, active projects, Slack channels, Notion docs, Linear tickets
- `[2026-04-10]` **24-hour synthesis and cleanup pipeline** — mines previous sessions + connected tools for updates
- `[2026-04-10]` "Glass can adapt to their world without them having to re-explain things every session"
- `[2026-04-10]` Agent enters each conversation with the context the user expects — "spends less time searching"

## Tinker Scope

### v1 Scope
- `[2026-04-14]` **Vault indexing** (already in PRD §2.4) — parse markdown files, extract frontmatter + body, upsert entities to SQLite
- `[2026-04-14]` **Session memory append** — after each chat session, extract atomic facts from the conversation and append to relevant vault notes
- `[2026-04-14]` **MCP entity extraction** — scheduled daily sweep of connected tools for new entities

### v2 / later
- Cross-tool relationship inference (e.g., "this person on Calendar is the same as this Linear assignee")
- Temporal decay / stale-fact pruning
- Proactive suggestions based on memory state (Sensei-adjacent)

## Architecture

### Vault layout separation (D13)

```
<vault>/
  <user-authored markdown>          # user's notes — NEVER touched by agent
  .tinker/
    memory/                         # synthesized memory, write-once-read-many
      entities/<id>.md
      relationships/<id>.md
    mirrors/                        # auto-synced from services; wipeable on disconnect
      notion/
      slack/
      ...
    logs/
    dojo/
```

**Invariant:** top-level vault is user-owned; `.tinker/mirrors/<service>/` is app-owned and wipeable.

### Storage layers

1. **Vault** (`<vault>/**/*.md`) — canonical, human-readable. Entities in their own files with `[YYYY-MM-DD]` atomic bullets.
2. **SQLite** (via Tauri SQL plugin) — index of entities + relationships + FTS for search. NOT the canonical copy.
3. **In-memory session context** — subset of SQLite entities relevant to the current prompt, injected before the user message.

### Entity provenance (D12)

Every memory entity carries source metadata. Required for clean disconnect wipes.

```ts
type MemoryEntity = {
  id: string
  kind: 'person' | 'doc' | 'project' | 'org' | 'concept'
  sources: Array<{
    service: string          // e.g. "notion", "slack"
    ref: string              // provider-specific ID
    lastSeen: string         // ISO timestamp
  }>
  synthesizedAt: string
  // ... entity-kind-specific fields
}

type Relationship = {
  source: MemoryEntityId
  target: MemoryEntityId
  kind: 'collaborates_with' | 'mentioned_in' | 'reports_to' | ...
  provenance: Array<{ service: string; ref: string }>
}
```

**Rule:** entity survives if `sources.length >= 1` post-wipe. Relationship survives if `provenance.length >= 1`. Enables nuclear disconnect of one service without corrupting cross-service graph.

### Extraction pipeline

Triggered by:
- `[2026-04-14]` **Scheduled** (daily) — via [[04-native-scheduler]], runs as a sub-agent task
- `[2026-04-14]` **Event** (on MCP tool use) — incremental: when a tool call returns new data, extract entities from the response
- `[2026-04-14]` **Session end** — after the user closes a session, summarize the conversation into atomic facts

### Extraction process

1. `[2026-04-14]` Source data (email thread, calendar event, Linear ticket, chat transcript) is passed to a dedicated extraction sub-agent
2. `[2026-04-14]` Sub-agent outputs structured JSON: `{entity: <wikilink-name>, type: <person|concept|org|tool>, facts: [{text, date}]}`
3. `[2026-04-14]` Pipeline merges into vault markdown files — appends new atomic bullets, preserves existing content (never destructive rewrites)
4. `[2026-04-14]` SQLite index updated from file diffs

### Memory injection

1. `[2026-04-14]` Before each user prompt, bridge package queries SQLite for entities mentioned or implied in the prompt
2. `[2026-04-14]` Top-N relevant entity excerpts appended as a `noReply` prompt (per PRD §2.2 flow)
3. `[2026-04-14]` Real user prompt follows

## Implementation Notes

- `[2026-04-14]` Vault format is Obsidian-compatible — agents should respect existing markdown structure (frontmatter, wikilinks, heading hierarchy)
- `[2026-04-14]` Never overwrite existing atomic facts — append new dated bullets
- `[2026-04-14]` Pronoun resolution is critical — extraction sub-agent must resolve "he/she/it" to named entities before writing
- `[2026-04-14]` Wikilinks use bare form `[[Name]]`, not `[[path/Name]]`
- `[2026-04-15]` Managed facts append under `## Tinker Memory`; user-authored note content and later sections stay intact
- `[2026-04-15]` Prompt-time retrieval uses SQLite FTS + one-hop `relationships` expansion from indexed wikilinks
- `[2026-04-15]` Daily sweep state lives in SQLite `memory_runs`; renderer timer calls same extraction + append-only merge path until [[04-native-scheduler]] is on this branch

### Scheduling

- `[2026-04-14]` Daily sweep runs via [[04-native-scheduler]]
- `[2026-04-14]` On-tool-use extraction runs inline — don't block user prompts; fire-and-forget async
- `[2026-04-14]` Cleanup pass (stale fact flagging) runs weekly, not daily

## Disconnect Semantics (D11, D12, D15)

Two-step design:

### Narrow (default): "Disconnect Notion"
- Revoke refresh token at Notion
- Clear `(userId, notion)` from keychain
- Tear down MCP connection
- **Derived data stays:** memory entities tagged `source: notion` persist; vault files mirrored stay
- Reconnect = seamless resume

### Nuclear (explicit, separate action): "Wipe Notion data"
Runs as a memory pipeline pass, not a raw file delete:

1. Enumerate entities where `sources` includes `notion`
2. For each: filter `sources` array excluding `notion`; if empty → mark for deletion
3. Enumerate relationships similarly via `provenance` array
4. Cascade: orphaned entities (no incoming/outgoing edges) flagged for next sweep
5. Delete `.tinker/mirrors/notion/` directory
6. Re-run synthesis pass excluding `notion` source — repairs orphaned edges

UI must show entity/file counts before executing:
> "This will delete 47 memory entities, 12 mirrored vault files, 231 cross-references. User-authored notes stay. This cannot be undone."

Never touch top-level user-authored markdown, regardless of what source originally seeded it.

## Out of Scope ([[decisions]])

- `[2026-04-14]` Vector embeddings for semantic search — use FTS + wikilink traversal in v1; add vectors only if recall is insufficient
- `[2026-04-14]` Cross-tool identity resolution (email ↔ Linear ↔ GitHub user) in v1 — string-match by email/name
- `[2026-04-19]` Auto-suggesting wipes on disconnect — always user-explicit

## Open Questions

- **Extraction model**: run extraction with same GPT-5.4 as chat, or cheaper model? Leaning: same model, but with a tight system prompt that forces structured output.
- **Batch size for daily sweep**: process all new Gmail threads in one big prompt vs. one at a time? Big-batch is token-efficient but worse for parallel errors.
- **Human-in-the-loop review**: should extracted facts be confirmed by the user before landing in the vault? Leaning: no for v1 (trust + correct); add opt-in review for sensitive entity types later.

## Security Considerations

- `[2026-04-14]` Source data (emails, Linear tickets) may contain PII / sensitive content; extraction prompts must not log raw source to external services
- `[2026-04-14]` Extracted facts inherit sensitivity — vault is local but still user-owned; nothing leaves the machine
- `[2026-04-14]` MCP responses treated as untrusted prompt input (per CLAUDE.md §5) — extraction sub-agent must be robust against prompt injection embedded in source data

## Open-Source References

- Karpathy's "LLM Wiki" concept — https://karpathy.ai/ (conceptual precedent for agent-maintained KB)
- Farzapedia — canonical LLM wiki implementation Karpathy endorsed
- Rowboat — open-source typed-entity knowledge graph (github.com/rowboatlabs/rowboat)
- agentmemory (rohitg00) — open-source implementation of Karpathy pattern

## Acceptance Criteria

- [x] Vault markdown files are indexed into SQLite `entities` table on app launch
- [x] After a chat session, atomic facts are appended to relevant vault notes
- [x] Daily scheduled sweep extracts entities from Gmail / Calendar / Drive / Linear
- [x] Before each user prompt, relevant entities are injected as context
- [x] Agents can traverse wikilinks in extracted content (existing entity references preserved)
- [x] Extraction never overwrites existing content destructively

## Connections
- [[ramp-glass]] — 24hr synthesis reference
- [[04-native-scheduler]] — triggers the daily sweep
- [[01-sso-connector-layer]] — provides the MCP integrations memory mines
- [[08-mcp-proxy-layer]] — source of MCP tool responses
- [[decisions]] — D11, D12, D13 provenance + disconnect semantics
