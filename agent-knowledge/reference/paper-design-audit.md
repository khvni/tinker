---
type: reference
tags: [design-system, tokens, paper, audit, d14, d15, d23, mvp]
status: current
paper_source: 'Tinker Workspace (paper-desktop), 7 artboards'
paper_artboards:
  - '1-0 Tinker Workspace v1 (dark)'
  - '6M-0 Tinker Tokens — v1 (dark)'
  - '9I-0 Tinker Workspace — Light'
  - '9J-0 Tinker Tokens — Light'
  - 'IQ-0 Tinker — Memory view'
  - 'OK-0 Tinker — Memory refresh'
  - 'IR-0 Tinker — Agents view'
in_code_sources:
  - 'packages/design/src/styles/tokens.css'
  - 'packages/design/src/components/*.css'
last_verified: '2026-04-22'
linear: TIN-176
---

# Paper design source audit — `tokens.css` + primitive parity

> TIN-176. Source-of-truth audit: the Paper file `Tinker Workspace` vs the shipped design-system in `packages/design/`. Every drift this report names is a drift the downstream UI cleanup chain is meant to close. Dark tokens match; light tokens have a coherent surface-layer drift; several primitives exist only as ad-hoc compositions in Paper and need either new primitives or explicit variant coverage.

## TL;DR

- **Dark theme tokens (6M-0) match `[data-theme="dark"]` 1:1** on every swatch Paper shows (bg / accent / semantic). No drift detected.
- **Light theme surface tokens (9J-0) drift from `:root` on bg-primary, bg-elevated, bg-panel, bg-hover.** In-code comment says "cool neutral canvas … D23 layer reversal" but Paper shows warm cream on the canvas and white on elevated — the opposite. This also contradicts D23 as written ("warm cream (`#fbf8f2`) ground, white elevated surfaces").
- **Spacing + radius + font-size scales match Paper exactly.** Paper doesn't exercise `space-5` (20) / `space-10` (40) but that's coverage, not drift.
- **Typography weight**: Paper light renders the display line at Host Grotesk **700 / 28**; Paper dark renders it at **600 / 28**. `tokens.css` has both weights but no `--font-weight-display` token to let a primitive opt into the theme-dependent heavier display.
- **Primitives in code cover Paper's use-cases about 70%**. Gaps: workspace-grade Tab strip, chat Composer, rail-style 36×36 accent-soft IconButton, split-pill (folder+chevron), tag/chip input, Select.
- **ContextBadge diverges semantically**: Paper uses a neutral chip + separate streaming dot; in-code encodes state in the chip fill.

## 1. Method

1. Paper MCP opened the file and enumerated artboards via `get_basic_info`.
2. `get_screenshot` captured 6M-0 + 9J-0 for token swatches and 1-0 / 9I-0 / IQ-0 / IR-0 for primitive context.
3. `get_tree_summary` mapped every primitive-bearing subtree (StatusDock, LeftRail, LeftTabBar, ReplyComposer, RailItems).
4. `get_computed_styles` pulled exact fill / border / radius / padding / shape on 13 key nodes (composer, action pills, tabs, rail, streaming dot, kebab).
5. `get_font_family_info` confirmed Host Grotesk + JetBrains Mono weights available.
6. `tokens.css` + every primitive CSS file in `packages/design/src/components/` was read top-to-bottom and compared against the Paper values.

References:
- `packages/design/src/styles/tokens.css`
- `packages/design/src/components/`
- [[decisions]] — D14 (single source of UI truth), D15 (dark warm palette), D21 (folder per component), D23 (dual-theme, light default)
- Memory note: "Paper MCP design port workflow validated 2026-04-20 on Ramp Glass workspace port"

## 2. Tokens

### 2.1 Color — Dark theme (Paper 6M-0 vs `tokens.css [data-theme="dark"]`)

