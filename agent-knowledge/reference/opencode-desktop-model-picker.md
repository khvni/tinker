---
type: tool
tags: [opencode, desktop, model-picker, ui, reference, parity]
---

# OpenCode Desktop — Model Picker Parity Reference

Research deliverable for [[context/tasks]] M4.1 (TIN-38). Source of truth for the Tinker `<ModelPicker>` primitive in `@tinker/design`. Blocks M4.7–M4.10.

## Sources Reviewed

- `[2026-04-21]` Repo: `https://github.com/sst/opencode` at commit `d2181e9273bfcd9727a387527b25aa017ca15410`
- `[2026-04-21]` Repo: `https://github.com/anomalyco/opencode` at the same commit — `packages/desktop/` is byte-identical to sst upstream (verified via `diff -q`); the desktop shell is a thin Tauri webview, the picker lives in `packages/app/` (shared SolidJS workspace)
- `[2026-04-21]` SDK surface: `packages/sdk/openapi.json` endpoints + schema definitions
- `[2026-04-21]` Primary picker files: `packages/app/src/components/dialog-select-model.tsx`, `dialog-select-model-unpaid.tsx`, `prompt-input.tsx`, `model-tooltip.tsx`; `packages/app/src/context/{local,models}.tsx`; `packages/app/src/hooks/use-providers.ts`; `packages/app/src/pages/session/use-session-commands.tsx`; shared list primitive at `packages/ui/src/components/{list.tsx,list.css}` + `packages/ui/src/hooks/use-filtered-list.tsx`

## Two surfaces

- `[2026-04-21]` **`ModelSelectorPopover`** — popover anchored to the composer's model pill. Normal path when paid providers exist.
- `[2026-04-21]` **`DialogSelectModel`** — modal dialog version. Opened via command palette / `Cmd+'` / `/model` slash command.
- `[2026-04-21]` Both surfaces share the same `<List>` primitive from `@opencode-ai/ui` — the difference is container only.
- `[2026-04-21]` **`DialogSelectModelUnpaid`** — a third fallback modal used when `providers.paid().length === 0`; lists free models + "connect a provider" CTA.

---

## A. Invocation & open behavior

- `[2026-04-21]` Composer-pill trigger: `prompt-input.tsx:1541-1564`. Ghost `<Button>` renders `<ProviderIcon>` + truncated `local.model.current()?.name` + `chevron-down` icon. Click toggles popover open state.
- `[2026-04-21]` Unpaid fallback: when `providers.paid().length === 0`, the pill opens `DialogSelectModelUnpaid` as a modal instead (`prompt-input.tsx:1498-1533`, dynamic-imported at 1515).
- `[2026-04-21]` Keyboard shortcut: `Cmd/Ctrl + '` registered as command `id: "model.choose"` with `keybind: "mod+'"` in `use-session-commands.tsx:515-523`. Opens the modal variant, not the popover.
- `[2026-04-21]` Slash command: `/model` typed into the composer maps to the same command (`use-session-commands.tsx:521`).
- `[2026-04-21]` Popover placement: Kobalte `placement="top-start"`, `gutter={4}` (`dialog-select-model.tsx:136-138`).
- `[2026-04-21]` Popover is explicitly `modal={false}` (`dialog-select-model.tsx:135`) — does not block underlying UI, click-outside dismisses.
- `[2026-04-21]` Dismiss reasons tracked as `Dismiss = "escape" | "outside" | "select" | "manage" | "provider"` (`dialog-select-model.tsx:89`).
- `[2026-04-21]` Close handlers (`dialog-select-model.tsx:145-160`):
  - `onEscapeKeyDown` → `close("escape")`, preventDefault + stopPropagation
  - `onPointerDownOutside` / `onFocusOutside` → `close("outside")`
  - Row select → `close("select")` (from `ModelList.onSelect` at line 70)
  - "Connect provider" / "Manage models" buttons → `close("provider")` / `close("manage")`, then open a different dialog
- `[2026-04-21]` Focus restoration: `onCloseAutoFocus` (lines 152-160) preserves focus only when dismiss === `"outside"`; `prompt-input.tsx:1551` passes `onClose={restoreFocus}` to return focus to the composer textarea otherwise.

## B. Search & filter

