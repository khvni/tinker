---
type: concept
tags: [tinker, feature, design-system, ui, tokens]
status: shipped
priority: p0
---

# Feature 09 — Design System (`@tinker/design`)

Single source of truth for Tinker's UI primitives. Every app surface uses it. No one reinvents a button, badge, or token.

## Goal

When any contributor writes UI in Tinker, they reach for `@tinker/design` first. Tokens (colors, spacing, typography, motion) come from `styles/tokens.css`. Primitives (Button, Badge, StatusDot, etc.) come from the package. Ad-hoc CSS palettes, bespoke button CSS, inline hex values, and one-off font stacks are not allowed.

## What Ships in `packages/design`

### Tokens (`@tinker/design/styles/tokens.css`)

Warm near-black dark theme. Amber accent. Host Grotesk Variable body, system mono for code.

- `--color-bg-*` — canvas, elevated, panel, input, hover
- `--color-border-*` — subtle / default / strong
- `--color-text-*` — primary, secondary, muted, inverse
- `--color-accent*` — accent, strong, soft, ring, ink
- `--color-success|error|warning|info|skill|claude` + matching `-soft` tints
- `--space-0…12` (4px base)
- `--radius-xs|sm|md|lg|pill`
- `--font-sans` (Host Grotesk) / `--font-mono`
- `--font-size-xs…xxl`, `--font-weight-*`, `--line-height-*`, `--letter-spacing-label`
- `--duration-fast|base|slow`, `--ease-standard|emphasized`

Typescript exports under `@tinker/design/tokens` mirror the CSS variables for runtime consumers.

### Components (`@tinker/design`)

- `Button` (primary / secondary / ghost / danger · sizes s, m · leading/trailing icon slots)
- `IconButton` (primary / secondary / ghost / danger · sizes s, m, l)
- `Badge` (default / success / error / warning / info / accent / skill / ghost · sizes small, medium · optional icon)
- `ClickableBadge` (same variants, button semantics)
- `StatusDot` (muted / constructive / warning / danger / info / claude / skill / pulse)
- `SegmentedControl<T>` (typed options, `label` for a11y)
- `Toggle` (switch role, boolean checked)
- `TextInput` (standard text field)
- `Textarea` (multi-line text field, optional resize mode)
- `SearchInput` (text field with search affordance)

These are the canonical primitives. Anything new that looks like one of these MUST extend or compose the design component, not recreate it.

## Rules for Contributors

- `[2026-04-19]` **Import tokens once** — `apps/desktop/src/renderer/styles.css` imports `@tinker/design/styles/tokens.css` at the top. Do not redefine `--color-*`, `--space-*`, `--radius-*`, `--font-*` anywhere else. Ever.
- `[2026-04-19]` **Use the components** — any button-shaped interactive element uses `<Button>` or `<IconButton>`. Any status chip uses `<Badge>`. Any tab strip uses `<SegmentedControl>`. Any on/off switch uses `<Toggle>`. Single-line text fields use `<TextInput>` / `<SearchInput>`. Multi-line fields use `<Textarea>`. Any state pill with a colored dot uses `<StatusDot>`.
- `[2026-04-20]` **Textarea rule closed** — Chat composer, Scheduler prompt, Dojo skill body, and `MarkdownEditor` now consume `<Textarea>`. New raw `<textarea>` elements in renderer code are regressions unless extending `@tinker/design` itself.
- `[2026-04-19]` **No inline hex or rgba** in renderer code or CSS. Reference the token CSS variables. If a token doesn't exist for the case, add it to the design system in a separate PR — don't inline it.
- `[2026-04-19]` **No per-app palette shadow** — the old `--tinker-*` palette is gone. If a legacy class still needs styling, rebind it to `--color-*` tokens; do not reintroduce cold cyan or gradient backgrounds.
- `[2026-04-19]` **Structural classes stay** (`.tinker-pane`, `.tinker-list-item`, `.tinker-vault-entry`, etc.) because they encode layout, not palette. Their color/spacing/radius values must come from tokens only.
- `[2026-04-19]` **Playground is canonical** — `apps/desktop/src/renderer/routes/design-system.tsx` is the reference render of every primitive + token. If a change to the design system breaks the playground, it breaks the app. Update the playground alongside any primitive change.

