---
type: feature
status: not started
priority: p0
pillar: M4
depends_on: ["M1.3 (Chat pane registered)"]
supersedes: []
mvp: true
---

# M4a — Chat markdown rendering + composer

## Goal

OpenCode streams responses as SSE. Chat pane renders them as native markdown with code highlighting, collapsed tool calls, collapsed reasoning, and a responsive composer that matches OpenCode Desktop's behavior.

Two asterisks around a word → bold. `#` → heading. Fenced code → syntax-highlighted block with copy button. That is the product.

## Scope

- `react-markdown` + `remark-gfm` + code highlighting via existing `code-highlighter.ts` (shiki or prism, whichever is already bundled).
- Supported markdown: headings (h1–h6), bold, italic, inline code, fenced code with language hint, unordered/ordered lists, tables, blockquotes, links, images, task lists.
- Streaming: SSE chunks → incremental parse → rAF-debounced render. No full re-parse per chunk.
- Tool-call blocks: parsed from OpenCode event stream, rendered as collapsed `▸ used <tool-name>` disclosures. Hidden by default. `⌥T` toggles all.
- Thinking/reasoning blocks: same disclosure pattern.
- Composer: multi-line `<Textarea>` (from `@tinker/design`). Enter submits. Shift+Enter newline. Escape calls `session.abort()`. Disabled during stream. Stop button replaces send while streaming.
- Auto-scroll: stick to bottom during stream unless user scrolled up. `[New messages]` pill when scrolled-up + new content arrives.
- Copy-message button per assistant message (hover-reveal).

## Out of scope

- MathJax / KaTeX / LaTeX rendering. Post-MVP.
- Mermaid diagrams. Post-MVP.
- Inline image paste. Post-MVP.
- Voice input. Post-MVP.
- Multi-message selection / export. Post-MVP.
- Message editing / re-run.

## Acceptance

- Every markdown feature listed above renders correctly against a canonical test message.
- Streaming a 500-line response stays at 60fps (no render thrash).
- Tool calls + thinking default-collapsed. `⌥T` toggles.
- Enter submits; Shift+Enter newlines; Escape aborts.
- Stop button works mid-stream; resumes input after.
- Auto-scroll behavior matches spec (stick unless user scrolls up; pill on new content).
- No raw `**` or `#` visible in any assistant message.

## Atomic tasks

See `agent-knowledge/context/tasks.md` §M4 (rows 4.2–4.6, 4.11–4.15).

## Notes for agents

- Reuse `code-highlighter.ts`. Do not introduce a second highlighter.
- The rAF-debounced render trick: append raw text to a `useRef` buffer; schedule a `requestAnimationFrame` that reads the buffer + setState. Cancel pending rAF on new chunks.
- Tool-call parsing: consume OpenCode SSE events for `tool.use.start`, `tool.use.delta`, `tool.use.end`. Group by tool-use ID. Render one disclosure per group.
- Thinking/reasoning: OpenCode emits `message.thinking.delta` (verify field name in M5.1 research). Same grouping logic.
- Composer: do not reinvent `<Textarea>`. The primitive is already in `@tinker/design` and handles auto-resize.
