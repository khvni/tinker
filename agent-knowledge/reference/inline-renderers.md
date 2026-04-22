---
type: reference
tags: [renderer, mvp, M3, libraries, licensing]
---

# Inline Renderer Library Picks (M3.1 / TIN-27)

Canonical library selection for the in-line document renderer (feature M3). Every pick must clear the license gate and minimize bundle cost. Worker-free options are preferred; PDF is the only format where a worker is unavoidable.

## License Gate

Accept: MIT, Apache-2.0, ISC, BSD (2/3-clause), MPL-2.0 as a dual-license option.
Reject: GPL, AGPL, LGPL, SSPL, BUSL, "Community Edition" with source-available-but-not-FOSS terms.

Every pick below has its license link inlined and has been cross-checked against the rejection list.

## Summary Table

| Format | Library | License | gzip (est.) | Worker? | Status |
|--------|---------|---------|-------------|---------|--------|
| PDF | `pdfjs-dist` | [Apache-2.0](https://github.com/mozilla/pdf.js/blob/master/LICENSE) | ~350 KB core + worker | **Yes** (required) | New pick |
| XLSX | `exceljs` | [MIT](https://github.com/exceljs/exceljs/blob/master/LICENSE) | ~220 KB | No | New pick |
| DOCX | `mammoth` | [BSD-2-Clause](https://github.com/mwilliamson/mammoth.js/blob/master/LICENSE) | ~55 KB | No | New pick |
| PPTX | `pptxtojson` + custom slide layout | [MIT](https://github.com/pipipi-pikachu/PPTXtoJSON/blob/master/LICENSE) | ~40 KB | No | **Risky — fallback required** |
| HTML | `DOMPurify` + sandboxed `<iframe srcdoc>` | [MPL-2.0 OR Apache-2.0](https://github.com/cure53/DOMPurify/blob/main/LICENSE) | ~22 KB (already installed) | No | Confirm reuse |
| Code | `highlight.js` (keep) | [BSD-3-Clause](https://github.com/highlightjs/highlight.js/blob/main/LICENSE) | ~25 KB core (per-lang lazy) | No | Keep as-is |
| Markdown | `marked` + `DOMPurify` (keep) | [MIT](https://github.com/markedjs/marked/blob/master/LICENSE.md) / MPL-2.0 | ~28 KB combined | No | Keep as-is |

## Per-format Details

### PDF — `pdfjs-dist`

- **Version pin**: `pdfjs-dist@^4.7.76` (Mozilla LTS, ES2020 build).
- **Install**: `pnpm -F @tinker/desktop add pdfjs-dist`.
- **Worker setup (required)**:
  - Copy `pdfjs-dist/build/pdf.worker.min.mjs` into `apps/desktop/public/` during Vite build.
  - Configure `GlobalWorkerOptions.workerSrc` to the asset URL at renderer boot.
  - Tauri CSP: add `worker-src 'self' blob:` to `tauri.conf.json` `security.csp`.
- **Integration notes**:
  - Render one page at a time into a `<canvas>` sized to container width; virtualize page list to keep memory flat for long PDFs.
  - Expose `getDocument({ disableFontFace: false })` so embedded fonts render; disable `enableXfa` (legacy, bundle cost).
  - Text layer: render via `TextLayer` helper for copy/paste; don't try to reimplement selection.
- **Why not alternatives**:
  - `react-pdf` wraps `pdfjs-dist` but adds 15 KB and a React-only API — no value vs. calling pdfjs directly.
  - `@react-pdf-viewer/core` is MIT but ships a full toolbar UI we'd immediately strip; wasted bytes.

### XLSX — `exceljs`

- **Version pin**: `exceljs@^4.4.0`.
- **Install**: `pnpm -F @tinker/desktop add exceljs`.
- **Integration notes**:
  - Read workbook via `Workbook.xlsx.load(ArrayBuffer)`; iterate `worksheet.eachRow` to build a virtualized table.
  - Render through the existing `CsvRenderer` table primitive (extend it to accept `{ rows, sheets }`); add a sheet-switcher tab strip built from `<SegmentedControl>`.
  - Do not attempt to reproduce Excel formulas — render the cached value (`cell.value`). Formula editing is out of scope for M3.
- **Why not alternatives**:
  - **`xlsx` (SheetJS)**: the npm package has been community-maintained forks of mixed provenance since SheetJS CE moved to CDN-only distribution. The CDN build is Apache-2.0 but the npm registry version is ambiguous; avoid to sidestep the license ambiguity entirely.
  - **`x-data-spreadsheet`**: MIT but bundles a full spreadsheet editor (~400 KB); we want read-only inline preview.
  - **`@tanstack/react-table`** alone: great for rendering but doesn't parse `.xlsx`. ExcelJS + our existing table component is the smaller path.

### DOCX — `mammoth`

- **Version pin**: `mammoth@^1.8.0`.
- **Install**: `pnpm -F @tinker/desktop add mammoth`.
- **Integration notes**:
  - Call `mammoth.convertToHtml({ arrayBuffer })`; feed output through existing `DOMPurify` sanitization before injection.
  - Preserve images via `convertImage: mammoth.images.imgElement(...)` — images embed as base64 data URIs; fine for inline preview sizes.
  - Reject files > 15 MB with a "open externally" CTA; mammoth materializes the full HTML in memory.
- **Why not alternatives**:
  - **`docx-preview`**: Apache-2.0, more faithful Word rendering, but 180 KB gzip and injects its own CSS that collides with our design tokens. Mammoth's plain-HTML output defers styling to our markdown-renderer CSS path, which already respects tokens per D14/D23.

### PPTX — `pptxtojson` (risky, with fallback)

- **Status**: **flagged**. No MIT/Apache library renders PPTX with acceptable fidelity.
- **[2026-04-21] TIN-32 decision**: cut inline PPTX rendering from the MVP. `.pptx` / `.ppt` now route to an explicit "PPTX preview" fallback pane with an `Open externally` CTA.
- **Version pin (primary)**: `pptxtojson@^1.3.0`.
- **Install**: `pnpm -F @tinker/desktop add pptxtojson`.
- **Integration notes**:
  - Parse slide XML into structured JSON; render each slide as a fixed-aspect-ratio `<div>` with absolutely-positioned shapes/text using the parsed geometry.
  - Ship a deliberately-basic slide view — text + images + background fill only. No animations, no slide transitions, no embedded media playback.
  - Reconcile fonts to our token font stack; don't try to match Office fonts exactly.
- **Why TIN-32 shipped fallback instead**:
  1. `pptxtojson` gets us parsed geometry, not a trustworthy renderer. Typical decks still lose grouped-shape layout, font metrics, theme mapping, and mixed media fidelity unless we build a much larger custom layout engine.
  2. A low-fidelity slide carousel would look "supported" while silently misrendering real work. Explicit fallback is more honest and keeps M3 within D25's MVP bar.
  3. The current fallback stays local-first, dependency-light, and reversible. If a better permissive renderer appears later, we can swap the FilePane mapping without touching session state.
- **Shipped MVP fallback**:
  1. Recognize `.pptx` / `.ppt` as presentation MIME types in file-open routing.
  2. Show a dedicated **PPTX preview** pane with a clear "inline preview unavailable" message.
  3. Use Tauri `shell.open` to launch the original file in the user's default presentation app.
- **Why not alternatives**:
  - **`pptxjs`**: MIT but unmaintained (last release 2019) and requires jQuery.
  - **LibreOffice headless conversion**: would work but adds a ~200 MB external binary dependency — violates "local-first, no hidden deps".
  - **Cloud conversion APIs** (Aspose, Google Slides): violates local-first + privacy.

### HTML — DOMPurify + sandboxed iframe

- **Library**: reuse already-installed `DOMPurify@^3.4.0` ([MPL-2.0 OR Apache-2.0](https://github.com/cure53/DOMPurify/blob/main/LICENSE)).
- **Install**: none (already a dep).
- **Integration notes**:
  - Sanitize with `DOMPurify.sanitize(html, { WHOLE_DOCUMENT: true, RETURN_TRUSTED_TYPE: false })`.
  - Inject into `<iframe sandbox="allow-same-origin" srcdoc={...}>` — not directly into the pane DOM. This keeps arbitrary script from touching the host document even if the sanitizer is ever bypassed.
  - No `allow-scripts`, no `allow-top-navigation`. Treat external HTML as untrusted per CLAUDE.md §5.
- **Why not a separate library**: none needed. The existing sanitizer + a 20-line iframe component is the entire implementation.

### Code — `highlight.js` (keep)

- **Currently installed**: `highlight.js@^11.11.1` at `apps/desktop/src/renderer/renderers/code-highlighter.ts`.
- **Verdict**: keep. Works, small footprint, already wired.
- **Integration notes**:
  - `MAX_HIGHLIGHTABLE_CODE_LENGTH` gate is already in place — don't loosen it without measuring paint regression.
  - Lazy-import languages via the existing dynamic-import pattern to avoid shipping every grammar.
- **Considered upgrade — Shiki**:
  - Shiki (MIT) produces VS-Code-grade tokenization with TextMate grammars, but ships grammars + themes as JSON assets (~1 MB total even with selective loading) and needs a WASM oniguruma runtime for non-ESM regex.
  - Verdict: **no upgrade**. Current highlight.js output already goes through our token-based styles; visual delta doesn't justify the bundle cost for M3's "preview, not IDE" scope.

### Markdown — `marked` + `DOMPurify` (keep)

- **Currently installed**: `marked@^18.0.0` + `DOMPurify@^3.4.0` at `apps/desktop/src/renderer/renderers/MarkdownRenderer.tsx`.
- **Verdict**: keep. Small, maintained, GFM via built-in options.
- **Integration notes**:
  - Continue sanitizing marked's output with DOMPurify — never render raw marked output.
  - For GFM tables + task lists, rely on marked's built-in GFM mode; no extension packages needed.
  - Code fences inside markdown reuse the `CodeRenderer` highlighter — keep the existing composition.
- **Considered upgrades**:
  - `react-markdown` + `remark-gfm`: MIT, React-native, ~55 KB combined. Nicer DX but changes the renderer contract from "string → sanitized HTML" to "tree → React nodes". Not worth churning MarkdownRenderer + MarkdownEditor for M3.
  - `micromark`: MIT, smaller (~18 KB) but lower-level. Migration cost > benefit for MVP.

## Worker + CSP Checklist (PDF only)

When M3.3 (file-type routing) lands, add:

1. Vite copy plugin step for `pdf.worker.min.mjs` → `apps/desktop/public/`.
2. `tauri.conf.json` → `app.security.csp`: append `worker-src 'self' blob:` and `script-src 'self' 'wasm-unsafe-eval'` (pdfjs uses `blob:` workers in some paths).
3. Smoke test: open a 50 MB PDF and a single-page PDF; verify no CSP violations in the devtools console.

No other renderer requires a worker.

## Bundle Impact Estimate

Aggregate cost of new renderer deps (gzip, first load):

| Scope | Added gzip |
|-------|------------|
| PDF core (lazy-loaded when `.pdf` opens) | ~350 KB |
| PDF worker (separate file, fetched on demand) | ~380 KB |
| XLSX (`exceljs`, lazy) | ~220 KB |
| DOCX (`mammoth`, lazy) | ~55 KB |
| PPTX (`pptxtojson`, lazy) | ~40 KB |

All four new libs load **lazily via dynamic import** keyed off `file-utils.ts` extension routing (M3.3). They must not count against the initial desktop bundle. The lazy-load contract is a hard rule for the M3.3 implementer.

## Follow-ups Out of Scope Here

- M3.3 — extension → renderer dispatch table.
- M3.4 / M3.5 / M3.6 — per-format pane implementations.
- PPTX full inline rendering is deferred past MVP. TIN-32 ships the explicit external-open fallback above.

## References

- D14 — `@tinker/design` tokens are the only source of UI truth.
- D23 — Dual-theme tokens; renderer styles stay token-driven across light + dark.
- D25 (memory) — M3 In-line renderer is an MVP pillar; no scope expansion upstream.
- Current implementations: `apps/desktop/src/renderer/renderers/CodeRenderer.tsx`, `MarkdownRenderer.tsx`, `HtmlRenderer.tsx`, `CsvRenderer.tsx`, `ImageRenderer.tsx`, `file-utils.ts`.