- `[2026-04-21]` Search input config: `dialog-select-model.tsx:41` — `{ placeholder: language.t("dialog.model.search.placeholder"), autofocus: true, action: props.action }`.
- `[2026-04-21]` Placeholder copy: `"Search models"` (`packages/app/src/i18n/en.ts:114`).
- `[2026-04-21]` Filter keys: `filterKeys={["provider.name", "name", "id"]}` (`dialog-select-model.tsx:46`).
- `[2026-04-21]` Algorithm: `fuzzysort` (fuzzy, not substring). `use-filtered-list.tsx:41` → `fuzzysort.go(needle, x, { keys: props.filterKeys! }).map(x => x.obj)`. Needle is lower-cased (line 32).
- `[2026-04-21]` No visual highlighting of matched characters — only re-ordering and filtering.
- `[2026-04-21]` Clear control: when filter is non-empty, a `circle-x` IconButton appears and clears via `setInternalFilter("")` + refocus (`list.tsx:303-313`).
- `[2026-04-21]` Scroll resets to top on every filter change (`list.tsx:123-131`).
- `[2026-04-21]` Empty state (no filter): `emptyMessage={language.t("dialog.model.empty")}` — `"No model results"` (`en.ts:115`).
- `[2026-04-21]` Empty state (filter active): richer copy combining `ui.list.emptyWithFilter.prefix` + `ui.list.emptyWithFilter.suffix` — rendered as `No results for "<query>"` (`list.tsx:243-260`, `packages/ui/src/i18n/en.ts:84-87`).

## C. Keyboard navigation

- `[2026-04-21]` Implementation: `createList` from `solid-list` via `use-filtered-list.tsx:69-73` with `loop: true` (wraparound on both ends).
- `[2026-04-21]` ArrowUp / ArrowDown: forwarded to the list's `onKeyDown` (`list.tsx:191-193`).
- `[2026-04-21]` Enter: `list.tsx:183-185` — guards `!e.isComposing`, preventDefaults, calls `handleSelect(selected, index)`.
- `[2026-04-21]` Escape: list deliberately short-circuits (`list.tsx:174 — if (e.key === "Escape") return`) so Escape bubbles to the popover/dialog close handler.
- `[2026-04-21]` Ctrl+N / Ctrl+P: `use-filtered-list.tsx:91-99` maps these to ArrowDown/ArrowUp (only when no meta/alt/shift modifiers). Works inside the search input.
- `[2026-04-21]` Alt+Arrow / Cmd+Arrow: explicitly bailed (`use-filtered-list.tsx:101-103`) so macOS native text navigation inside the search input is not hijacked.
- `[2026-04-21]` Tab: NOT intercepted — falls through to browser focus order (no autocomplete, no item cycling).
- `[2026-04-21]` Home / End / PageUp / PageDown: **NOT PRESENT** in OpenCode. *Tinker proposal: add Home=first, End=last, PageUp/PageDown=±10 rows for parity with VS Code command palette.*
- `[2026-04-21]` First focus: search input is `autofocus: true`. Initial active item = `props.current` if set, else first flat item (`use-filtered-list.tsx:60-67`). Filter changes trigger `reset()` via `createEffect(on(grouped, () => reset()))` (lines 107-111).
- `[2026-04-21]` Current-selection auto-scroll: `list.tsx:133-143` — `requestAnimationFrame` + `scrollIntoView(..., "center")` when `props.current` is set.
- `[2026-04-21]` Active-row auto-scroll: `list.tsx:145-159` — active row scrolls into view on keyboard navigation; suppressed while the mouse is active.
- `[2026-04-21]` Mouse/keyboard arbitration: `onMouseMove` with non-zero delta sets `store.mouseActive=true` and moves `active` to the hovered row (`list.tsx:347-351`); any keystroke resets `mouseActive=false` (line 173). Prevents hover-steals-keyboard-focus footgun.
- `[2026-04-21]` Sticky group headers: `list.css:195-196` — `position: sticky; top: 0;`. `data-stuck` attribute flips on scroll; fades a gradient shadow beneath the stuck header (`list.css:208-223`).

## D. Grouping & rows