## Forbidden

- `[2026-04-19]` `className="tinker-button*"` in new code — the old button classes were removed. Use `<Button>`.
- `[2026-04-19]` `className="tinker-pill"` as the primary status chip pattern — use `<Badge>`. (The `.tinker-pill` class still exists in `styles.css` for rare layout-only pill shells; prefer `<Badge>` in new code.)
- `[2026-04-19]` `<input className="tinker-input">` — use `<TextInput>` or `<SearchInput>`.
- `[2026-04-20]` Raw `<textarea>` in app UI — use `<Textarea>`.
- `[2026-04-19]` `.tinker-dojo-tab` + `.tinker-dojo-tab--active` hand-rolled tabs — use `<SegmentedControl>`.
- `[2026-04-19]` Custom `<input type="checkbox">` with a toggle-like label — use `<Toggle>`.
- `[2026-04-19]` Alt font stacks (`Space Grotesk`, `Inter`, `Avenir Next`, etc.) — the app uses `--font-sans` (Host Grotesk) only.
- `[2026-04-19]` Radial cyan / gradient hero backgrounds, drop shadows with heavy alpha, blur glass cards — replaced by flat warm surfaces with subtle borders.

## Out of Scope (for now)

- `[2026-04-19]` Light mode — dark-only until a real multi-theme story exists; tokens deliberately dark-tuned.
- `[2026-04-19]` Animation primitives (e.g., `<Reveal>`, `<Presence>`) — use CSS transitions with `--duration-*` + `--ease-*` tokens.
- `[2026-04-19]` Layout primitives (`<Stack>`, `<Cluster>`) — plain CSS `display: grid/flex` with `--space-*` tokens is enough for now.
- `[2026-04-19]` Typography primitives (`<Heading>`, `<Text>`) — semantic HTML + `--font-*` tokens. Reconsider only if we ship responsive typography.

## Acceptance Criteria

- [x] `packages/design` exports tokens + 10 primitives, with per-component CSS colocated
- [x] `apps/desktop/src/renderer/styles.css` imports `@tinker/design/styles/tokens.css` and references tokens only (no `--tinker-*` shadow palette)
- [x] Every pane (`Chat`, `Settings`, `Today`, `FirstRun`, `VaultBrowser`, `Dojo`, `SchedulerPane`) uses `<Button>`, `<Badge>`, `<TextInput>`, `<Textarea>`, `<Toggle>`, `<SegmentedControl>` where applicable
- [x] Multi-line editor surfaces (`Chat` composer, `SchedulerPane` prompt, `Dojo` skill body, `MarkdownEditor`) use `<Textarea>` rather than raw `<textarea>`
- [x] Renderers (`MarkdownRenderer`, `MarkdownEditor`, `CsvRenderer`, `CodeRenderer`) use `<Badge>` for status pills and `<Button>` for actions
- [x] `Workspace.tsx` header uses `<Button>` + `<Badge>` — no raw `tinker-button*` / `tinker-pill` spans in new code
- [x] `Dojo` tab strip uses `<SegmentedControl>`; skill active switch uses `<Toggle>`
- [x] Typecheck green across workspace: `pnpm --filter @tinker/desktop typecheck`
- [x] Design playground (`?route=design-system`) still renders every primitive against the live token set

## Connections
- [[07-workspace-persistence]] — dockview theme overrides live inside design tokens, not in isolation
- [[02-dojo-skill-marketplace]] — Dojo pane was the biggest consumer of hand-rolled tabs + inputs, now on design primitives
- [[vision]] — "complexity invisible, not absent" — design system lets every feature ship polish without reinventing the surface
