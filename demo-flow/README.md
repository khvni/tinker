# Tinker · demo-flow

Self-contained hackathon prototype. Not integrated with the main Tinker
monorepo — a standalone Vite + React + TS app that ships the UI story of
"an AI coworker for every Keysight employee."

Used to record a 10-minute demo video. Click-through, deterministic, seed data
lives in `src/seed/*.ts` so the primary user can swap in real `before`/`after`
spreadsheets, transcripts, memory entries, etc. without touching components.

## Run · browser

```bash
cd demo-flow
pnpm install --ignore-workspace    # install outside the monorepo workspace
pnpm dev                           # http://localhost:5280
pnpm build                         # tsc --noEmit + vite build
pnpm preview                       # serve the production build
```

Fonts load from Google Fonts (Host Grotesk + JetBrains Mono). No other
network dependencies at runtime.

## Run · desktop app (Electron)

The UI already draws its own title-bar + traffic lights, so wrapping it in a
native window is essentially a 40-line `electron/main.cjs` shim.

```bash
cd demo-flow
pnpm install --ignore-workspace    # one-time; pulls in electron + concurrently

pnpm shell                         # dev mode: Vite HMR + native window, auto-reload
pnpm shell:build                   # prod mode: build to dist/ then open as app
```

`pnpm shell` runs the Vite dev server and Electron side-by-side via
`concurrently`; edits to `src/**` hot-reload inside the native window.
`pnpm shell:build` is what you want for recording the demo video — no dev
banner, no reload logs.

**macOS** uses `hiddenInset` so the native traffic-lights sit where the drawn
chrome expects them. Other platforms get a standard frame — the drawn
traffic-lights then read as decoration, which is fine for a prototype.

Override the dev URL (e.g. to point at a staging build) with:

```bash
TINKER_DEV_URL=http://localhost:5280/ pnpm shell
```

> First `pnpm install` may print `Ignored build scripts: electron`. That's
> pnpm's guard against arbitrary post-install scripts. Run `pnpm rebuild
> electron` once to let it extract the binary, or just run `pnpm shell` —
> pnpm will finish the extraction on first launch.

## Demo path · ideal 10-minute walkthrough

1. **Open** — lands on the narrative screen.
   *One sentence of stage-setting: the models are good enough, the harness isn't.*

2. **Press `⌘K`** (or click **Enter workspace**) to drop into the app.

3. **Workspace** (`⌘1`). Three chat tabs across the top, one per story:
   1. `Marvell · whitespace` — existing-account whitespace analysis.
   2. `Enrich 8-company list` — data-enrichment before/after.
   3. `Orbion · Anika prep` — pre-meeting brief + follow-up draft.
   Click each tab to switch. The right pane updates its file viewer in sync.
   Toggle the **audit** chip in the status dock to slide up the tool-call
   reasoning rail.

4. **Explorer** (`⌘2`). The local vault tree — accounts, prospects, portfolio.
   Click any `.md` or `.csv` to preview in the right pane.

5. **Chats** (`⌘3`). Conversations list with snippets, unread dots, tags.

6. **Wavelength** (`⌘4`). Training view — hero card ("Khani's Wavelength ·
   Master · coached by Surfer"), **Start Training** CTA, 8 Kits grid with
   progress. Faded Keysight wavelength logo is the watermark.

7. **Agents** (`⌘5`). Assistants + automations + scheduled runs. Detail view
   shows config, channels, skills, recent runs table.

8. **Connections** (`⌘6`). Ramp-Glass-style tool-permissions view.
   16 connections in the sidebar (Slack default). Each tool has a 3-state
   pill: `Auto / Allow / Ask`. Read-only and write/delete buckets with a
   rollup badge ("Allow" / "Mixed" / "Ask") at the top of each.

9. **Memory** (`⌘7`). Two-pane memory browser — categories left, entries
   middle, detail reader right.

10. **Close** — `⌘⇧N` returns to the opening narrative.

## Where seed data lives

| File | What's in it | Safe to replace? |
|---|---|---|
| `src/seed/demo1-whitespace.ts` | Marvell account + signals + SFDC + portfolio + transcript + tool calls | yes |
| `src/seed/demo2-enrichment.ts` | 8-company before/after + staged tool calls + transcript | yes |
| `src/seed/demo3-meeting.ts` | Contact profile + prior-meeting memory + transcript excerpt + follow-up email + tool calls | yes |
| `src/seed/sidebars.ts` | Explorer tree, chat list, skills catalog, agents, memory entries | yes |
| `src/seed/connections-v2.ts` | 16 connections + per-tool read-only / write-delete permissions | yes |

All seed data is fictional or public-company-level. Contact names + phone
numbers are invented (+1 `555` reserved-for-fiction range). No real customer
data, no Keysight internal content.

## Design system

Bookish-workbench light theme — extracted from `packages/design` in the main
Tinker repo. Full token list in `src/styles/tokens.css`. Fonts: Host Grotesk
for prose, JetBrains Mono for data + audit. Amber `#f9c041` is the only
accent; everything else is warm neutrals + hairlines.

## Keyboard

| Key | Action |
|---|---|
| `⌘K` | Narrative → Workspace |
| `⌘1`–`⌘7` | Switch top-level view |
| `⌘⇧N` | Back to narrative |
| `⌘F` | Focus sidebar search (per-view) |

## What this does NOT do

- No backend. No real tool execution. No real email / Salesforce / Graph calls.
- No persistence — refresh resets the state machine.
- `pnpm shell:build` does NOT currently package a distributable `.app` /
  `.dmg` / `.exe`. It launches Electron against the local build. Use
  `electron-builder` if you need a notarised app bundle (~30 min of config).

## Folder layout

```
demo-flow/
├── electron/
│   └── main.cjs                       ← native shell entry (pnpm shell)
├── public/
│   └── keysight-wave.svg              ← background watermark
├── src/
│   ├── App.tsx                        ← narrative <-> app state machine
│   ├── main.tsx
│   ├── shell/                         ← TitleBar, LeftRail, Shell, nav, icons
│   ├── views/
│   │   ├── OpeningNarrative.tsx
│   │   ├── workspace/                 ← WorkspaceView, ChatPane, OutputPane, AuditRail
│   │   ├── ExplorerView.tsx
│   │   ├── ChatsView.tsx
│   │   ├── SkillsView.tsx             ← Wavelength training view
│   │   ├── AgentsView.tsx
│   │   ├── ConnectionsView.tsx
│   │   ├── MemoryView.tsx
│   │   └── shared/                    ← SidebarDetailLayout etc
│   ├── seed/                          ← all demo data; safe to overwrite
│   └── styles/                        ← tokens.css, base.css, app.css
├── index.html
├── package.json
└── vite.config.ts
```