- `[2026-04-21]` Grouping key: `groupBy={(x) => x.provider.name}` (`dialog-select-model.tsx:48`).
- `[2026-04-21]` Group order (`sortGroupsBy`): `dialog-select-model.tsx:49-55`. Popular providers first in fixed order: `["opencode", "opencode-go", "anthropic", "github-copilot", "openai", "google", "openrouter", "vercel"]` (from `use-providers.ts:6-15`). Unknown providers sort after popular ones.
- `[2026-04-21]` Within-group sort: alphabetical by model display name (`dialog-select-model.tsx:47`).
- `[2026-04-21]` Group header: renders the raw category string (`list.tsx:237-238`); receives `data-stuck` for scroll-edge shadow. No provider logo in the header in the popover path. Provider logos are used only inside `dialog-select-model-unpaid.tsx:109`.
- `[2026-04-21]` Row content (`dialog-select-model.tsx:73-83`): model name + optional `<Tag>Free</Tag>` (`provider === "opencode"` && `cost.input === 0`, per `isFree` at line 16) + optional `<Tag>Latest</Tag>` (`m.latest` flag from models context at `models.tsx:99`).
- `[2026-04-21]` Per-row tooltip: `itemWrapper` wraps each row with `<Tooltip placement="right-start" gutter={12}>` (`dialog-select-model.tsx:56-65`). Body (`model-tooltip.tsx:77-90`) shows `Provider Model Name (Latest, Free)`, capability bullets (`Allows: text, image, pdf, …`), reasoning yes/no, context limit `N` (locale-formatted).
- `[2026-04-21]` Selected-state glyph: `check-small` icon inside `[data-slot="list-item-selected-icon"]` when row matches `props.current` (`list.tsx:358-362`).
- `[2026-04-21]` Active-row icon slot: optional `activeIcon` prop. Popover does not set it; unpaid dialog sets `activeIcon="plus-small"` for its "add provider" list.
- `[2026-04-21]` Row data attributes: `data-slot="list-item"`, `data-key={providerID:modelID}`, `data-active={true|false}`, `data-selected={true|false}` (`list.tsx:339-343`).

## E. Selection persistence

- `[2026-04-21]` Dual scope (workspace + session): `packages/app/src/context/local.tsx:21-25`. Store shape `{ session: Record<string, State | undefined> }` plus constant `WORKSPACE_KEY = "__workspace__"` for the per-directory default.
- `[2026-04-21]` Session-override writes when a session id exists (`local.tsx:261-266`); otherwise the pick writes to the workspace draft (`setStore("draft", state)`).
- `[2026-04-21]` Recent list: separate 5-item cap `RECENT_LIMIT = 5` (`models.tsx:19`). `models.recent.push(item)` (`models.tsx:129-133`) uniques by `providerID:modelID`. Called from `model.set` only when `options.recent === true`; the popover passes `{ recent: true }` (`dialog-select-model.tsx:67-69`).
- `[2026-04-21]` Visibility side-effect: `model.set(...)` auto-calls `models.setVisibility(item, true)` so the chosen model is un-hidden (`local.tsx:302`).
- `[2026-04-21]` Storage: `Persist.global("model", ["model.v1"])` in `context/models.tsx:30-37` — global persisted store with a version-tagged migration path. Workspace/session picks use a separate persisted store via `@/utils/persist`.
- `[2026-04-21]` **No SDK call on select**: selection is purely client-side state. No `session.update()` / `config.set()` is invoked. The chosen model is attached to the next prompt request by the bridge layer.

## F. Data source

