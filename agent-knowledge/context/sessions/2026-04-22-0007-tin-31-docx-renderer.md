---
type: session
tags: [session, TIN-31, M3, renderer, docx]
---

# TIN-31 — M3.5 DOCX renderer

## Summary

Shipped DOCX inline preview in `apps/desktop` using lazy-loaded `mammoth`, sanitized HTML output, and token-driven styling for Word content inside `FilePane`.

## What landed

- Added `apps/desktop/src/renderer/renderers/DocxRenderer/` with `DocxRenderer.tsx`, `DocxRenderer.test.ts`, and `index.ts`.
- DOCX renderer reads binary bytes via `@tauri-apps/plugin-fs`, rejects previews above 15 MB, converts with `mammoth.convertToHtml`, sanitizes through `DOMPurify`, and renders in the existing pane shell.
- Inline images use `mammoth.images.dataUri`, so embedded DOCX images render inside the preview without extra asset plumbing.
- `apps/desktop/src/renderer/panes/FilePane/FilePane.tsx` now routes `application/vnd.openxmlformats-officedocument.wordprocessingml.document` through the DOCX renderer.
- `apps/desktop/src/renderer/styles.css` gained `.tinker-docx-body` rules for lists, tables, cells, and images using existing `@tinker/design` tokens only.
- Added `mammoth@^1.12.0` to `apps/desktop/package.json` and synced the version pin in `agent-knowledge/reference/inline-renderers.md`.

## Verification

- `pnpm -r typecheck` — green.
- `pnpm -r test` — green.
- Manual smoke via `mammoth` fixture docs:
  - `simple-list.docx` emitted `<ul>` / `<li>`
  - `tables.docx` emitted `<table>` / `<td>`
  - `tiny-picture.docx` emitted inline `data:image/png;base64,...` image HTML

## Review notes

- Kept scope tight to D25: no editing, no comment/annotation UI, no extra file-routing abstraction.
- Deleted temptation to add a second HTML render path; DOCX reuses the same sanitized rich-text surface already used by markdown/HTML previews.
- Added an external-open escape hatch only for conversion/size failures, not as a second primary flow.

## Linked

- PR: https://github.com/khvni/tinker/pull/72
- Linear: https://linear.app/tinker/issue/TIN-31
- Feature: [[22-mvp-inline-renderer]]
- Tasks: [[context/tasks]] row 3.5 → `review`
