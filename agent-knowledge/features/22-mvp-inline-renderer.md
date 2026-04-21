---
type: feature
status: not started
priority: p0
pillar: M3
depends_on: ["M1.4 (FilePane registered)"]
supersedes: []
mvp: true
---

# M3 — In-line document renderer

## Goal

Users can open any common document type (PDF, XLSX, DOCX, PPTX, HTML, code, markdown) in a pane tab without leaving Tinker. A file-path link in a chat response → click → opens inline.

## Scope

- Single `FilePane` component that accepts `{ path, mime }` and dispatches to the correct renderer via a `mimeToRenderer` map.
- MVP-supported formats:
  - **PDF** — library TBD in M3.1 research (likely `react-pdf`).
  - **XLSX** — library TBD (likely SheetJS). First sheet default + sheet switcher.
  - **DOCX** — library TBD (likely `mammoth`). Read-only.
  - **PPTX** — library TBD. Slide carousel. Cuttable if research flags as risky.
  - **HTML** — sandboxed iframe.
  - **Code** — existing `CodeRenderer.tsx` via `code-highlighter`.
  - **Markdown** — existing `MarkdownRenderer.tsx` with GFM.
- Unsupported MIME → fallback with `<Button>Open in default app</Button>` calling Tauri `shell.open`.
- File links in chat → click → opens new FilePane tab.

## Out of scope

- Editing. MVP is read-only for all formats (the existing `MarkdownEditor.tsx` is deferred / kept behind a feature flag).
- Annotation, highlighting, form filling.
- Collaborative rendering.
- Non-document formats (video, audio, 3D). Post-MVP.

## Acceptance

- Library research doc merged (`agent-knowledge/reference/inline-renderers.md`) with licenses + bundle sizes documented.
- All seven MVP formats render correctly on at least one representative test file.
- Unsupported MIME falls back gracefully with working "open externally" button.
- Clicking a file link in a chat response opens the correct FilePane with the right renderer.
- Renderer dispatch is O(1) — `mimeToRenderer[mime]` lookup, no cascading if-chains.

## Atomic tasks

See `agent-knowledge/context/tasks.md` §M3.

## Notes for agents

- **License gate is hard**: MVP uses MIT / Apache-2.0 / ISC / BSD only. GPL/AGPL/LGPL/custom = reject, even if free. This is a consumer-OSS app (D1) and copyleft licenses pollute fork-ability.
- Bundle size matters. If a PDF lib costs 2MB gzip, consider lazy-loading the FilePane's renderer modules (React.lazy per format).
- Prefer libs that don't require a Web Worker — Tauri's webview can do workers but it's one more thing to debug. If a lib needs a worker, document the setup in the research doc.
- Sandboxed HTML: `sandbox="allow-same-origin"` only. No `allow-scripts`. No `allow-forms`. If the HTML needs JS to render meaningfully, log a console warning and render a message asking the user to open externally.