| Token | In-code | Paper 6M-0 | Verdict |
|---|---|---|---|
| `--color-bg-primary` | `#1a1612` | `#1a1612` | ✓ match |
| `--color-bg-elevated` | `#221d17` | `#221d17` | ✓ match |
| `--color-bg-panel` | `#16120e` | `#16120e` | ✓ match |
| `--color-bg-input` | `#120f0c` | `#120f0c` | ✓ match |
| `--color-bg-hover` | `#25201a` | — (not swatched) | ✓ consistent — one step lighter than primary |
| `--color-accent` | `#f9c041` | `#f9c041` | ✓ match |
| `--color-accent-strong` | `#e5ad2d` | `#e5ad2d` | ✓ match |
| `--color-accent-soft` | `rgba(249,192,65,0.18)` | `rgba(249,192,65,0.18)` | ✓ match |
| `--color-success` | `#4ade80` | `#4ade80` | ✓ match |
| `--color-error` | `#ef4444` | `#ef4444` | ✓ match |
| `--color-skill` | `#a78bfa` | `#a78bfa` | ✓ match |
| `--color-warning` | `#f59e0b` | — (not swatched) | ✓ in-code only |
| `--color-info` | `#60a5fa` | — (not swatched) | ✓ in-code only |
| `--color-claude` | `#f2c94c` | — (not swatched) | ✓ in-code only |

**Verdict — Dark:** zero drift. `[data-theme="dark"]` is a faithful implementation of 6M-0.

### 2.2 Color — Light theme (Paper 9J-0 vs `tokens.css :root`) — HIGH-impact drift

| Token | In-code | Paper 9J-0 | Verdict |
|---|---|---|---|
| `--color-bg-primary` | `#f4f3f2` (cool warm-grey) | `#fefcf8` (warm cream) | **DRIFT — HIGH** |
| `--color-bg-elevated` | `#fefcf8` (warm cream) | `#ffffff` (pure white) | **DRIFT — HIGH** |
| `--color-bg-panel` | `#ebe9e6` (cool warm-grey) | `#f9f5ec` (warm cream) | **DRIFT — HIGH** |
| `--color-bg-input` | `#fefcf8` | — (not swatched) | **DRIFT — MEDIUM** — by Paper's pattern, input should sit on elevated = `#ffffff`, or hold the cream from `bg-primary`. Current in-code value matches Paper's `bg-primary` swatch, not anything in 9J-0's input role. |
| `--color-bg-hover` | `#ecebe9` (cool warm-grey) | `#f4efe4` (warm cream) | **DRIFT — HIGH** |
| `--color-accent` | `#f9c041` | `#f9c041` | ✓ match |
| `--color-accent-strong` | `#e5ad2d` | `#e5ad2d` | ✓ match |
| `--color-accent-soft` | `rgba(249,192,65,0.22)` | amber 0.22 | ✓ match |
| `--color-success` | `#22a355` | `#22a355` | ✓ match |
| `--color-error` | `#d33030` | `#d33030` | ✓ match |
| `--color-skill` | `#7255d9` | `#7255d9` | ✓ match |
| `--color-warning` | `#d48806` | — (not swatched) | ✓ in-code only |
| `--color-info` | `#2d6ecb` | — (not swatched) | ✓ in-code only |
| `--color-text-primary` | `#1a1612` | ink (D23 spec + rendering) | ✓ match (inferred from rendered screenshots) |
| `--color-text-secondary` | `#5f564c` | — (rendered, not swatched) | ✓ acceptable |
| `--color-text-muted` | `#a8a097` | — (rendered, not swatched) | ✓ acceptable |
| `--color-text-inverse` | `#fbf8f2` | — | ✓ used for amber-ink pairings |

**Root cause.** `tokens.css:19` carries a comment reading "bg — cool neutral canvas, warm cream on elevated surfaces (D23 layer reversal)". That comment describes a deliberate swap made sometime between D23 (2026-04-20) landing and today — but:

- D23 as-written says "warm cream (`#fbf8f2`) ground, white elevated surfaces". That is *not* a layer reversal — it's cream on primary, white on elevated. Paper 9J-0 matches D23 as written.
- The current `:root` inverts D23 — cool grey on primary, cream on elevated — and then loses the white-elevated surface entirely.