- `[2026-04-21]` SDK endpoint: `GET /config/providers` (OpenAPI path `openapi.json:1524-1580`).
- `[2026-04-21]` SDK call: `client.config.providers({ directory, workspace })` — generated in `packages/sdk/js/src/v2/gen/sdk.gen.ts:1393`.
- `[2026-04-21]` Response shape: `{ providers: Provider[], default: Record<string, string> }`.
- `[2026-04-21]` `Provider` schema (`openapi.json:12309-12348`): `{ id, name, source: "env"|"config"|"custom"|"api", env: string[], key?: string, options: object, models: Record<string, Model> }`.
- `[2026-04-21]` `Model` schema (`openapi.json:12088-12308`): `id`, `providerID`, `api`, `name`, `family`, `capabilities` (`temperature`, `reasoning`, `attachment`, `toolcall`, `input: {text,audio,image,video,pdf}`, `output: {...}`, `interleaved`), `cost` (`input`, `output`, `cache: {read, write}`, `experimentalOver200K?`), `limit` (`context`, `input?`, `output`), `status` (`"alpha"|"beta"|"deprecated"|"active"`), `options`, `headers`, `release_date`, `variants`.
- `[2026-04-21]` In-app aggregation: `context/models.tsx:39-46` — `available()` flattens `providers.connected().flatMap(p => Object.values(p.models).map(m => ({ ...m, provider: p })))`. `list()` (line 95-101) strips the `"(latest)"` suffix from display names and sets a `latest` boolean.
- `[2026-04-21]` Provider filter helpers: `use-providers.ts:18-44` — exposes `.all / .default / .popular / .connected / .paid`, with project-scope override when `dir()` is set.
- `[2026-04-21]` Caching: list is reactive against `globalSync.data.provider`; the response is loaded once and refreshed via event-subscribe — **not** re-fetched on every picker open.
- `[2026-04-21]` Pagination: NONE — `/config/providers` returns the full set in one call.
- `[2026-04-21]` "Latest" filter: `models.tsx:58-87` builds a `latestSet` per provider/family by picking the newest `release_date` and keeping only models released within the last 6 months. `visible()` (lines 114-123) hides older models unless the user has explicitly set visibility via Manage Models.

## G. States

- `[2026-04-21]` Loading: `list.tsx:244` — `if (grouped.loading) return props.loadingMessage ?? i18n.t("ui.list.loading")`. Text-only placeholder inside the empty-state slot. No skeleton rows.
- `[2026-04-21]` Providers-loading gate at composer level: `prompt-input.tsx:1492` wraps the entire model-control block in `<Show when={!providersLoading()}>`. The pill does not render until providers load, so the popover never opens in a "loading models" state. Optional fade-in animation applies (`animation: "fade-in 0.3s"`, `providersShouldFadeIn()` at line 1496).
- `[2026-04-21]` Error: **NOT PRESENT**. No error / retry UI inside the picker. If `/config/providers` fails, `globalSync` retries elsewhere and the pill simply stays hidden. *Tinker proposal: surface the pill in a disabled state with an error tooltip ("Couldn't load models — retry") to match D14/D23 self-healing principle.*
- `[2026-04-21]` Empty (no providers configured): composer path falls through to `DialogSelectModelUnpaid` which lists free models + "Add more providers" CTA (`dialog-select-model-unpaid.tsx:87-142`). List-level empty copy: `"No model results"`.
- `[2026-04-21]` Disabled mid-stream: **NOT PRESENT** in the picker itself. The composer only hides the model control during shell mode (`store.mode !== "shell"`, `prompt-input.tsx:1493`). *Tinker proposal: during an in-flight stream, render the pill but apply any change on the next turn; or set `aria-disabled` while `session.status === "streaming"`.*

## H. Accessibility

- `[2026-04-21]` Popover uses `@kobalte/core/popover` which provides WAI-ARIA dialog semantics. Screen-reader title rendered as `class="sr-only"` text `"Select model"` (`dialog-select-model.tsx:162`).
- `[2026-04-21]` The component is NOT structured as an ARIA combobox. No explicit `role="combobox"` on the trigger, no `role="listbox"` on the container, no `aria-activedescendant` linking the search input to the active row.
- `[2026-04-21]` Rows are plain `<button type="button">` with `data-active` / `data-selected` attributes (`list.tsx:339-346`).
- `[2026-04-21]` Selection-change live-region announcement: **NOT IMPLEMENTED**.
- `[2026-04-21]` IconButton labels: `aria-label={language.t("command.provider.connect")}` and `aria-label={language.t("dialog.model.manage")}` (`dialog-select-model.tsx:176, 186`).
- `[2026-04-21]` Search input: `spellcheck=false`, `autocorrect="off"`, `autocomplete="off"`, `autocapitalize="off"` (`list.tsx:297-300`).
- `[2026-04-21]` *Tinker proposal (exceeds OpenCode parity):* add `role="combobox"` + `aria-expanded` + `aria-controls` on the pill trigger; `role="listbox"` on the scroll container; `role="option"` + `aria-selected` on each row; wire `aria-activedescendant` from the search input to the active row's id. Add a polite live region for selection-change announcements.

