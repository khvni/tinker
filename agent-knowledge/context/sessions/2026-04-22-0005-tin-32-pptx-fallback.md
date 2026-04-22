---
date: 2026-04-22
time: 00:05 America/Los_Angeles
ticket: TIN-32
branch: khvni/tin-32
pillar: M3
pr: 71
---

# TIN-32 — PPTX explicit fallback

Contributor: khvni
Agent: Codex

## Scope

- Deliver `TIN-32` from [[22-mvp-inline-renderer]].
- Resolve the M3.6 PPTX slice by choosing between a real inline renderer and the allowed cut path from the M3.1 research.

## Changes

- Added `ExternalPreviewPane` under `apps/desktop/src/renderer/panes/FilePane/components/` so `FilePane` can reuse one explicit external-open UI for unsupported files and PPTX fallback.
- Updated `FilePane` MIME dispatch to route `.pptx` / `.ppt` presentation MIME types to a dedicated `PPTX preview` fallback instead of silently treating them as plain text.
- Updated `workspace/file-open.ts` so opening `/path/to/file.pptx` produces `application/vnd.openxmlformats-officedocument.presentationml.presentation`.
- Added tests covering PPTX MIME routing and the PPTX fallback UI copy.
- Updated `agent-knowledge/reference/inline-renderers.md` with the final M3.6 decision and rationale.
- Updated `agent-knowledge/context/tasks.md` row 3.6 to `review` with PR #71.

## Decisions Made

- [2026-04-22] Shipped the cut path for PPTX instead of a low-fidelity inline slide renderer. `pptxtojson` still looks useful for future exploration, but for MVP it would require a much larger custom layout engine to avoid misleading users with broken decks.
- [2026-04-22] Kept the fallback dependency-free. No new PPTX package was added because explicit external-open behavior satisfies TIN-32 without pulling in a risky renderer path.

## Knowledge Base Updates

- `agent-knowledge/reference/inline-renderers.md` now records the shipped M3.6 decision instead of leaving PPTX fallback as an unresolved future branch.
- `agent-knowledge/context/tasks.md` marks M3.6 as `review` with PR #71.

## Open Questions / Handoff

- If PPTX inline rendering is reopened post-MVP, start from the `pptxtojson` geometry parser but budget for a full fidelity audit on grouped shapes, theme fonts, and media before wiring it into `FilePane`.
- `.ppt` now shares the same fallback MIME path even though TIN-32 only called out `.pptx`; this is intentionally conservative and can stay unless a future task asks for legacy PowerPoint support explicitly.

## Gaps Surfaced

- M3's task table still describes the pre-cut PPTX carousel. The canonical rationale now lives in `agent-knowledge/reference/inline-renderers.md`; if more renderer slices get cut, the feature spec may need an explicit "shipped cuts" subsection.
