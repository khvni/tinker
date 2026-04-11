# W9 · Workspace polish — persistent layout, file auto-open, inline renderers (Wave 2)

You are bringing Glass's workspace up to product quality. This is the UI piece the article is most vocal about: split panes, drag tabs, persistent layout, auto-open on file writes, inline rendering for every content type.

**Wait for Wave 1 to merge** — specifically `@ramp-glass/agent-runtime` (for the file-write tool-call events) and `@ramp-glass/memory` (for layout persistence storage).

## Context
- `ramp-glass-prd.md` §2.8 (workspace UI), §3.4 (b) message flow for auto-open.
- `AGENTS.md` §7 workspace UI invariants (these are product requirements, not preferences).

## Exclusive write scope
- `apps/desktop/src/renderer/workspace/**` (excluding `Workspace.tsx` — you may edit it, but preserve the pane-registry pattern)
- `apps/desktop/src/renderer/renderers/**` (new directory for inline content renderers)
- `apps/desktop/src/main/layout-store.ts` (new file)

## What to build
1. Persistent layout: serialize the FlexLayout model to SQLite (via `@ramp-glass/memory`'s store or a dedicated `layouts` table) on every change. Restore on launch. Next-day launch must be byte-for-byte identical.
2. File auto-open: subscribe to the agent runtime's tool-use event stream. When a tool call of kind `write_file` or `edit_file` completes, create a new tab in the active tab group using the appropriate renderer for the file's extension.
3. Inline renderers (one per pane kind):
   - `markdown` → `react-markdown` with syntax-highlighted code blocks
   - `html` → sanitized via `DOMPurify`, rendered in a sandboxed iframe
   - `csv` → parsed with `papaparse` and rendered as a scrollable virtualized table
   - `image` → standard `<img>` with object-fit
   - `code` → Monaco in read-only mode with syntax detection
4. Drag-to-rearrange and split horizontal/vertical must work. FlexLayout supports both; verify and fix if broken.
5. Keyboard shortcuts: `cmd+\` split vertical, `cmd+shift+\` split horizontal, `cmd+w` close tab, `cmd+shift+]` next tab.

## Dependencies (merged Wave 1)
- `@ramp-glass/agent-runtime` (tool-call events)
- `@ramp-glass/memory` (layout persistence)
- `@ramp-glass/shared-types`
- Adds: `react-markdown`, `dompurify`, `papaparse`, `monaco-editor`, `@monaco-editor/react`

## Tests (Playwright against Electron)
- Launch app, create a split vertical, drag a tab between groups → assert model.
- Close the app mid-state; relaunch → assert identical layout.
- Issue a fake `write_file` tool call → assert a new tab opens in the active group with the correct renderer.
- Render a fixture markdown, HTML, CSV, image, and code file → assert visible content for each.

## Acceptance
- [ ] Playwright E2E passes.
- [ ] The article's claim *"When you come back tomorrow, your workspace is exactly how you left it"* is demonstrably true.
- [ ] Files created by the agent appear automatically as tabs.
- [ ] No modal dialogs block any core flow.

## What you must NOT do
- Do not introduce a different layout library. FlexLayout stays.
- Do not render HTML without DOMPurify.
- Do not gate any renderer behind a setting — everyone gets all renderers.
- Do not edit `packages/shared-types`.

## When done
`feat(workspace): persistent layout, file auto-open, inline renderers`. PR to `main`.
