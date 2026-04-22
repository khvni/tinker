---
type: reference
tags: [testing, ci, visual-regression, playwright, design-system, d14, d23]
status: current
last_verified: '2026-04-22'
linear: TIN-201
---

# Visual parity CI gate

> TIN-201. Chromium-rendered screenshots of `dev:web` vs a committed baseline, gated at 2% pixel drift. Paper artboards remain the human-facing design oracle — they are **not** the CI oracle. This file explains why, how the harness runs, and how to update baselines.

## TL;DR

- CI job `visual` renders the Vite `dev:web` server in headless Chromium, screenshots known routes, and compares them to PNGs in `apps/desktop/test-assets/baselines/` via `pixelmatch`.
- Drift budget: **2% of pixels** per snapshot. Above that, the job fails and the diff PNG uploads as a `visual-diffs` artifact.
- Baselines are **committed to the repo**. Updating them is a deliberate, reviewable code change.
- Paper artboards stay design truth for humans. They are not diffed against.

## Why code-baseline, not Paper-diff

The ticket initially framed visual parity as "Chromium render vs exported Paper PNG, fail >2%." This does not work:

1. **Font rasterization differs.** Paper renders Host Grotesk through its own text engine; Chromium hands off to FreeType / Skia on Linux. Subpixel AA on the same glyph produces >2% pixel drift before any code change.
2. **Paper artboards don't have scrollbars.** Chromium on the CI viewport does. That's ~14 px of vertical band that will always differ.
3. **Paper is 1x design space.** Chromium screenshots at `deviceScaleFactor: 2` but with its own layout rounding.
4. **Paper export has no agent path.** Paper desktop's export flow opens a save dialog that the MCP can't drive. Re-exporting artboards on every token change is a manual step we can't automate inside CI.

So: **the first CI run on a branch with no baseline seeds the current rendered output as the baseline** and passes with a warning. Subsequent runs gate against that seeded baseline. When a pane's design intentionally changes, the author runs `test:visual:update` locally, reviews the new PNG by eye, and commits it. Reviewers see the PNG diff in the PR.

## How the harness works

- Config: [`apps/desktop/playwright.visual.config.ts`](../../apps/desktop/playwright.visual.config.ts).
- Tests: [`apps/desktop/playwright/visual/`](../../apps/desktop/playwright/visual/).
  - `workspace.spec.ts` — guest boot workspace shell
  - `memory.spec.ts` — Memory pane via sidebar
  - `settings.spec.ts` — Settings pane via sidebar
- Compare helper: [`apps/desktop/playwright/visual/compare.ts`](../../apps/desktop/playwright/visual/compare.ts).
- Web server: Playwright boots `pnpm --filter @tinker/desktop dev:web` on `127.0.0.1:1420` (matches `apps/desktop/vite.config.ts`).
- Browser: single Chromium project, 1440×900 viewport (matches Paper artboards), `deviceScaleFactor: 2`, `workers: 1`, `fullyParallel: false`.
- Ready signal: tests wait for `document.documentElement.dataset.appReady === 'true'`. `App.tsx` sets it when `state.status === 'ready'` and `currentUserState.status === 'ready'`. Dev routes (`design-system`, `panes-demo`) set it once their lazy Suspense boundary resolves.
- Compare: `pixelmatch` at `threshold: 0.1` per pixel, drift budget 2% overall. Failure writes `<name>.diff.png` and `<name>.actual.png` into `apps/desktop/test-output/` (artifact-uploaded on CI failure).
- First-run + update modes live in `compare.ts`: missing baseline → seed + pass (log warn); `UPDATE_BASELINES=1` → overwrite + pass.

## Snapshot targets

| Name | URL | Action | Purpose |
|------|-----|--------|---------|
| `boot-guest` | `/` | — | Guest cold boot. Catches drift in the top-level workspace shell / auth splash / titlebar. |
| `memory-pane` | `/` | Click sidebar Memory | Memory pane list + empty-state rendering. |
| `settings-pane` | `/` | Click sidebar Settings | Settings Account + Connections sections. |

## Running locally

Install Playwright's Chromium bundle once:

```sh
pnpm --filter @tinker/desktop exec playwright install chromium
```

Run the suite (boots Vite in-process):

```sh
pnpm --filter @tinker/desktop test:visual
```

Update baselines after an intentional visual change:

```sh
pnpm --filter @tinker/desktop test:visual:update
```

Then commit the PNGs in `apps/desktop/test-assets/baselines/` as part of the same PR. Reviewers will see both the code change and the pixel change side-by-side.

## Adding a new snapshot

1. Make the route deterministic. No animations in the first paint, no "current time" rendering.
2. Ensure the route either wraps inside `App` (which already owns `data-app-ready`) or handles its own ready flag via the `DevRouteReadyMarker` in `apps/desktop/src/renderer/main.tsx`.
3. Add a `test(...)` entry to the relevant `.spec.ts` with a descriptive lowercase-kebab name.
4. Run `test:visual` once locally. The harness will seed `apps/desktop/test-assets/baselines/<name>.png`. Inspect it.
5. Commit the code and baseline together.

## Paper artboards (human reference only)

These artboards live in the Paper file `Tinker Workspace` and are the source of design truth for designers. They are **not** CI-diffed. If a designer wants to track them alongside the code baselines for humans to compare by eye, they can export the PNG and drop it under `apps/desktop/test-assets/paper/` with a matching name. Nothing in CI reads that directory.

| Artboard ID | Name | Suggested `paper/` filename |
|-------------|------|------------------------------|
| `9I-0` | Tinker Workspace — Light | `paper/workspace-light.png` |
| `IQ-0` | Tinker — Memory view | `paper/memory.png` |
| `9J-0` | Tinker Tokens — Light | `paper/tokens-light.png` |

Agents cannot automate Paper exports (the save dialog blocks MCP), so the `paper/` directory stays empty until a human seeds it.

## Follow-ups

- **Label bypass**: a PR label like `visual-change-approved` could auto-update baselines in CI. Deferred — file as TIN-201-b if bypass becomes worth automating. See Linear ticket link below.
- **Dark theme**: `App` applies light theme on boot via `readTheme()`. A second snapshot pass with `colorScheme: 'dark'` + localStorage seeding would gate D23's dual-theme coverage. Not built here.

### Linear links

- TIN-201 (this work): https://linear.app/tinker/issue/TIN-201
- TIN-201-b follow-up "Visual-parity opt-out label + baseline auto-update": https://linear.app/tinker/issue/TIN-201-b