Either D23 needs an amendment entry (explicitly calling out the reversal) or `:root` needs to be brought back in line with D23 + Paper. Paper 9J-0 is the screenshot'd source of truth and matches D23 word-for-word, so the audit recommends pulling `:root` back to Paper.

**Visual impact.** HIGH. On a 1440 px workspace with 555 px of right-pane preview on `bg-elevated`, the current in-code light theme reads *cool workstation grey* when Paper's brief is *bookish editorial cream*. This is the load-bearing light-theme drift the downstream cleanup chain will feel first.

### 2.3 Spacing (4px base)

| Token | In-code | Paper (6M-0 / 9J-0) | Verdict |
|---|---|---|---|
| `--space-0` | `0` | — | ✓ |
| `--space-1` | `4px` | 1·4 | ✓ match |
| `--space-2` | `8px` | 2·8 | ✓ match |
| `--space-3` | `12px` | 3·12 | ✓ match |
| `--space-4` | `16px` | 4·16 | ✓ match |
| `--space-5` | `20px` | — (not exercised) | ✓ in-code extra |
| `--space-6` | `24px` | 6·24 | ✓ match |
| `--space-8` | `32px` | 8·32 | ✓ match |
| `--space-10` | `40px` | — (not exercised) | ✓ in-code extra |
| `--space-12` | `48px` | 12·48 | ✓ match |

**Verdict:** zero drift. In-code has two extras (5 / 10) that Paper doesn't demo but also doesn't contradict.

### 2.4 Radius

| Token | In-code | Paper | Verdict |
|---|---|---|---|
| `--radius-xs` | `4px` | xs · 4 | ✓ match |
| `--radius-sm` | `6px` | sm · 6 | ✓ match |
| `--radius-md` | `8px` | md · 8 | ✓ match |
| `--radius-lg` | `12px` | lg · 12 | ✓ match |
| `--radius-pill` | `9999px` | pill | ✓ match |

**Verdict:** zero drift.

### 2.5 Typography

| Token | In-code | Paper | Verdict |
|---|---|---|---|
| `--font-sans` | `"Host Grotesk Variable", …` | Host Grotesk | ✓ match |
| `--font-mono` | `ui-monospace, "SF Mono", "JetBrains Mono", …` | JetBrains Mono | ✓ match (Paper uses JetBrains Mono as the canonical mono) |
| `--font-size-xs` | `11px` | 11 label | ✓ match |
| `--font-size-sm` | `12px` | 12 mono | ✓ match |
| `--font-size-base` | `13px` | 13 secondary | ✓ match |
| `--font-size-md` | `14px` | 14 body | ✓ match |
| `--font-size-lg` | `16px` | 16 h3 | ✓ match |
| `--font-size-xl` | `20px` | 20 h2 | ✓ match |
| `--font-size-xxl` | `28px` | 28 display | ✓ match |
| `--font-weight-regular` | `400` | 400 body | ✓ match |
| `--font-weight-medium` | `500` | 500 h3 | ✓ match |
| `--font-weight-semibold` | `600` | 600 h1 dark / 600 h2 | ✓ match |
| `--font-weight-bold` | `700` | **700 h1 light** | partial — token exists, no primitive currently uses it |
| `--line-height-tight` | `1.2` | — | ✓ |
| `--line-height-normal` | `1.45` | 1.45 body (per 9J-0 copy) | ✓ match |
| `--line-height-relaxed` | `1.6` | — | ✓ |
| `--letter-spacing-label` | `0.08em` | 0.08em uppercase label | ✓ match |

**Drift — MEDIUM.** Paper's **display line shifts from 600 (dark) to 700 (light)**. Tokens.css has no `--font-weight-display` hook, so primitives that render at `xxl` will need hand-coded `font-weight: 700` in a light-mode block — which D14 forbids.

**Recommendation.** Add:

```css
:root  { --font-weight-display: var(--font-weight-bold); }      /* 700 */
[data-theme="dark"] { --font-weight-display: var(--font-weight-semibold); }  /* 600 */
```