## I. Visual anatomy

All sizes/colors pulled from source so Tinker can tokenize via `@tinker/design`.

- `[2026-04-21]` **Trigger pill** (`prompt-input.tsx:1541-1564`):
  - `variant="ghost"`, `size="normal"`
  - `min-w-0 max-w-[320px] text-13-regular text-text-base`
  - Contents order: `<ProviderIcon size-4 shrink-0 opacity-40 group-hover:opacity-100>` → truncating `<span>{modelName}</span>` → `<Icon name="chevron-down" size="small" shrink-0>`
- `[2026-04-21]` **Popover panel** (`dialog-select-model.tsx:143-144`):
  - Dimensions: `w-72 h-80` = 288 × 320 px
  - `flex flex-col p-2 rounded-md border border-border-base bg-surface-raised-stronger-non-alpha shadow-md z-50 outline-none overflow-hidden`
  - Placement: `top-start`, 4 px gutter
- `[2026-04-21]` **Search bar** (`list.css:59-84`): `padding: 8px`, `gap: 12px`, `border-radius: var(--radius-md)`, `background: var(--surface-base)`. Leading `magnifying-glass` icon; trailing `circle-x` clear button when filter non-empty.
- `[2026-04-21]` **Search action slot** (`dialog-select-model.tsx:169-190`): two ghost IconButtons — `plus-small` (connect provider) and `sliders` (manage models), each `class="size-6"` = 24 × 24 px.
- `[2026-04-21]` **Group header** (`list.css:187-224`): `padding: 8px 12px 8px 8px`, `position: sticky; top: 0`, `text-14-medium`, `color: var(--text-weak)`, `background: var(--surface-raised-stronger-non-alpha)`. Scroll-under shadow: 16 px linear-gradient fade, opacity 0→1 keyed off `data-stuck="true"`.
- `[2026-04-21]` **List scroll mask** (`list.css:134`): bottom-edge fade via `mask: linear-gradient(to bottom, #ffff calc(100% - var(--bottom-fade)), #0000)`, animated with `@property --bottom-fade` keyframes (`list.css:1-17`). Scrollbar hidden (`scrollbar-width: none`).
- `[2026-04-21]` **Row** (`list.css:232-306`):
  - `padding: 6px 8px 6px 8px`
  - `text-14-medium`, `color: var(--text-strong)`
  - `scroll-margin-top: 28px` (keyboard scroll clears sticky header)
  - Active state: `background: var(--surface-raised-base-hover)`, `border-radius: var(--radius-md)`; `[data-slot="list-item-active-icon"]` flips to `display: inline-flex`
  - `:active` pressed: `background: var(--surface-raised-base-active)`
  - `:focus-visible { outline: none }` — keyboard focus indicated via `data-active`, not an outline ring
- `[2026-04-21]` **Row divider** (optional): `position: absolute; bottom: 0; left/right: var(--list-divider-inset, 16px); height: 1px; background: var(--border-weak-base)`. NOT used by the model picker — no `divider` prop passed.
- `[2026-04-21]` **Tag component**: "Free" / "Latest" pills — re-uses `@opencode-ai/ui/tag` for color + size.
- `[2026-04-21]` **Provider icons**: SVG sprite at `packages/ui/src/components/provider-icons/sprite.svg`. `<ProviderIcon id="anthropic" />` renders `<use href="sprite.svg#anthropic">` and falls back to `#synthetic` when the id is not in the sprite (`packages/ui/src/components/provider-icon.tsx:10-25`).

## J. Parity checklist (for Tinker `<ModelPicker>`)

