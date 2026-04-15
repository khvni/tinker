---
type: index
---

# Agent Session Summaries

Append-only log of what each agent session accomplished. Prevents context loss between sessions and across contributors.

## File Naming

`YYYY-MM-DD-HHMM.md` — timestamp of when the session ended. Sort naturally by filename.

## Required Template

```markdown
# Session YYYY-MM-DD — [Short Title]
Contributor: [GitHub handle or "anonymous"]
Agent: [Claude Code / OpenCode / Codex / other]

## Scope
- What the session set out to do (1-2 sentences)
- Which task(s) from `context/tasks.md` were addressed

## Changes
- Files created/modified/deleted (high level — PR diff has detail)
- Key decisions made in-session

## Decisions Made
- [YYYY-MM-DD] Decision + rationale (anything durable should also land in `product/decisions.md`)

## Knowledge Base Updates
- `knowledge/...` files created or modified and why

## Open Questions / Handoff
- Anything the next agent needs to know
- Unfinished threads

## Gaps Surfaced
- What the knowledge base was missing during this session (future docs to write)
```

## Why This Matters

Without session logs, every agent starts cold and rediscovers decisions. With them, the Nth agent builds on N-1 agents' work without re-deriving context.

Write these even for short sessions. A two-line session note prevents a two-hour rediscovery next time.

## Discipline

- **Write before ending a session**, not as an afterthought
- **Be specific** about decisions and open questions — vague notes don't help future agents
- **Reference wikilinks** to `features/`, `product/`, `reference/` files that were touched
- **Don't summarize the PR diff** — the diff is authoritative; write the *reasoning*