…and route display-sized headings through `--font-weight-display`.

### 2.6 Motion

| Token | In-code | Paper | Verdict |
|---|---|---|---|
| `--duration-fast` / `-base` / `-slow` | 120 / 160 / 240 ms | — (Paper is static) | ✓ no drift detectable |
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | — | ✓ |
| `--ease-emphasized` | `cubic-bezier(0.3, 0, 0, 1)` | — | ✓ |

Paper is a static canvas; motion tokens can't drift against it. Keep as is.

### 2.7 Theme-local primitives

| Token | Scope | Verdict |
|---|---|---|
| `--color-toggle-knob` / `-track-off` / `-track-border` | both themes | ✓ defined both themes; Paper doesn't show a Toggle in the workspace artboards. Drift can only be verified if a Toggle appears in future Paper work. |
| `--shadow-toggle-knob`, `--shadow-sm` | both themes | ✓ |
| `--color-scrim` | both themes | ✓ Paper doesn't show a modal scrim; token values are plausible. |

## 3. Primitives (`packages/design/src/components/*`)

Status key — **matches**: Paper uses this pattern and in-code renders it faithfully. **drifts**: in-code has the primitive but Paper's instance has a different anatomy (noted per row). **missing**: Paper uses a pattern and no in-code primitive covers it.

### 3.1 Per-primitive review

