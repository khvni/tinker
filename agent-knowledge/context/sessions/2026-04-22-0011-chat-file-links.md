---
type: session
date: 2026-04-22
tickets: [TIN-36]
pr: https://github.com/khvni/tinker/pull/75
branch: khvni/tin-36-mvp-chain
---

# Session — Chat file links open inline

Contributor: khvni
Agent: Codex

## Scope
- Ship TIN-36 from [[22-mvp-inline-renderer]].
- Make file-path links in chat open a FilePane tab in the current workspace, not a browser tab.

## Changes
- Added `apps/desktop/src/renderer/file-links.ts` to classify chat links, normalize file URLs, and resolve relative paths against the active session folder.
- Wired `ChatMessage -> Chat -> Workspace` so local file links call the existing workspace pane-open path while safe external links still open in the browser.
- Added `apps/desktop/src/renderer/panes/FilePane/file-mime.ts` so ambiguous files use extension + magic-byte sniffing before pane creation.
- Updated `workspace/file-open.ts` to resolve MIME asynchronously, refresh existing file panes when MIME becomes more specific, and open missing files into a friendly FilePane state.
- Added unit coverage for link classification, MIME sniffing, async pane open/update, and the missing-file fallback UI.

## Decisions Made
- [2026-04-22] Kept file-link opening inside the existing workspace pane flow instead of adding a second file-open path; this reuses de-dupe/focus behavior and keeps M3.10 small.
- [2026-04-22] Put missing-file handling behind a synthetic FilePane MIME (`application/x-tinker-missing-file`) so the UI stays inside the existing pane registry and renderer dispatch model.

## Knowledge Base Updates
- Updated `agent-knowledge/context/tasks.md` row 3.10 to `review` with PR #75.
- Added this session log for TIN-36 continuity.

## Open Questions / Handoff
- MIME sniffing currently covers ambiguous/generic files plus upcoming office/PDF signatures. When M3.3–M3.6 land, extend the same helper instead of re-implementing type detection per renderer.

## Gaps Surfaced
- No dedicated agent-knowledge execution spec exists yet for the MVP inline-renderer chain; only the feature spec is present.
