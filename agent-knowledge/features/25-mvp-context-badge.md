---
type: feature
status: not started
priority: p1
pillar: M5
depends_on: ["M4.2 (chat markdown renderer)"]
supersedes: []
mvp: true
---

# M5 — Context usage badge

## Goal

A pill in the Chat pane header that shows how much of the current model's context window the session has consumed. Color-coded. Tooltip with raw counts.

## Scope

- Research: identify exact OpenCode SDK field for per-session token usage + active model's context window size. Deliverable: `agent-knowledge/reference/opencode-sdk-usage.md`.
- `<ContextBadge>` primitive in `@tinker/design`: pill shape, percent label, three-color scale.
  - Green (token: `--color-fg-success` or equivalent) when <50%.
  - Amber (brand accent) when 50–80%.
  - Red when >80%.
- Tooltip shows `<used tokens> / <window size>  ·  <model name>`.
- Updates live during streaming — recomputes on each SSE chunk.
- Playground coverage: three states at `?route=design-system`.

## Out of scope

- Per-message token counts. Session-aggregate only in MVP.
- Conversation compaction / auto-summarize at high context. Post-MVP (relates to deferred [[14-session-history-windowing]]).
- Switching models when context is full. Manual via picker in MVP.
- Cost estimation (dollar-value rollups). Post-MVP.

## Acceptance

- Research doc merged with field paths + example payload.
- Badge visible in Chat pane header when a session is active.
- Color changes at 50% and 80% thresholds.
- Tooltip shows accurate counts.
- Updates during streaming without jank.
- Playground shows three color states.

## Atomic tasks

See `agent-knowledge/context/tasks.md` §M5.

## Notes for agents

- Keep the badge primitive pure: props in, no data fetching inside. Data comes from the Chat pane (which already subscribes to SSE) and is passed down.
- If OpenCode SDK does not expose per-session token totals directly, compute from the `messages` array by summing `tokens` on each message. Document whichever path is chosen in the research doc so the component's contract is clear.
- Do not inline color values. Use tokens from `@tinker/design/styles/tokens.css`. If a token for "warning amber" doesn't exist yet, extend tokens.css in a separate PR before this one.