1. Pill trigger in the composer: `<ProviderIcon>` + truncating model name (max 320 px) + `chevron-down`.
2. Opens a popover anchored `top-start` with 4 px gutter, fixed 288 × 320 px panel, `modal={false}`.
3. `Cmd/Ctrl + '` keybind opens the picker (modal variant).
4. `/model` slash command from the composer opens the picker.
5. Search input autofocused on open, placeholder `"Search models"`, spellcheck/autocorrect/autocomplete/autocapitalize disabled.
6. Filter uses `fuzzysort` across `["provider.name", "name", "id"]` (needle lower-cased, fuzzy — not substring).
7. Clear-filter button (`circle-x`) appears when filter non-empty; scroll resets to top on filter change.
8. Grouped by provider name; group order follows the popular-list (`opencode`, `opencode-go`, `anthropic`, `github-copilot`, `openai`, `google`, `openrouter`, `vercel`) then everything else; within-group sort alphabetical by model name.
9. Sticky group headers with scroll-edge shadow (data-stuck gradient fade).
10. Row shows model name + `Free` tag (opencode provider + zero input cost) + `Latest` tag (newest in family within 6 months); selected row shows trailing `check-small`.
11. Per-row tooltip (`placement="right-start"`, 12 px gutter) shows provider+model title, `Allows: text, image, …`, reasoning yes/no, locale-formatted context limit.
12. Keyboard: ArrowUp/Down loop, Enter selects, Ctrl+N / Ctrl+P as arrow aliases, Escape bubbles to popover close (not handled inside list), Alt/Cmd+Arrow passes through for native text-nav.
13. Mouse-move updates active row; any keystroke suppresses mouse-active until the next non-zero mouse movement.
14. Current model auto-scrolls to center on open; active row auto-scrolls into view on keyboard nav.
15. Selecting a model calls `model.set({ providerID, modelID }, { recent: true })`, un-hides it, pushes to a 5-item recent list, closes the popover, restores composer focus.
16. Data from `client.config.providers()` → `{ providers: Provider[], default }`; cached via a reactive store (no re-fetch on picker open).
17. "Latest" badge and default visibility use a 6-month release-window heuristic + per-family newest pick.
18. Empty-state copy: `"No model results"` (or `No results for "<query>"` when filter non-empty).
19. Popover search bar embeds two IconButton actions (`plus-small` → connect provider, `sliders` → manage models).
20. When `providers.paid()` is empty, the pill opens `DialogSelectModelUnpaid` (modal listing free models + popular providers) instead of the popover.

## Tinker adaptations (parity-plus deltas)

- `[2026-04-21]` **Accessibility upgrade**: ship `role="combobox"` on the trigger + `role="listbox"` / `role="option"` + `aria-activedescendant` + polite live region. OpenCode's picker does not implement these; Tinker's `@tinker/design` primitives target a11y parity with `<Textarea>`.
- `[2026-04-21]` **Home/End/PageUp/PageDown** keyboard parity with VS Code command palette — OpenCode omits these.
- `[2026-04-21]` **Error state**: OpenCode hides the pill on provider-load failure. Tinker should keep the pill visible but disabled with a retry tooltip — aligns with Buchan-style self-healing UX.
- `[2026-04-21]` **Disabled mid-stream**: OpenCode allows picker interaction during a stream but defers the effect. Tinker should visually disable the pill while `session.status === "streaming"` to communicate the deferral.
- `[2026-04-21]` **Persistence scope**: OpenCode keeps workspace + session scopes + a 5-item recents list. Tinker will persist selection per-session via `sessions.model_id` (see M4.9 / M2.2) — the workspace-default scope is out of MVP and can land post-v0.1.
- `[2026-04-21]` **Provider-logo sprite**: OpenCode ships its own SVG sprite. Tinker should inline a comparable sprite in `@tinker/design` with MIT/Apache-licensed provider marks; do not copy OpenCode's sprite file directly without checking license.
- `[2026-04-21]` **No SDK writes on select** — keep this architectural property. Selection is client-side only; prompt requests carry the chosen `{ providerID, modelID }` from session state. Do not introduce `config.set()` side-effects.

## Connections

- [[opencode-desktop-review]] — broader desktop-shell review
- [[context/tasks]] M4.1 (this deliverable) · M4.7 / M4.8 / M4.9 / M4.10 (implementation + wiring + parity verification)
- [[09-design-system]] — `@tinker/design` primitive placement + playground entry convention per D14
- [[panes-best-practices-2026-04-20]] — workspace-layout context for the pill's composer placement

## Verification path

- `[2026-04-21]` M4.10 (parity verification): open OpenCode Desktop side-by-side with the Tinker build and tick all 20 items in §J. Any bullet that does not match is a blocker for merging the ModelPicker impl.
- `[2026-04-21]` Source commit pinned (`d2181e9273bfcd9727a387527b25aa017ca15410`) — if OpenCode's picker ships new behavior, diff against this commit and update this file in a follow-up PR.
