---
type: feature
status: not started
priority: p0
pillar: M4
depends_on: ["M4.1 research (OpenCode Desktop parity doc)"]
supersedes: []
mvp: true
---

# M4b — Model picker (1:1 OpenCode Desktop parity)

## Goal

Tinker's model picker matches OpenCode Desktop's behavior exactly. Users who switch between Tinker and OpenCode Desktop should not have to relearn the picker.

## Scope

- Research-first: `agent-knowledge/reference/opencode-desktop-model-picker.md` documents open/close triggers, keyboard shortcuts, filter behavior, grouping, and visual affordances of OpenCode Desktop's picker.
- `<ModelPicker>` primitive in `@tinker/design`: trigger button + dropdown panel + search input + grouped list + keyboard navigation.
- Provider/model data sourced via OpenCode SDK (`opencode.config.providers()` or equivalent — verify field in research).
- Each row shows: provider name · model display name · context-window size · (optional) pricing hint.
- Keyboard: open with shortcut (TBD from research), arrow keys navigate, Enter selects, Escape closes, typing filters.
- Selection persists per-session in SQLite (`sessions.model_id`).
- New session inherits the most recently selected model from any prior session.

## Out of scope

- Adding/removing providers. Configuration stays in OpenCode.
- Model fine-tuning controls (temperature, max tokens, etc.) — post-MVP.
- Model download / local-model pull (D14 — OpenCode owns model choice; Tinker does not distribute models).
- Multi-model per session. One model per session in MVP.

## Acceptance

- Research doc merged.
- Parity checklist in PR description matches OpenCode Desktop 1:1:
  - Open/close trigger identical.
  - Keyboard navigation identical.
  - Search/filter semantics identical.
  - Row visual layout matches.
  - Provider grouping matches.
- Selected model persists across app restarts.
- New session starts with last-used model.
- No JS errors when `providers()` returns 0 providers (empty state handled).

## Atomic tasks

See `agent-knowledge/context/tasks.md` §M4 (rows 4.1, 4.7–4.10).

## Notes for agents

- If the primitive grows past ~500 LOC, split into `ModelPickerTrigger.tsx` (button surface) + `ModelPickerPanel.tsx` (dropdown content). Shared state via local `useReducer` or zustand in the folder.
- Playground coverage (per D14): add a `?route=design-system` entry showing open state, loading state, empty state, and long-filter state.
- Do not inline OpenCode's model display strings. Always source from the SDK — future provider additions should flow through automatically.