| Primitive | Paper reference | In-code CSS | Verdict | Notes |
|---|---|---|---|---|
| `Button` | `AutoAcceptPill` (4F-0) — pill 122×**28**, padding 5/8/5/9, gap 6, bg `#221D17` (bg-elevated), border subtle; amber-filled primary in light | `Button.css` — `size-m` 26px tall, padding `0 10px`, radius-pill, bg `--color-bg-input` (`#120f0c` dark) | **drifts — LOW** | (a) 2 px height diff (26 vs 28). (b) Secondary variant bg points at `--color-bg-input`, Paper points at `--color-bg-elevated`. Pill shape + amber-primary match. |
| `IconButton` | `AttachBtn` (47-0) 26×26 radius-6, border-subtle, transparent fill · `SendBtn` (4B-0) 26×26 radius-6, bg `#FFF0DC0F`, no border · `KebabBtn` (3Y-0) 24×24 radius-6 | `IconButton.css` — `size-s` 24×24, `size-m` 26×26, `size-l` 32×32, radius-sm (6) | **matches** for size-s + size-m | In-code covers the composer + kebab instances. Ghost, secondary, primary variants line up. |
| `IconButton` (rail scale) | `RailItem-Workspaces-Active` (J-0) 36×36 radius-8, bg `#F9C0412E` (≈accent-soft) · inactive rail items transparent | — none at 36×36 / radius-md | **drifts — MEDIUM** | In-code tops out at `size-l` 32×32 radius-sm. The rail needs 36×36 at radius-md with an `active` variant filled at `--color-accent-soft`. Either grow IconButton with a `size-xl` + `variant='rail'` or add a dedicated `RailItem` primitive. |
| `Badge` | Default is a **pill** (`ContextPill` 3P-0 → 118×28, radius-pill, bg bg-panel, border subtle) | `Badge.css` — radius-**md** (8), heights 24 / 32, default fill bg-input | **drifts — HIGH** | (a) Shape: Paper is pill, in-code is rounded rectangle. (b) Default fill: Paper uses bg-panel, in-code uses bg-input. (c) Height: Paper's chip reads at 28 px, in-code small is 24 and medium is 32 — neither hits the workspace sweet spot. |
| `ClickableBadge` | Same as Badge (button variant layer); no Paper-specific sample | `ClickableBadge.css` extends `Badge` with hover + focus rings, radius-pill override | **drifts — HIGH (inherits Badge)** | When Badge is realigned to pill-by-default, this hover skin stays valid; keep focus-ring contract. |
| `ContextBadge` | `ContextPill` (3P-0) + `StreamingDot` (3X-0) — neutral chip bg-panel carrying "Context · 4%" label with a 3 px separator and a SEPARATE 9×9 pulsing success dot | `ContextBadge.css` — 22 px pill, color-encoded state (`--ok` success-soft/success, `--warn` accent-soft/accent-strong, `--hot` error-soft/error) | **drifts — HIGH (semantics)** | Paper decouples label vs state: chip stays neutral; the sibling `StreamingDot` signals liveness with a halo. In-code couples label + state into the chip fill. Two resolution paths: (i) keep color-encoded ContextBadge + stop using it in the composer strip (use `Badge default` + `StatusDot pulse`), or (ii) rework ContextBadge to render neutral chip + optional inline dot. Pick before M5.3 wires the badge into the Chat pane header. |
| `ModelPicker` | `ModelPill` (4L-0) — pill 159×**28**, bg `#221D17` (bg-elevated), border subtle, padding 5/8/5/9, gap 6, provider icon + **provider label + separator + model label** + chevron | `ModelPicker/ModelPicker.css` — trigger transparent by default, bg-hover only on hover, height 26, single label | **drifts — MEDIUM** | (a) Persistent bg-elevated fill in Paper vs hover-only in-code. (b) Paper shows dual-label (provider · model) at the trigger; in-code shows one label. (c) 26 vs 28 height. Parity with OpenCode Desktop was the in-code target (see ModelPicker.css header) — reconcile with Paper by adding a `variant='dock'` that keeps the persistent fill for the StatusDock placement. |
| `SegmentedControl` | Not the workspace Tab strip. Closest Paper instance is `Active | Paused` at IR-0 top-right — two-up pill with amber-filled active state, transparent inactive | `SegmentedControl.css` — inline-flex pill container (bg-input + border-subtle) with `__option` children, active = bg-panel + shadow-sm | **drifts — LOW** | Paper's `Active | Paused` renders the active option **filled amber** (accent + accent-ink); in-code renders active as bg-panel chip. Add an `intent='primary'` variant (or rely on Toggle for 2-state cases) to cover the workspace pattern. |
| `StatusDot` | `StreamingDot` (3X-0) — 9 px pill, bg success, **box-shadow 0 0 0 3 px success-soft halo** as default pulse | `StatusDot.css` — 8 px, halo is only part of the `--pulse` animation frame | **drifts — LOW** | (a) 1 px dimension diff. (b) Paper's default active state has a static halo; in-code only renders the halo as the animated phase. Either bump default size to 9 px and add a `halo` variant, or tighten Paper side to 8 px. |
| `TextInput` | Paper IR-0 "Doc Maintenance" name field — 44 px tall, pill-ish pill radius in screenshot reads closer to 8 px (md), bg `--color-bg-elevated` (white), border subtle, left-aligned 14 px body type | `TextInput.css` — 44 px, padding `0 16px`, radius-md, bg `--color-bg-input`, border `--color-border-default` | **drifts — LOW** | (a) Paper fills with bg-elevated (white in light); in-code fills with bg-input (same as elevated in the current drifted light tokens, so the visible gap is mostly a side effect of §2.2). (b) Paper border reads subtle, in-code uses default. Fix after §2.2. |
| `SearchInput` | Paper IQ-0 + IR-0 left-panel search fields — 32 px tall pill, bg bg-input, icon left, placeholder muted | `SearchInput.css` extends TextInput; only re-slots the icon + cancel-button reset | **drifts — MEDIUM** | SearchInput does not override TextInput's 44 px height → it renders too tall for Paper's 32 px panel search. Add a `size-sm` on TextInput (or a compact SearchInput variant). |
| `Textarea` | `ReplyComposer` (43-0) — not really a Textarea but a Composer: bg `#120F0C` (bg-input), border subtle, radius-**12 (lg)**, padding 12/14/10/14, min-height 80, contains a ComposerActions row (26×26 attach + spacer + 26×26 send) | `Textarea.css` — radius-md (8), padding 12/16, min-height 120, border `--color-border-default` | **drifts — MEDIUM** | (a) Radius md vs lg. (b) Min-height 120 vs 80 (Paper is tighter because the Composer sits inside a dock). (c) Border default vs subtle. (d) Paper's Textarea lives inside a Composer — the inline action row is not a Textarea concern but there is no `Composer` primitive yet (see §4). |
| `Toggle` | Not exercised in the current Paper artboards. Settings surfaces haven't shipped in Paper. | `Toggle.css` — 34×20 pill, knob 14, accent-soft on / toggle-track-off | **matches by absence** | Keep both theme values (`--color-toggle-*`) until a Paper Settings artboard lands. |

