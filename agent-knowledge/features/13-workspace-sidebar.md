---
type: concept
tags: [workspace, sidebar, nav]
deferred: post-mvp
---

> **[2026-04-21] DEFERRED — post-MVP per [[decisions]] D25.** MVP has no multi-workspace UX; sidebar is premature. Do not start work until MVP ships.

# Feature 13 — Workspace sidebar (vertical)

**Status**: spec drafted `[2026-04-19]`. Depends on [[10-tinker-panes]] + [[12-attention-coordinator]].

## Why

The workspace (project + session scope) is the primary navigation object — not a tab across the top. cmux's vertical sidebar model gives each workspace a rich card (branch, PR, ports, last notification). This is what separates Tinker from chat-shaped tools.

## Shape

- Persistent left sidebar, resizable (reuse `@tinker/panes` `ResizeHandle`).
- Each workspace renders as a stacked card:
  - Title (workspace label or vault subdir)
  - Structured metadata rows (see below)
  - Unread indicator from [[12-attention-coordinator]]
- Drag to reorder.
- "+" button at the bottom adds a new workspace (opens vault picker).
- Settings + model + account chips live at the bottom, not as tabs.

## Structured metadata model

cmux's `SidebarStatusEntry` is the model:

```ts
type MetadataFormat = 'plain' | 'markdown';

type SidebarStatusEntry = {
  key: string;         // stable id so later updates replace
  value: string;
  icon?: string;       // icon name from design system
  color?: string;      // token name, e.g. 'accent.base'
  url?: string;        // optional deep-link / external
  priority: number;    // sort ascending
  format: MetadataFormat;
  timestamp: number;
};
```

Anything on the host-service side can publish entries for a workspace. Examples:

| key | contributor | value |
|---|---|---|
| `git.branch` | git-watcher | `feat/tinker-panes` |
| `git.pr` | gh-mcp | `#42 — approved` |
| `opencode.model` | chat runtime | `gpt-5.4` |
| `session.tokens` | chat runtime | `12.3k in / 1.4k out` |
| `fs.watching` | vault indexer | `341 docs indexed` |
| `attention.latest` | [[12-attention-coordinator]] | `Claude finished a turn` |
| `scheduler.next` | scheduler | `Daily sweep in 3h 12m` |

## Sort + layout

- Cards ordered by last-active timestamp DESC.
- Card with an unread flash auto-promotes to the top (cmux's `WorkspaceAutoReorderSettings` — opt-out in Settings).
- Pinned workspaces (manual) stay above the fold regardless.

## API

```ts
// packages/workspace-sidebar/src/index.ts
export function WorkspaceSidebar(props: {
  workspaces: WorkspaceCardModel[];
  activeWorkspaceId: string | null;
  onActivate: (id: string) => void;
  onReorder: (id: string, toIndex: number) => void;
  onAddWorkspace: () => void;
  footer?: React.ReactNode; // account / model / settings chips
}): JSX.Element;

type WorkspaceCardModel = {
  id: string;
  title: string;
  pinned: boolean;
  entries: SidebarStatusEntry[];
  attention: { unread: boolean; flash: FlashAccent | null };
};
```

## Layout composition with `@tinker/panes`

Workspace sidebar is **outside** the pane workspace. Shell composition:

```
┌──────────────────────────────────────────────────────────┐
│ Titlebar                                                 │
├────────┬─────────────────────────────────────────────────┤
│        │ <Workspace /> from @tinker/panes                │
│ <WS    │   ┌─────────────────────────────────────────┐   │
│  side  │   │ TabStrip                                │   │
│  bar/> │   ├─────────────────────────────────────────┤   │
│        │   │ SplitTree                               │   │
│        │   │                                         │   │
│        │   └─────────────────────────────────────────┘   │
├────────┴─────────────────────────────────────────────────┤
│ Integrations strip                                       │
└──────────────────────────────────────────────────────────┘
```

## Follow-ups

- Drag a file from the vault into a workspace → opens as a pane in that workspace.
- Keyboard: `Cmd+1..9` activates workspace N.
- Pinned workspaces across devices (only when [[D18]] unblocks sync).

## Reference

- cmux `Sources/Workspace.swift` — card model, reorder settings, auxiliary detail visibility.
- cmux `Sources/SidebarSelectionState.swift` — selection state primitives.
- cmux `Sources/RightSidebarPanelView.swift` — opposite side, useful as reference for consistent card style.