### 3.2 Summary

- **Matches (or acceptable):** StatusDot (nearly), Toggle (absent in Paper), TextInput (blocked on §2.2).
- **Drifts to fix:** Badge (HIGH), ContextBadge (HIGH), ModelPicker (MED), Textarea (MED), SearchInput (MED), SegmentedControl (LOW), Button (LOW), StatusDot (LOW), IconButton rail-scale (MED).

## 4. Missing primitives

Paper uses these patterns repeatedly; no in-code primitive covers them today. Post-MVP (per [[decisions]] D25) for the heavier ones — but calling them out now so the audit unblocks the downstream UI chain.

| Pattern | Paper instance(s) | Why it can't live on an existing primitive | Priority |
|---|---|---|---|
| **Tab / TabBar** | `LeftTabBar` (23-0) + `RightTabBar` (50-0) — full-width tab strip, per-tab max-width 220 with icon + label + close, active tab carries amber top-border shadow (`inset 0 1px 0 rgba(249,192,65,0.35)`), inactive flat. | `SegmentedControl` is for 2–4-way toggles (fixed width, gap-2 options); Paper's tab strip is variable-width, scrollable, stateful per tab. | **HIGH** — MVP blocker. Wire-up for M1.3/M1.4 will need this when pane tabs ship. |
| **Composer** | `ReplyComposer` (43-0) wraps Textarea + ComposerActions (attach + send) in one container. StatusDock additionally layers a ContextStrip above and an ActionRow below. | `Textarea` is a plain text surface; the Composer pattern is a composition. | **HIGH** — Chat pane needs it; M4.11 (send/abort controls) already ships a bespoke version in `apps/desktop`. Promote to a primitive. |
| **RailItem / NavIcon (36×36, radius-md, accent-soft active)** | `RailItem-*` (J-0, P-0, S-0, V-0, Z-0, 17-0, 9F-0, 1L-0, 1Q-0, 1T-0, 1X-0, …) | `IconButton` tops out at 32×32 radius-sm. The rail is a distinct visual rhythm. | **MEDIUM** — LeftRail is shipping in Paper but out of M1 scope (LeftRail surfaces are post-MVP per D25). Add when LeftRail lands. |
| **SplitIconPill / ButtonGroup** | `FolderPill` (4V-0) — pill 48×24 containing folder icon + chevron, both click targets | Could be hacked with two IconButtons + a container, but then padding + radius join don't come for free. | **MEDIUM** — Composer footer uses it; needed before ActionRow goes to real components. |
| **Chip / TagInput** | Agents IR-0 — `#project-glass-eng ×`, `slack_send_message × +1` — chip rows with remove affordance + "+N" overflow | Existing `Badge` has no remove button + no input hitbox. | **LOW — post-MVP** — Agents surface is deferred per D25. Add when Connections / Agents ship. |
| **Select** | Agents IR-0 — Frequency `Every day`, Time `10`, `:00`, `AM` | ModelPicker is model-specific. A generic Select would be heavy for MVP. | **LOW — post-MVP**. |
| **Table row** | Agents IR-0 Run History — time / duration / status / trailing chevron, with StatusDot prefix + inline `Badge--error` | Too composition-heavy for a primitive; more of a layout recipe. | **DOCUMENT (not build)** — add a "table-row pattern" entry to the playground when Agents lands. |
| **KPI card / empty state** | Memory IQ-0 has disclosure rows `PEOPLE 27`, `ACTIVE WORK 9` | Layout pattern. | **LOW — post-MVP**. |

## 5. Recommendations (action list, ranked by visual impact)

1. **HIGH — Realign `:root` light-theme surface tokens to Paper 9J-0.** This is the single biggest visible drift.
   - `--color-bg-primary`: `#f4f3f2` → `#fefcf8`
   - `--color-bg-elevated`: `#fefcf8` → `#ffffff`
   - `--color-bg-panel`: `#ebe9e6` → `#f9f5ec`
   - `--color-bg-hover`: `#ecebe9` → `#f4efe4`
   - `--color-bg-input`: keep as `#fefcf8` (cream) OR flip to `#ffffff` (white) — both plausible from Paper; the composer in Paper uses the darkest surface below elevated, which in the new ordering is the `bg-primary` cream. Pin to `#fefcf8` to keep the "input sits in a pool of ink" motif.
   - Delete the "D23 layer reversal" comment; the reversal conflicts with D23 as written.
   - Follow-up: if the reversal was intentional, add a D26 amendment entry to `decisions.md` explaining why — current state is neither captured in D23 nor supported by Paper.
2. **HIGH — Resolve the ContextBadge semantics mismatch.** Decide before M5.3 whether (a) ContextBadge stays color-encoded (in which case StatusDock stops using it and uses `Badge default` + `StatusDot pulse`), or (b) ContextBadge flips to a neutral chip + inline dot. Paper supports (b).
3. **HIGH — Ship a `Tab` / `TabBar` primitive.** `SegmentedControl` is not the right container for workspace tabs.
4. **HIGH — Ship a `Composer` primitive** (Textarea + inline action row). Currently reimplemented ad hoc in the chat pane.
5. **MEDIUM — Realign `Badge` default to pill + fill `var(--color-bg-panel)`.** Both workspace themes expect the pill shape for the workspace chrome; keep the current rounded-md behavior as a `shape='rectangle'` escape hatch if needed.
6. **MEDIUM — Add `--font-weight-display` and route `xxl` headings through it.** 700 in `:root`, 600 in `[data-theme="dark"]`.
7. **MEDIUM — Add `ModelPicker.variant='dock'`** (or equivalent) — persistent bg-elevated + border-subtle, dual-label (provider · model). Keeps the existing inline trigger intact for non-dock placements.
8. **MEDIUM — Add an `IconButton` `size-xl` (36×36, radius-md) + `variant='rail'`** — unblocks the LeftRail port when it lands post-MVP.
9. **MEDIUM — Add a `size-sm` (32 px) to `TextInput`/`SearchInput`** so panel search fields render at the Paper height.
10. **LOW — `Textarea` radius-md → radius-lg** to match the composer; audit downstream Textarea placements before flipping globally.
11. **LOW — `Button --secondary` bg points at `--color-bg-elevated`** (not `--color-bg-input`) to match Paper's Auto-Accept pill.
12. **LOW — `StatusDot` default size 8 → 9 px + optional `halo` variant** (static 3 px ring when a stream is live). Current `--pulse` animation can stay.
13. **LOW — Add a `SplitIconPill` (or `ButtonGroup` container)** for the folder+chevron pattern in the Composer's ActionRow.
14. **PLAYGROUND — Extend `apps/desktop/src/renderer/routes/design-system.tsx`** with a "Paper parity" section once (1)–(4) land, so the canonical reference (per D14) reflects the reconciled system.

## 6. What this audit deliberately did NOT do

- It did not ship any token or primitive changes. Each recommendation maps to a separate follow-up PR (and the downstream UI cleanup chain this ticket explicitly unblocks).
- It did not attempt to re-open D23. That's the next design-decision call. This report surfaces the mismatch so the reopening can be evaluated with data.
- It did not audit the LeftRail / Memory / Agents artboards' primitives exhaustively — only the ones that surface gaps against the workspace artboards. Deep audits for Memory + Agents pair with their own feature work post-MVP.
- It did not replace `agent-knowledge/reference/`'s existing playground reference (`design-system.tsx` is still the canonical visual surface per D14).
