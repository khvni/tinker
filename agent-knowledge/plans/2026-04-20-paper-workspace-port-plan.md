# Paper → Tinker workspace port — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the seven Paper artboards in "Tinker Workspace" into the Tinker codebase at pixel parity in light mode (default) and dark mode, retiring `dockview-react`, adding Memory + Agents tab kinds, and introducing a headless `Dialog` primitive.

**Architecture:** Theme is a `localStorage` pref applied to `<html>[data-theme]` at boot. `@tinker/panes` replaces `dockview-react` as the sole layout engine. Window chrome (TitleBar, LeftRail, StatusDock) and pane chrome (PaneTabBar reskin, PreviewFrame, JumpToBottom) render as co-located component folders. Memory + Agents are new tab kinds rendered by modules under `apps/desktop/src/renderer/renderers/`. A single headless `Dialog` primitive in `packages/design` backs the RefreshModal and the `ask_user` overlay.

**Tech Stack:** TypeScript 5.6 strict, React 19, `@tinker/panes` (zustand-backed recursive split tree), Tauri v2, Vitest, Host Grotesk Variable, design tokens in `packages/design/src/styles/tokens.css`.

**Spec:** `agent-knowledge/specs/2026-04-20-paper-workspace-port-design.md`

---

## File structure

### Created

```
apps/desktop/src/renderer/theme.ts
apps/desktop/src/renderer/theme.test.ts
apps/desktop/src/renderer/workspace/tab-registry.ts          # replaces pane-registry.ts
apps/desktop/src/renderer/workspace/tab-data.ts              # discriminated union of per-kind data
apps/desktop/src/renderer/workspace/components/TitleBar/TitleBar.tsx
apps/desktop/src/renderer/workspace/components/TitleBar/TitleBar.css
apps/desktop/src/renderer/workspace/components/TitleBar/TitleBar.test.tsx
apps/desktop/src/renderer/workspace/components/TitleBar/index.ts
apps/desktop/src/renderer/workspace/components/LeftRail/LeftRail.tsx
apps/desktop/src/renderer/workspace/components/LeftRail/LeftRail.css
apps/desktop/src/renderer/workspace/components/LeftRail/LeftRail.test.tsx
apps/desktop/src/renderer/workspace/components/LeftRail/index.ts
apps/desktop/src/renderer/workspace/components/StatusDock/StatusDock.tsx
apps/desktop/src/renderer/workspace/components/StatusDock/StatusDock.css
apps/desktop/src/renderer/workspace/components/StatusDock/StatusDock.test.tsx
apps/desktop/src/renderer/workspace/components/StatusDock/index.ts
apps/desktop/src/renderer/workspace/components/PreviewFrame/PreviewFrame.tsx
apps/desktop/src/renderer/workspace/components/PreviewFrame/PreviewFrame.css
apps/desktop/src/renderer/workspace/components/PreviewFrame/PreviewFrame.test.tsx
apps/desktop/src/renderer/workspace/components/PreviewFrame/index.ts
apps/desktop/src/renderer/workspace/components/JumpToBottom/JumpToBottom.tsx
apps/desktop/src/renderer/workspace/components/JumpToBottom/JumpToBottom.css
apps/desktop/src/renderer/workspace/components/JumpToBottom/JumpToBottom.test.tsx
apps/desktop/src/renderer/workspace/components/JumpToBottom/index.ts
apps/desktop/src/renderer/workspace/components/PaneTabBar/PaneTabBar.css   # reskin stylesheet
apps/desktop/src/renderer/workspace/components/PaneTabBar/index.ts
packages/design/src/components/Dialog.tsx
packages/design/src/components/Dialog.css
packages/design/src/components/Dialog.test.tsx
apps/desktop/src/renderer/renderers/MemoryTab/MemoryTab.tsx
apps/desktop/src/renderer/renderers/MemoryTab/MemoryTab.css
apps/desktop/src/renderer/renderers/MemoryTab/MemoryTab.test.tsx
apps/desktop/src/renderer/renderers/MemoryTab/index.ts
apps/desktop/src/renderer/renderers/MemoryTab/MemorySidebar.tsx
apps/desktop/src/renderer/renderers/MemoryTab/MemoryDetail.tsx
apps/desktop/src/renderer/renderers/MemoryTab/RefreshModal.tsx
apps/desktop/src/renderer/renderers/MemoryTab/RefreshModal.test.tsx
apps/desktop/src/renderer/renderers/AgentsTab/AgentsTab.tsx
apps/desktop/src/renderer/renderers/AgentsTab/AgentsTab.css
apps/desktop/src/renderer/renderers/AgentsTab/AgentsTab.test.tsx
apps/desktop/src/renderer/renderers/AgentsTab/index.ts
apps/desktop/src/renderer/renderers/AgentsTab/AgentsSidebar.tsx
apps/desktop/src/renderer/renderers/AgentsTab/AgentsDetail.tsx
```

### Modified

```
apps/desktop/src/renderer/main.tsx                           # apply theme + drop dockview CSS import
apps/desktop/src/renderer/App.tsx                            # wire memory store + agents list through Workspace props
apps/desktop/src/renderer/workspace/Workspace.tsx            # swap engine, mount chrome, consume tab-registry
apps/desktop/src/renderer/workspace/chat-panels.ts           # use WorkspaceStore actions, not DockviewApi
apps/desktop/src/renderer/workspace/chat-panels.test.ts      # match new signature
apps/desktop/src/renderer/workspace/file-open.ts             # same
apps/desktop/src/renderer/workspace/file-open.test.ts        # same
apps/desktop/src/renderer/workspace/layout.default.ts        # emit WorkspaceState<TabData> default
apps/desktop/src/renderer/panes/Chat.tsx                     # signature (no IDockviewPanelProps), ask_user overlay
apps/desktop/src/renderer/panes/Playbook.tsx                     # signature
apps/desktop/src/renderer/panes/SchedulerPane.tsx            # signature
apps/desktop/src/renderer/panes/Settings.tsx                 # signature + consumes theme helper
apps/desktop/src/renderer/panes/Today.tsx                    # signature
apps/desktop/src/renderer/panes/VaultBrowser.tsx             # signature
apps/desktop/src/renderer/renderers/CodeRenderer.tsx         # signature
apps/desktop/src/renderer/renderers/CsvRenderer.tsx          # signature
apps/desktop/src/renderer/renderers/HtmlRenderer.tsx         # signature
apps/desktop/src/renderer/renderers/ImageRenderer.tsx        # signature
apps/desktop/src/renderer/renderers/MarkdownEditor.tsx       # signature
apps/desktop/src/renderer/renderers/MarkdownRenderer.tsx     # signature
apps/desktop/package.json                                    # drop dockview-react
packages/design/src/components/index.ts                      # export Dialog
packages/design/src/components/Button.css                    # token swap
packages/design/src/components/IconButton.css                # token swap
packages/design/src/components/Toggle.css                    # token swap
packages/design/src/components/SegmentedControl.css          # token swap
packages/design/src/styles/tokens.css                        # add --color-error-strong-soft, --shadow-sm, --color-toggle-knob-* only if a swap demands it
packages/shared-types/src/layout.ts                          # PaneKind → TabKind; LayoutState.version=2, workspaceState
apps/desktop/src/renderer/styles.css                         # delete obsolete dockview-specific rules
CLAUDE.md                                                    # component tree + theme plumbing note
AGENTS.md                                                    # same
agent-knowledge/product/decisions.md                         # append D24 noting D16 cutover landed
agent-knowledge/context/tasks.md                             # update feature 10 + related statuses
```

### Deleted

```
apps/desktop/src/renderer/workspace/DockviewContext.ts
apps/desktop/src/renderer/workspace/pane-registry.ts         # replaced by tab-registry.ts
```

---

## Phase 1 — theme plumbing, color fixes, rename

### Task 1.1: Failing test for `theme.ts`

**Files:**
- Create: `apps/desktop/src/renderer/theme.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, test } from 'vitest';
import { applyTheme, readTheme, writeTheme, type Theme } from './theme.js';

const THEMES: ReadonlyArray<Theme> = ['light', 'dark'];

describe('theme helper', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  test('readTheme returns null when unset', () => {
    expect(readTheme()).toBeNull();
  });

  test('writeTheme persists + readTheme returns the written value', () => {
    for (const theme of THEMES) {
      writeTheme(theme);
      expect(readTheme()).toBe(theme);
    }
  });

  test('readTheme ignores garbage values', () => {
    window.localStorage.setItem('tinker.theme', 'banana');
    expect(readTheme()).toBeNull();
  });

  test('applyTheme sets [data-theme] on <html>', () => {
    applyTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    applyTheme('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tinker/desktop test -- theme.test.ts`
Expected: FAIL with "Cannot find module './theme.js'".

### Task 1.2: Implement `theme.ts`

**Files:**
- Create: `apps/desktop/src/renderer/theme.ts`

- [ ] **Step 1: Write the module**

```ts
const STORAGE_KEY = 'tinker.theme';

export type Theme = 'light' | 'dark';

const isTheme = (value: unknown): value is Theme => {
  return value === 'light' || value === 'dark';
};

export const readTheme = (): Theme | null => {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return isTheme(raw) ? raw : null;
};

export const writeTheme = (theme: Theme): void => {
  window.localStorage.setItem(STORAGE_KEY, theme);
};

export const applyTheme = (theme: Theme): void => {
  document.documentElement.dataset.theme = theme;
};
```

- [ ] **Step 2: Run test to verify it passes**

Run: `pnpm --filter @tinker/desktop test -- theme.test.ts`
Expected: PASS all four cases.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/renderer/theme.ts apps/desktop/src/renderer/theme.test.ts
git commit -m "feat(desktop): add theme helper backed by localStorage"
```

### Task 1.3: Apply theme at boot + drop dockview CSS import

**Files:**
- Modify: `apps/desktop/src/renderer/main.tsx`

- [ ] **Step 1: Apply the diff**

Replace the file contents with:

```tsx
import { StrictMode, Suspense, lazy, type JSX } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/host-grotesk';
import { App } from './App.js';
import { applyTheme, readTheme } from './theme.js';
import './styles.css';

applyTheme(readTheme() ?? 'light');

const container = document.getElementById('root');
if (!container) {
  throw new Error('root element missing');
}

const route = new URLSearchParams(window.location.search).get('route');

const DesignSystem = lazy(() => import('./routes/design-system.js').then((m) => ({ default: m.DesignSystem })));
const PanesDemo = lazy(() => import('./routes/panes-demo.js').then((m) => ({ default: m.PanesDemo })));

const renderRoute = (): JSX.Element => {
  if (route === 'design-system') {
    return (
      <Suspense fallback={null}>
        <DesignSystem />
      </Suspense>
    );
  }
  if (route === 'panes-demo') {
    return (
      <Suspense fallback={null}>
        <PanesDemo />
      </Suspense>
    );
  }
  return <App />;
};

createRoot(container).render(<StrictMode>{renderRoute()}</StrictMode>);
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/renderer/main.tsx
git commit -m "feat(desktop): apply theme attribute at boot; drop dockview css import"
```

### Task 1.4: Fix Button + IconButton danger hover hex

**Files:**
- Modify: `packages/design/src/components/Button.css:91`
- Modify: `packages/design/src/components/IconButton.css:88`

- [ ] **Step 1: Replace the hardcoded danger hover**

In `packages/design/src/components/Button.css`, change:

```css
.tk-button--danger:hover:not(.tk-button--disabled) {
  background: rgba(239, 68, 68, 0.28);
}
```

to:

```css
.tk-button--danger:hover:not(.tk-button--disabled) {
  background: var(--color-error-soft);
  filter: brightness(1.08);
}
```

In `packages/design/src/components/IconButton.css`, make the same substitution for the `.tk-icon-button--danger:hover` rule at line 88.

- [ ] **Step 2: Verify design-system route**

Run: `pnpm --filter @tinker/desktop dev` then open `http://localhost:1420/?route=design-system` (port per the project's dev config). Confirm danger-variant button hover is still a visible red wash in light mode (default) and dark mode (set `document.documentElement.dataset.theme = 'dark'` in devtools). Stop the dev server after visual QA.

- [ ] **Step 3: Commit**

```bash
git add packages/design/src/components/Button.css packages/design/src/components/IconButton.css
git commit -m "fix(design): route danger hover through --color-error-soft"
```

### Task 1.5: Fix Toggle knob + track alphas

**Files:**
- Modify: `packages/design/src/components/Toggle.css`
- Modify: `packages/design/src/styles/tokens.css`

- [ ] **Step 1: Add three theme-aware tokens**

Append to the `:root` block of `packages/design/src/styles/tokens.css` before the closing `}`:

```css
  /* toggle primitive */
  --color-toggle-knob: #ffffff;
  --color-toggle-track-off: rgba(26, 22, 18, 0.08);
  --color-toggle-track-border: var(--color-border-subtle);
  --shadow-toggle-knob: 0 1px 2px rgba(26, 22, 18, 0.18);
```

Append to the `[data-theme="dark"]` block before the closing `}`:

```css
  /* toggle primitive */
  --color-toggle-knob: rgba(255, 255, 255, 0.72);
  --color-toggle-track-off: rgba(255, 240, 220, 0.06);
  --color-toggle-track-border: var(--color-border-subtle);
  --shadow-toggle-knob: 0 1px 2px rgba(0, 0, 0, 0.35);
```

- [ ] **Step 2: Rewrite `Toggle.css` to read tokens**

Open `packages/design/src/components/Toggle.css`. Replace every occurrence of the local `--toggle-*` variables on `.tk-toggle` and `.tk-toggle--on` / `.tk-toggle--off` selectors with the new tokens. Concretely, replace lines 1 through 60 (the entire current variable + structural CSS) with:

```css
.tk-toggle {
  --toggle-knob-bg: var(--color-toggle-knob);
  --toggle-on-bg: var(--color-accent-soft);
  --toggle-off-bg: var(--color-toggle-track-off);
  --toggle-off-border: var(--color-toggle-track-border);

  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  width: 32px;
  height: 18px;
  padding: 2px;
  border-radius: var(--radius-pill);
  background: var(--toggle-off-bg);
  border: 1px solid var(--toggle-off-border);
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease-standard),
    border-color var(--duration-fast) var(--ease-standard);
}

.tk-toggle__knob {
  width: 12px;
  height: 12px;
  border-radius: var(--radius-pill);
  background: var(--toggle-knob-bg);
  box-shadow: var(--shadow-toggle-knob);
  transition: transform var(--duration-fast) var(--ease-standard);
}

.tk-toggle--on {
  background: var(--toggle-on-bg);
  border-color: var(--color-accent-ring);
}

.tk-toggle--on .tk-toggle__knob {
  transform: translateX(14px);
  background: var(--color-accent);
}

.tk-toggle--disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
```

- [ ] **Step 3: Visual QA in both themes**

Run: `pnpm --filter @tinker/desktop dev`. Open `?route=design-system`. Confirm Toggle primitive off-state reads as a subtle track in light mode and as a near-black track in dark mode. Knob stays white in light; desaturated white in dark.

- [ ] **Step 4: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/design/src/components/Toggle.css packages/design/src/styles/tokens.css
git commit -m "fix(design): route Toggle colors through tokens"
```

### Task 1.6: Fix SegmentedControl shadow

**Files:**
- Modify: `packages/design/src/components/SegmentedControl.css:33`
- Modify: `packages/design/src/styles/tokens.css`

- [ ] **Step 1: Add `--shadow-sm` to both theme blocks**

Append to `:root` in `packages/design/src/styles/tokens.css`:

```css
  --shadow-sm: 0 1px 2px rgba(26, 22, 18, 0.08);
```

Append to `[data-theme="dark"]`:

```css
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
```

- [ ] **Step 2: Swap the literal shadow**

In `packages/design/src/components/SegmentedControl.css:33`, replace:

```css
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
```

with:

```css
  box-shadow: var(--shadow-sm);
```

- [ ] **Step 3: Commit**

```bash
git add packages/design/src/components/SegmentedControl.css packages/design/src/styles/tokens.css
git commit -m "fix(design): token-ise SegmentedControl shadow"
```

### Task 1.7: Rename `PaneKind` → `TabKind`

**Files:**
- Modify: `packages/shared-types/src/layout.ts`
- Modify: every call site found by grep (see step 1)

- [ ] **Step 1: Identify call sites**

Run: `rg "PaneKind" --type ts --type tsx`
Expected: one definition in `packages/shared-types/src/layout.ts` and a handful of imports in `apps/desktop/src/renderer/workspace/`.

- [ ] **Step 2: Rename the type**

In `packages/shared-types/src/layout.ts`, change the type declaration:

```ts
export type TabKind =
  | 'vault-browser'
  | 'chat'
  | 'today'
  | 'scheduler'
  | 'settings'
  | 'playbook'
  | 'markdown-editor'
  | 'file'
  | 'markdown'
  | 'html'
  | 'csv'
  | 'image'
  | 'code';
```

- [ ] **Step 3: Update importers**

Run: `rg "PaneKind" --files-with-matches` and for each result replace `PaneKind` with `TabKind`. Typical pattern:

```ts
-import type { PaneKind } from '@tinker/shared-types';
+import type { TabKind } from '@tinker/shared-types';
```

- [ ] **Step 4: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared-types/src/layout.ts apps/desktop/src/renderer/workspace/
git commit -m "refactor(shared-types): rename PaneKind to TabKind"
```

### Task 1.8: Snapshot design-system route in both themes

**Files:**
- None (manual verification + commit none).

- [ ] **Step 1: Boot the design-system route**

Run: `pnpm --filter @tinker/desktop dev`. Open `?route=design-system`.

- [ ] **Step 2: Compare against Paper tokens**

Using Paper: open artboards `9J-0` (Tinker Tokens — Light) and `6M-0` (Tinker Tokens — v1). Compare each swatch and primitive by eye. Expected deltas: none. If a token drifts, fix tokens.css in a follow-up commit before moving to Phase 2.

- [ ] **Step 3: Close the phase**

Run: `pnpm typecheck && pnpm test`
Expected: PASS.

---

## Phase 2 — `@tinker/panes` cutover + window/pane chrome

### Task 2.1: Define `TabData` union

**Files:**
- Create: `apps/desktop/src/renderer/workspace/tab-data.ts`

- [ ] **Step 1: Write the union**

```ts
import type { MemoryStore, ScheduledJobStore, SkillStore, TabKind } from '@tinker/shared-types';
import type { MCPStatus } from '../components/IntegrationsStrip.js';
import type { OpencodeConnection } from '../../bindings.js';

export type ChatTabData = {
  readonly kind: 'chat';
  readonly sessionId?: string;
};

export type VaultBrowserTabData = {
  readonly kind: 'vault-browser';
};

export type TodayTabData = {
  readonly kind: 'today';
};

export type SchedulerTabData = {
  readonly kind: 'scheduler';
};

export type SettingsTabData = {
  readonly kind: 'settings';
};

export type PlaybookTabData = {
  readonly kind: 'playbook';
};

export type FileTabData = {
  readonly kind: 'file' | 'markdown' | 'html' | 'csv' | 'image' | 'code' | 'markdown-editor';
  readonly filePath: string;
};

export type MemoryTabData = {
  readonly kind: 'memory';
  readonly entityId?: string;
};

export type AgentTabData = {
  readonly kind: 'agent';
  readonly agentId?: string;
};

export type TabData =
  | ChatTabData
  | VaultBrowserTabData
  | TodayTabData
  | SchedulerTabData
  | SettingsTabData
  | PlaybookTabData
  | FileTabData
  | MemoryTabData
  | AgentTabData;

export type TabDataForKind<K extends TabKind | 'memory' | 'agent'> = Extract<TabData, { kind: K }>;
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/renderer/workspace/tab-data.ts
git commit -m "feat(desktop): add TabData union for @tinker/panes cutover"
```

### Task 2.2: Replace `pane-registry.ts` with `tab-registry.ts`

**Files:**
- Create: `apps/desktop/src/renderer/workspace/tab-registry.ts`
- Delete: `apps/desktop/src/renderer/workspace/pane-registry.ts`

- [ ] **Step 1: Write the new registry builder**

```ts
import type { PaneDefinition, PaneRegistry } from '@tinker/panes';
import type { TabData } from './tab-data.js';

export type TabRegistry = PaneRegistry<TabData>;

export const createTabRegistry = (definitions: ReadonlyArray<PaneDefinition<TabData>>): TabRegistry => {
  const registry: Record<string, PaneDefinition<TabData>> = {};
  for (const definition of definitions) {
    registry[definition.kind] = definition;
  }
  return registry;
};
```

- [ ] **Step 2: Remove the obsolete file**

Run: `git rm apps/desktop/src/renderer/workspace/pane-registry.ts`

- [ ] **Step 3: Run typecheck**

Expect failures in `Workspace.tsx` referencing `createPaneRegistry` or `IDockviewPanelProps`. They resolve in Task 2.5.

- [ ] **Step 4: Commit (staging only; typecheck still red)**

Do NOT commit yet. Staging this task's changes alongside Task 2.5 keeps the tree typecheck-clean at each commit boundary.

### Task 2.3: Update `LayoutState` to version 2

**Files:**
- Modify: `packages/shared-types/src/layout.ts`

- [ ] **Step 1: Replace `LayoutState`**

In `packages/shared-types/src/layout.ts`, replace the `LayoutState` type:

```ts
import type { WorkspaceState } from '@tinker/panes';

export type LayoutState = {
  version: 2;
  workspaceState: WorkspaceState<unknown>;
  updatedAt: string;
  preferences: WorkspacePreferences;
};
```

Add `@tinker/panes` to the package's dependencies in `packages/shared-types/package.json` (`"@tinker/panes": "workspace:*"`) if it is not already present.

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @tinker/shared-types typecheck`
Expected: PASS.

- [ ] **Step 3: Hold the commit**

Stage but do not commit until Task 2.5 runs.

### Task 2.4: Rewrite `layout.default.ts`

**Files:**
- Modify: `apps/desktop/src/renderer/workspace/layout.default.ts`

- [ ] **Step 1: Open the current file**

Read: `apps/desktop/src/renderer/workspace/layout.default.ts` to capture the Dockview default-layout intent (it currently calls `api.addPanel` repeatedly).

- [ ] **Step 2: Replace with a `WorkspaceState<TabData>` factory**

Rewrite the module as:

```ts
import type { WorkspaceState } from '@tinker/panes';
import type { TabData } from './tab-data.js';

const newId = (prefix: string): string => `${prefix}-${crypto.randomUUID()}`;

type DefaultLayoutInput = {
  readonly vaultPath: string | null;
};

export const createDefaultWorkspaceState = ({ vaultPath }: DefaultLayoutInput): WorkspaceState<TabData> => {
  const chatPaneId = newId('pane');
  const stackId = newId('stack');
  const vaultPaneId = newId('pane');
  const vaultStackId = newId('stack');
  const tabId = newId('tab');

  const panes: Record<string, { id: string; kind: string; title?: string; data: TabData }> = {
    [chatPaneId]: { id: chatPaneId, kind: 'chat', title: 'Chat', data: { kind: 'chat' } },
  };

  if (vaultPath) {
    panes[vaultPaneId] = { id: vaultPaneId, kind: 'vault-browser', title: 'Vault', data: { kind: 'vault-browser' } };
  }

  const layout = vaultPath
    ? {
        kind: 'split' as const,
        id: newId('split'),
        orientation: 'row' as const,
        ratio: 0.28,
        a: {
          kind: 'stack' as const,
          id: vaultStackId,
          paneIds: [vaultPaneId],
          activePaneId: vaultPaneId,
        },
        b: {
          kind: 'stack' as const,
          id: stackId,
          paneIds: [chatPaneId],
          activePaneId: chatPaneId,
        },
      }
    : {
        kind: 'stack' as const,
        id: stackId,
        paneIds: [chatPaneId],
        activePaneId: chatPaneId,
      };

  return {
    version: 2,
    tabs: [
      {
        id: tabId,
        title: 'Workspace',
        createdAt: Date.now(),
        layout,
        panes,
        activePaneId: vaultPath ? vaultPaneId : chatPaneId,
        activeStackId: vaultPath ? vaultStackId : stackId,
      },
    ],
    activeTabId: tabId,
  };
};
```

- [ ] **Step 3: Hold commit**

Staged, not committed yet; lands with Task 2.5.

### Task 2.5: Swap `Workspace.tsx` to `@tinker/panes`

**Files:**
- Modify: `apps/desktop/src/renderer/workspace/Workspace.tsx`

- [ ] **Step 1: Replace the file**

Rewrite `Workspace.tsx` so that:

1. It imports `Workspace as PanesWorkspace, createWorkspaceStore, selectWorkspaceSnapshot` from `@tinker/panes` and no longer imports any `dockview-react` symbols, `DockviewContext`, or `createPaneRegistry`.
2. It builds a single `useMemo`-wrapped `registry: TabRegistry` array using `createTabRegistry` with one `PaneDefinition<TabData>` entry per existing kind. Each entry's `render` receives `PaneRendererProps<TabData>` and passes kind-appropriate data and app-level props into the current renderer component.
3. It creates one `WorkspaceStore<TabData>` via `createWorkspaceStore<TabData>({ initial: hydratedState ?? createDefaultWorkspaceState({ vaultPath }) })`. Hydration: on mount, call `layoutStore.load(DEFAULT_USER_ID)`; if the snapshot's `version === 2`, invoke `store.getState().actions.hydrate(snapshot.workspaceState as WorkspaceState<TabData>)`; otherwise the store already holds the default.
4. It subscribes to store changes via `store.subscribe(() => scheduleSave())` and calls `layoutStore.save(DEFAULT_USER_ID, { version: 2, workspaceState: selectWorkspaceSnapshot(store.getState()), updatedAt: new Date().toISOString(), preferences: workspacePreferencesRef.current })` with a 300 ms debounce, matching the previous cadence.
5. It renders:

   ```tsx
   <div className="tinker-workspace-shell">
     <TitleBar {...titleBarProps} />
     <div className="tinker-workspace-body">
       <LeftRail {...leftRailProps} />
       <PanesWorkspace store={store} registry={registry} ariaLabel="Tinker workspace" />
     </div>
   </div>
   ```

   `TitleBar`, `LeftRail`, `StatusDock` imports are added in Tasks 2.10–2.12.
6. It exposes helpers `openNewChatPane`, `openTodayPane`, `openSchedulerPane`, `openSettingsPane`, `openOrFocusPane(kind, title)` that call `store.getState().actions.addPane(activeTabId, { id, kind, data, title })` — sourcing `activeTabId` from `store.getState().activeTabId` (or calling `actions.openTab(...)` if none exists yet). Kinds that should dedupe (settings, today, scheduler) first scan the active tab's `panes` map for an existing entry of that kind and call `actions.focusPane(activeTabId, existingPane.id)` instead of adding a second one.

Because this file already runs to ~530 lines, the rewrite replaces it wholesale. Use the existing file as the source of intent for prop-passing into each renderer; the only structural change is the registry shape and the engine swap.

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS (assuming Tasks 2.1–2.4 + 2.6–2.9 are staged).

- [ ] **Step 3: Commit the engine swap**

```bash
git add apps/desktop/src/renderer/workspace/Workspace.tsx \
        apps/desktop/src/renderer/workspace/tab-registry.ts \
        apps/desktop/src/renderer/workspace/layout.default.ts \
        apps/desktop/src/renderer/workspace/tab-data.ts \
        packages/shared-types/src/layout.ts \
        packages/shared-types/package.json
git rm apps/desktop/src/renderer/workspace/pane-registry.ts
git commit -m "refactor(desktop): swap Workspace engine to @tinker/panes"
```

### Task 2.6: Rewrite `chat-panels.ts`

**Files:**
- Modify: `apps/desktop/src/renderer/workspace/chat-panels.ts`
- Modify: `apps/desktop/src/renderer/workspace/chat-panels.test.ts`

- [ ] **Step 1: Update the module surface**

```ts
import type { WorkspaceStore } from '@tinker/panes';
import type { TabData } from './tab-data.js';

export const openNewChatPanel = (store: WorkspaceStore<TabData>): void => {
  const state = store.getState();
  const activeTabId = state.activeTabId;
  if (!activeTabId) return;
  state.actions.addPane(
    activeTabId,
    {
      id: `pane-${crypto.randomUUID()}`,
      kind: 'chat',
      title: 'Chat',
      data: { kind: 'chat' },
    },
    { activate: true },
  );
};
```

- [ ] **Step 2: Update its test**

Rewrite `chat-panels.test.ts` to construct a store via `createWorkspaceStore({ initialState: createDefaultWorkspaceState({ vaultPath: null }) })`, invoke `openNewChatPanel(store)`, and assert that a new chat pane exists in the active stack.

- [ ] **Step 3: Run the test**

Run: `pnpm --filter @tinker/desktop test -- chat-panels.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/renderer/workspace/chat-panels.ts \
        apps/desktop/src/renderer/workspace/chat-panels.test.ts
git commit -m "refactor(desktop): port chat-panels helpers to @tinker/panes store"
```

### Task 2.7: Rewrite `file-open.ts`

**Files:**
- Modify: `apps/desktop/src/renderer/workspace/file-open.ts`
- Modify: `apps/desktop/src/renderer/workspace/file-open.test.ts`

- [ ] **Step 1: Update the module**

```ts
import type { WorkspaceStore } from '@tinker/panes';
import type { TabData } from './tab-data.js';
import { isAbsolutePath } from '../renderers/file-utils.js';

type FileKind = Extract<TabData, { filePath: string }>['kind'];

const kindFromPath = (absolutePath: string): FileKind => {
  if (absolutePath.endsWith('.md')) return 'markdown';
  if (absolutePath.endsWith('.html') || absolutePath.endsWith('.htm')) return 'html';
  if (absolutePath.endsWith('.csv')) return 'csv';
  if (absolutePath.endsWith('.png') || absolutePath.endsWith('.jpg') || absolutePath.endsWith('.jpeg') || absolutePath.endsWith('.gif') || absolutePath.endsWith('.webp')) return 'image';
  if (absolutePath.endsWith('.ts') || absolutePath.endsWith('.tsx') || absolutePath.endsWith('.js') || absolutePath.endsWith('.json')) return 'code';
  return 'file';
};

export const openWorkspaceFile = (store: WorkspaceStore<TabData>, absolutePath: string): void => {
  if (!isAbsolutePath(absolutePath)) return;
  const state = store.getState();
  const activeTabId = state.activeTabId;
  if (!activeTabId) return;
  const kind = kindFromPath(absolutePath);
  state.actions.addPane(
    activeTabId,
    {
      id: `pane-${crypto.randomUUID()}`,
      kind,
      title: absolutePath.split('/').pop() ?? absolutePath,
      data: { kind, filePath: absolutePath },
    },
    { activate: true },
  );
};
```

- [ ] **Step 2: Update the test**

Rewrite `file-open.test.ts` to build a store, open a markdown path, and assert a new pane of kind `'markdown'` with `data.filePath` set.

- [ ] **Step 3: Run the test**

Run: `pnpm --filter @tinker/desktop test -- file-open.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/renderer/workspace/file-open.ts \
        apps/desktop/src/renderer/workspace/file-open.test.ts
git commit -m "refactor(desktop): port openWorkspaceFile to @tinker/panes store"
```

### Task 2.8: Update each renderer's signature

**Files:**
- Modify: `apps/desktop/src/renderer/panes/Chat.tsx`
- Modify: `apps/desktop/src/renderer/panes/Playbook.tsx`
- Modify: `apps/desktop/src/renderer/panes/SchedulerPane.tsx`
- Modify: `apps/desktop/src/renderer/panes/Settings.tsx`
- Modify: `apps/desktop/src/renderer/panes/Today.tsx`
- Modify: `apps/desktop/src/renderer/panes/VaultBrowser.tsx`
- Modify: `apps/desktop/src/renderer/renderers/CodeRenderer.tsx`
- Modify: `apps/desktop/src/renderer/renderers/CsvRenderer.tsx`
- Modify: `apps/desktop/src/renderer/renderers/HtmlRenderer.tsx`
- Modify: `apps/desktop/src/renderer/renderers/ImageRenderer.tsx`
- Modify: `apps/desktop/src/renderer/renderers/MarkdownEditor.tsx`
- Modify: `apps/desktop/src/renderer/renderers/MarkdownRenderer.tsx`

For each file:

- [ ] **Step 1: Remove Dockview imports**

Drop every `IDockviewPanelProps` import and any `api.setTitle`, `params.*` calls. Replace with plain React props + any store passed in from `Workspace.tsx`. File-bound renderers read `filePath` from their new `data` prop.

- [ ] **Step 2: Typecheck after each file**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit per renderer**

Create one commit per renderer with the scope `refactor(desktop)` and a message of the form `port <renderer> to @tinker/panes renderer shape`. Twelve commits total, each small.

### Task 2.9: Delete `DockviewContext.ts`

**Files:**
- Delete: `apps/desktop/src/renderer/workspace/DockviewContext.ts`

- [ ] **Step 1: Remove the file**

Run: `git rm apps/desktop/src/renderer/workspace/DockviewContext.ts`

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS (no remaining consumers — Task 2.5 already dropped the provider).

- [ ] **Step 3: Commit**

```bash
git commit -m "refactor(desktop): delete DockviewContext"
```

### Task 2.10: `TitleBar` component

**Files:**
- Create: `apps/desktop/src/renderer/workspace/components/TitleBar/TitleBar.tsx`
- Create: `apps/desktop/src/renderer/workspace/components/TitleBar/TitleBar.css`
- Create: `apps/desktop/src/renderer/workspace/components/TitleBar/TitleBar.test.tsx`
- Create: `apps/desktop/src/renderer/workspace/components/TitleBar/index.ts`

- [ ] **Step 1: Pull the JSX + computed styles from Paper**

Using `/paper-desktop:design-to-code` on node `9K-0` (and its children: `TrafficLights 9L-0`, `Text 9P-0 "Tinker"`, `WindowActions 9Q-0` with SVGs `9R-0` + `9U-0`), capture structural layout. Cross-check the dark variant against `1-0`'s TitleBar child (identical structure, only tokens swap).

- [ ] **Step 2: Write the failing render test**

`TitleBar.test.tsx`:

```tsx
import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TitleBar } from './TitleBar.js';

describe('TitleBar', () => {
  test('shows the "Tinker" label and the theme toggle', () => {
    render(<TitleBar theme="light" onToggleTheme={() => {}} />);
    expect(screen.getByText('Tinker')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /toggle theme/i })).toBeInTheDocument();
  });

  test('clicking the theme toggle invokes the handler', async () => {
    const calls: ReadonlyArray<'light' | 'dark'>[] = [];
    const onToggle = (next: 'light' | 'dark'): void => {
      calls.push([next]);
    };
    const { rerender } = render(<TitleBar theme="light" onToggleTheme={onToggle} />);
    screen.getByRole('button', { name: /toggle theme/i }).click();
    expect(calls).toEqual([['dark']]);
    rerender(<TitleBar theme="dark" onToggleTheme={onToggle} />);
    screen.getByRole('button', { name: /toggle theme/i }).click();
    expect(calls).toEqual([['dark'], ['light']]);
  });
});
```

- [ ] **Step 3: Implement `TitleBar.tsx`**

```tsx
import type { JSX } from 'react';
import { IconButton } from '@tinker/design';
import './TitleBar.css';

export type TitleBarTheme = 'light' | 'dark';

export type TitleBarProps = {
  readonly theme: TitleBarTheme;
  readonly onToggleTheme: (next: TitleBarTheme) => void;
};

const SunIcon = (): JSX.Element => (
  <svg viewBox="0 0 16 16" aria-hidden>
    <circle cx="8" cy="8" r="3" fill="currentColor" />
    <g stroke="currentColor" strokeLinecap="round">
      <line x1="8" y1="1" x2="8" y2="3" />
      <line x1="8" y1="13" x2="8" y2="15" />
      <line x1="1" y1="8" x2="3" y2="8" />
      <line x1="13" y1="8" x2="15" y2="8" />
      <line x1="3" y1="3" x2="4.5" y2="4.5" />
      <line x1="11.5" y1="11.5" x2="13" y2="13" />
      <line x1="3" y1="13" x2="4.5" y2="11.5" />
      <line x1="11.5" y1="4.5" x2="13" y2="3" />
    </g>
  </svg>
);

const MoonIcon = (): JSX.Element => (
  <svg viewBox="0 0 16 16" aria-hidden>
    <path d="M13 10.5A6 6 0 0 1 5.5 3 6 6 0 1 0 13 10.5Z" fill="currentColor" />
  </svg>
);

export const TitleBar = ({ theme, onToggleTheme }: TitleBarProps): JSX.Element => {
  const next = theme === 'light' ? 'dark' : 'light';
  return (
    <header className="tk-titlebar" data-tauri-drag-region>
      <div className="tk-titlebar__traffic" aria-hidden />
      <div className="tk-titlebar__label">Tinker</div>
      <div className="tk-titlebar__actions">
        <IconButton variant="ghost" size="s" aria-label="Toggle theme" onClick={() => onToggleTheme(next)}>
          {theme === 'light' ? <MoonIcon /> : <SunIcon />}
        </IconButton>
      </div>
    </header>
  );
};
```

- [ ] **Step 4: Write `TitleBar.css`**

```css
.tk-titlebar {
  display: grid;
  grid-template-columns: 68px 1fr 68px;
  align-items: center;
  height: 36px;
  padding: 0 var(--space-3);
  background: var(--color-bg-elevated);
  border-bottom: 1px solid var(--color-border-subtle);
  color: var(--color-text-primary);
  font-family: var(--font-sans);
}

.tk-titlebar__traffic {
  width: 68px;
  height: 12px;
  /* traffic-light placeholders are rendered by the OS on macOS; keep spacing */
}

.tk-titlebar__label {
  text-align: center;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  letter-spacing: var(--letter-spacing-label);
}

.tk-titlebar__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-1);
}
```

- [ ] **Step 5: Write `index.ts`**

```ts
export { TitleBar } from './TitleBar.js';
export type { TitleBarProps, TitleBarTheme } from './TitleBar.js';
```

- [ ] **Step 6: Run the test**

Run: `pnpm --filter @tinker/desktop test -- TitleBar.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/renderer/workspace/components/TitleBar/
git commit -m "feat(desktop): add TitleBar with theme toggle per Paper 9K-0"
```

### Task 2.11: `LeftRail` component

**Files:**
- Create: `apps/desktop/src/renderer/workspace/components/LeftRail/LeftRail.tsx`
- Create: `apps/desktop/src/renderer/workspace/components/LeftRail/LeftRail.css`
- Create: `apps/desktop/src/renderer/workspace/components/LeftRail/LeftRail.test.tsx`
- Create: `apps/desktop/src/renderer/workspace/components/LeftRail/index.ts`

- [ ] **Step 1: Pull JSX + computed styles from Paper**

Nodes: `9Y-0 LeftRail`, its children `9Z-0 RailTop`, `B0-0 RailBottom`, each `RailItem-*` glyph. Also fetch `get_fill_image` for any icon raster fills so we can mirror them via inline SVG or `<img>` — prefer inline SVG.

- [ ] **Step 2: Write the failing test**

```tsx
import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LeftRail } from './LeftRail.js';

describe('LeftRail', () => {
  test('renders each section label as an accessible button', () => {
    const items = ['Workspaces', 'Explorer', 'Chats', 'Skills', 'Agents', 'Connections', 'Memory'] as const;
    render(<LeftRail activeId="workspaces" onSelect={() => {}} />);
    for (const label of items) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  test('invokes onSelect with the railItem id', () => {
    const calls: string[] = [];
    render(<LeftRail activeId="workspaces" onSelect={(id) => calls.push(id)} />);
    screen.getByRole('button', { name: 'Agents' }).click();
    expect(calls).toEqual(['agents']);
  });
});
```

- [ ] **Step 3: Implement `LeftRail.tsx`**

```tsx
import type { JSX, ReactNode } from 'react';
import './LeftRail.css';

export type LeftRailId =
  | 'workspaces'
  | 'explorer'
  | 'chats'
  | 'skills'
  | 'agents'
  | 'connections'
  | 'memory'
  | 'new-tab'
  | 'playbook'
  | 'analytics'
  | 'settings'
  | 'avatar';

export type LeftRailProps = {
  readonly activeId: LeftRailId;
  readonly onSelect: (id: LeftRailId) => void;
};

const TOP: ReadonlyArray<{ id: LeftRailId; label: string; icon: ReactNode }> = [
  { id: 'workspaces', label: 'Workspaces', icon: <RailIcon glyph="grid" /> },
  { id: 'explorer', label: 'Explorer', icon: <RailIcon glyph="folder" /> },
  { id: 'chats', label: 'Chats', icon: <RailIcon glyph="chat" /> },
  { id: 'skills', label: 'Skills', icon: <RailIcon glyph="sparkle" /> },
  { id: 'agents', label: 'Agents', icon: <RailIcon glyph="robot" /> },
  { id: 'connections', label: 'Connections', icon: <RailIcon glyph="plug" /> },
  { id: 'memory', label: 'Memory', icon: <RailIcon glyph="brain" /> },
];

const BOTTOM: ReadonlyArray<{ id: LeftRailId; label: string; icon: ReactNode }> = [
  { id: 'playbook', label: 'Playbook', icon: <RailIcon glyph="playbook" /> },
  { id: 'analytics', label: 'Analytics', icon: <RailIcon glyph="chart" /> },
  { id: 'settings', label: 'Settings', icon: <RailIcon glyph="gear" /> },
  { id: 'avatar', label: 'Avatar', icon: <RailIcon glyph="avatar" /> },
];

export const LeftRail = ({ activeId, onSelect }: LeftRailProps): JSX.Element => {
  return (
    <nav className="tk-leftrail" aria-label="Workspace navigation">
      <div className="tk-leftrail__top">
        {TOP.map((item) => (
          <RailButton key={item.id} {...item} active={activeId === item.id} onSelect={onSelect} />
        ))}
        <RailDivider />
        <RailButton id="new-tab" label="New tab" icon={<RailIcon glyph="plus" />} active={false} onSelect={onSelect} />
      </div>
      <div className="tk-leftrail__bottom">
        {BOTTOM.map((item) => (
          <RailButton key={item.id} {...item} active={activeId === item.id} onSelect={onSelect} />
        ))}
      </div>
    </nav>
  );
};

type RailButtonProps = {
  readonly id: LeftRailId;
  readonly label: string;
  readonly icon: ReactNode;
  readonly active: boolean;
  readonly onSelect: (id: LeftRailId) => void;
};

const RailButton = ({ id, label, icon, active, onSelect }: RailButtonProps): JSX.Element => (
  <button
    type="button"
    className={`tk-leftrail__item${active ? ' tk-leftrail__item--active' : ''}`}
    aria-label={label}
    aria-current={active ? 'page' : undefined}
    onClick={() => onSelect(id)}
  >
    {icon}
  </button>
);

const RailDivider = (): JSX.Element => <div className="tk-leftrail__divider" aria-hidden />;

const RailIcon = ({ glyph }: { readonly glyph: string }): JSX.Element => {
  // One inline SVG per glyph id; keep simple geometric shapes matching the Paper icons at 16×16.
  // Each SVG is hand-authored to match the artboard; implementation detail — see Paper 9Y-0.
  switch (glyph) {
    case 'grid':
      return <svg viewBox="0 0 16 16" width="16" height="16"><rect x="2" y="2" width="5" height="5" fill="currentColor"/><rect x="9" y="2" width="5" height="5" fill="currentColor"/><rect x="2" y="9" width="5" height="5" fill="currentColor"/><rect x="9" y="9" width="5" height="5" fill="currentColor"/></svg>;
    case 'folder':
      return <svg viewBox="0 0 16 16" width="16" height="16"><path d="M2 4h4l1 1.5h7V12H2z" fill="currentColor"/></svg>;
    case 'chat':
      return <svg viewBox="0 0 16 16" width="16" height="16"><path d="M2 3h12v8H6l-4 3z" fill="none" stroke="currentColor" strokeWidth="1.3"/></svg>;
    case 'sparkle':
      return <svg viewBox="0 0 16 16" width="16" height="16"><path d="M8 2l1.5 4.5L14 8l-4.5 1.5L8 14l-1.5-4.5L2 8l4.5-1.5z" fill="currentColor"/></svg>;
    case 'robot':
      return <svg viewBox="0 0 16 16" width="16" height="16"><rect x="3" y="5" width="10" height="8" rx="2" fill="none" stroke="currentColor" strokeWidth="1.3"/><circle cx="6.5" cy="9" r="1" fill="currentColor"/><circle cx="9.5" cy="9" r="1" fill="currentColor"/><line x1="8" y1="2" x2="8" y2="5" stroke="currentColor" strokeWidth="1.3"/></svg>;
    case 'plug':
      return <svg viewBox="0 0 16 16" width="16" height="16"><path d="M5 2v4m6-4v4M3 6h10v3a5 5 0 0 1-10 0z" fill="none" stroke="currentColor" strokeWidth="1.3"/></svg>;
    case 'brain':
      return <svg viewBox="0 0 16 16" width="16" height="16"><path d="M4 4c0-1 1-2 2-2s2 1 2 2v8c0 1-1 2-2 2s-2-1-2-2m4-8c0-1 1-2 2-2s2 1 2 2v8c0 1-1 2-2 2s-2-1-2-2" fill="none" stroke="currentColor" strokeWidth="1.3"/></svg>;
    case 'plus':
      return <svg viewBox="0 0 16 16" width="16" height="16"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
    case 'playbook':
      return <svg viewBox="0 0 16 16" width="16" height="16"><path d="M3 13L8 3l5 10z" fill="currentColor"/></svg>;
    case 'chart':
      return <svg viewBox="0 0 16 16" width="16" height="16"><rect x="3" y="9" width="2" height="4" fill="currentColor"/><rect x="7" y="6" width="2" height="7" fill="currentColor"/><rect x="11" y="3" width="2" height="10" fill="currentColor"/></svg>;
    case 'gear':
      return <svg viewBox="0 0 16 16" width="16" height="16"><circle cx="8" cy="8" r="2" fill="currentColor"/><path d="M8 2v2m0 8v2m6-6h-2M4 8H2m10.2-4.2l-1.4 1.4M5.2 10.8l-1.4 1.4m0-8.4l1.4 1.4m5.6 5.6l1.4 1.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>;
    case 'avatar':
      return <svg viewBox="0 0 16 16" width="16" height="16"><circle cx="8" cy="6" r="2.5" fill="currentColor"/><path d="M3 13c0-2 2.2-3.5 5-3.5S13 11 13 13" stroke="currentColor" strokeWidth="1.3" fill="none"/></svg>;
    default:
      return <svg viewBox="0 0 16 16" width="16" height="16" />;
  }
};
```

- [ ] **Step 4: Write `LeftRail.css`**

```css
.tk-leftrail {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: 52px;
  padding: var(--space-2) 0;
  background: var(--color-bg-elevated);
  border-right: 1px solid var(--color-border-subtle);
  color: var(--color-text-secondary);
}

.tk-leftrail__top,
.tk-leftrail__bottom {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
}

.tk-leftrail__item {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 0;
  background: transparent;
  border-radius: var(--radius-md);
  color: inherit;
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease-standard),
    color var(--duration-fast) var(--ease-standard);
}

.tk-leftrail__item:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.tk-leftrail__item--active {
  color: var(--color-accent);
  background: var(--color-accent-soft);
}

.tk-leftrail__divider {
  width: 20px;
  height: 1px;
  background: var(--color-border-subtle);
  margin: var(--space-2) 0;
}
```

- [ ] **Step 5: Write `index.ts`**

```ts
export { LeftRail } from './LeftRail.js';
export type { LeftRailId, LeftRailProps } from './LeftRail.js';
```

- [ ] **Step 6: Run the test**

Run: `pnpm --filter @tinker/desktop test -- LeftRail.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/renderer/workspace/components/LeftRail/
git commit -m "feat(desktop): add LeftRail nav per Paper 9Y-0"
```

### Task 2.12: `StatusDock` component

**Files:**
- Create: `apps/desktop/src/renderer/workspace/components/StatusDock/StatusDock.tsx`
- Create: `apps/desktop/src/renderer/workspace/components/StatusDock/StatusDock.css`
- Create: `apps/desktop/src/renderer/workspace/components/StatusDock/StatusDock.test.tsx`
- Create: `apps/desktop/src/renderer/workspace/components/StatusDock/index.ts`

- [ ] **Step 1: Pull Paper source**

Node `D1-0 StatusDock` (and its 3 children) under `BH-0 LeftPane` in `9I-0`.

- [ ] **Step 2: Write failing test**

```tsx
import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusDock } from './StatusDock.js';

describe('StatusDock', () => {
  test('renders provided status rows', () => {
    render(<StatusDock rows={[{ id: 'model', label: 'GPT-5.4', value: 'connected' }, { id: 'vault', label: 'Vault', value: '~/Tinker/knowledge' }]} />);
    expect(screen.getByText('GPT-5.4')).toBeInTheDocument();
    expect(screen.getByText('connected')).toBeInTheDocument();
    expect(screen.getByText('Vault')).toBeInTheDocument();
    expect(screen.getByText('~/Tinker/knowledge')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Implement `StatusDock.tsx`**

```tsx
import type { JSX } from 'react';
import './StatusDock.css';

export type StatusRow = {
  readonly id: string;
  readonly label: string;
  readonly value: string;
};

export type StatusDockProps = {
  readonly rows: ReadonlyArray<StatusRow>;
};

export const StatusDock = ({ rows }: StatusDockProps): JSX.Element => (
  <section className="tk-statusdock" aria-label="Workspace status">
    {rows.map((row) => (
      <div key={row.id} className="tk-statusdock__row">
        <span className="tk-statusdock__label">{row.label}</span>
        <span className="tk-statusdock__value">{row.value}</span>
      </div>
    ))}
  </section>
);
```

- [ ] **Step 4: Write `StatusDock.css`**

```css
.tk-statusdock {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--color-border-subtle);
  background: var(--color-bg-panel);
  color: var(--color-text-secondary);
  font-family: var(--font-sans);
  font-size: var(--font-size-sm);
}

.tk-statusdock__row {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
}

.tk-statusdock__label {
  color: var(--color-text-muted);
  letter-spacing: var(--letter-spacing-label);
  text-transform: uppercase;
  font-size: var(--font-size-xs);
}

.tk-statusdock__value {
  color: var(--color-text-primary);
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
}
```

- [ ] **Step 5: Write `index.ts`**

```ts
export { StatusDock } from './StatusDock.js';
export type { StatusDockProps, StatusRow } from './StatusDock.js';
```

- [ ] **Step 6: Run test + commit**

Run: `pnpm --filter @tinker/desktop test -- StatusDock.test.tsx`
Expected: PASS.

```bash
git add apps/desktop/src/renderer/workspace/components/StatusDock/
git commit -m "feat(desktop): add StatusDock per Paper D1-0"
```

### Task 2.13: `PreviewFrame` component

**Files:**
- Create: `apps/desktop/src/renderer/workspace/components/PreviewFrame/PreviewFrame.tsx`
- Create: `apps/desktop/src/renderer/workspace/components/PreviewFrame/PreviewFrame.css`
- Create: `apps/desktop/src/renderer/workspace/components/PreviewFrame/PreviewFrame.test.tsx`
- Create: `apps/desktop/src/renderer/workspace/components/PreviewFrame/index.ts`

- [ ] **Step 1: Pull Paper source**

Nodes: `EV-0 FileHeader`, `FC-0 PreviewToolbar`, `FJ-0 PreviewCanvas`, `FN-0 PreviewFooter`, `FU-0 PreviewMeta` under `BI-0 RightPane` in `9I-0`.

- [ ] **Step 2: Failing test**

```tsx
import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PreviewFrame } from './PreviewFrame.js';

describe('PreviewFrame', () => {
  test('renders header, toolbar, canvas children, footer, and meta', () => {
    render(
      <PreviewFrame
        fileName="ai-deep-dive (1).html"
        filePath="~/vault/agent/ai-deep-dive (1).html"
        toolbar={<span>open-in-browser</span>}
        footer={<span>156 lines</span>}
        meta={<span>Last edited yesterday</span>}
      >
        <iframe title="preview" />
      </PreviewFrame>
    );
    expect(screen.getByText('ai-deep-dive (1).html')).toBeInTheDocument();
    expect(screen.getByText('open-in-browser')).toBeInTheDocument();
    expect(screen.getByTitle('preview')).toBeInTheDocument();
    expect(screen.getByText('156 lines')).toBeInTheDocument();
    expect(screen.getByText('Last edited yesterday')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Implement `PreviewFrame.tsx`**

```tsx
import type { JSX, ReactNode } from 'react';
import './PreviewFrame.css';

export type PreviewFrameProps = {
  readonly fileName: string;
  readonly filePath?: string;
  readonly toolbar?: ReactNode;
  readonly footer?: ReactNode;
  readonly meta?: ReactNode;
  readonly children: ReactNode;
};

export const PreviewFrame = ({ fileName, filePath, toolbar, footer, meta, children }: PreviewFrameProps): JSX.Element => (
  <article className="tk-preview">
    <header className="tk-preview__header">
      <div className="tk-preview__filename">{fileName}</div>
      {filePath ? <div className="tk-preview__path">{filePath}</div> : null}
    </header>
    {toolbar ? <div className="tk-preview__toolbar">{toolbar}</div> : null}
    <div className="tk-preview__canvas">{children}</div>
    {footer ? <footer className="tk-preview__footer">{footer}</footer> : null}
    {meta ? <div className="tk-preview__meta">{meta}</div> : null}
  </article>
);
```

- [ ] **Step 4: Write `PreviewFrame.css`**

```css
.tk-preview {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-family: var(--font-sans);
}

.tk-preview__header {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-border-subtle);
  background: var(--color-bg-elevated);
}

.tk-preview__filename {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
}

.tk-preview__path {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  font-family: var(--font-mono);
}

.tk-preview__toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border-bottom: 1px solid var(--color-border-subtle);
  background: var(--color-bg-panel);
}

.tk-preview__canvas {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: var(--space-4);
}

.tk-preview__footer {
  display: flex;
  gap: var(--space-4);
  padding: var(--space-2) var(--space-4);
  border-top: 1px solid var(--color-border-subtle);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}

.tk-preview__meta {
  padding: var(--space-1) var(--space-4);
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  font-family: var(--font-mono);
}
```

- [ ] **Step 5: Write `index.ts`**

```ts
export { PreviewFrame } from './PreviewFrame.js';
export type { PreviewFrameProps } from './PreviewFrame.js';
```

- [ ] **Step 6: Run + commit**

Run: `pnpm --filter @tinker/desktop test -- PreviewFrame.test.tsx`
Expected: PASS.

```bash
git add apps/desktop/src/renderer/workspace/components/PreviewFrame/
git commit -m "feat(desktop): add PreviewFrame per Paper BI-0 subtree"
```

### Task 2.14: `JumpToBottom` component

**Files:**
- Create: `apps/desktop/src/renderer/workspace/components/JumpToBottom/JumpToBottom.tsx`
- Create: `apps/desktop/src/renderer/workspace/components/JumpToBottom/JumpToBottom.css`
- Create: `apps/desktop/src/renderer/workspace/components/JumpToBottom/JumpToBottom.test.tsx`
- Create: `apps/desktop/src/renderer/workspace/components/JumpToBottom/index.ts`

- [ ] **Step 1: Failing test**

```tsx
import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { JumpToBottom } from './JumpToBottom.js';

describe('JumpToBottom', () => {
  test('renders an accessible button that fires the handler', () => {
    let fired = 0;
    render(<JumpToBottom visible onClick={() => { fired += 1; }} />);
    const button = screen.getByRole('button', { name: /jump to bottom/i });
    button.click();
    expect(fired).toBe(1);
  });

  test('is not rendered when visible is false', () => {
    render(<JumpToBottom visible={false} onClick={() => {}} />);
    expect(screen.queryByRole('button', { name: /jump to bottom/i })).toBeNull();
  });
});
```

- [ ] **Step 2: Implement `JumpToBottom.tsx`**

```tsx
import type { JSX } from 'react';
import { IconButton } from '@tinker/design';
import './JumpToBottom.css';

export type JumpToBottomProps = {
  readonly visible: boolean;
  readonly onClick: () => void;
};

export const JumpToBottom = ({ visible, onClick }: JumpToBottomProps): JSX.Element | null => {
  if (!visible) return null;
  return (
    <div className="tk-jump">
      <IconButton variant="secondary" size="s" aria-label="Jump to bottom" onClick={onClick}>
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden>
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </IconButton>
    </div>
  );
};
```

- [ ] **Step 3: Implement `JumpToBottom.css`**

```css
.tk-jump {
  position: absolute;
  right: var(--space-4);
  bottom: var(--space-4);
  z-index: 2;
  filter: drop-shadow(var(--shadow-sm));
}
```

- [ ] **Step 4: Write `index.ts`**

```ts
export { JumpToBottom } from './JumpToBottom.js';
export type { JumpToBottomProps } from './JumpToBottom.js';
```

- [ ] **Step 5: Run + commit**

Run: `pnpm --filter @tinker/desktop test -- JumpToBottom.test.tsx`
Expected: PASS.

```bash
git add apps/desktop/src/renderer/workspace/components/JumpToBottom/
git commit -m "feat(desktop): add JumpToBottom affordance"
```

### Task 2.15: PaneTabBar reskin

**Files:**
- Create: `apps/desktop/src/renderer/workspace/components/PaneTabBar/PaneTabBar.css`
- Create: `apps/desktop/src/renderer/workspace/components/PaneTabBar/index.ts`
- Modify: `apps/desktop/src/renderer/workspace/Workspace.tsx`

- [ ] **Step 1: Author the reskin stylesheet**

`PaneTabBar.css` targets the class names emitted by `@tinker/panes` default tab strip components (`TabStrip.tsx`, `Stack.tsx`). Inspect those files to capture the exact class names, then author overrides that read tokens only:

```css
.tp-tabstrip {
  height: 36px;
  display: flex;
  align-items: center;
  padding: 0 var(--space-2);
  background: var(--color-bg-elevated);
  border-bottom: 1px solid var(--color-border-subtle);
  gap: var(--space-1);
}

.tp-tab {
  height: 28px;
  padding: 0 var(--space-3);
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-text-secondary);
  font-family: var(--font-sans);
  font-size: var(--font-size-sm);
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
}

.tp-tab:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.tp-tab--active {
  background: var(--color-bg-panel);
  color: var(--color-text-primary);
  border-color: var(--color-border-subtle);
}

.tp-tab__close {
  color: var(--color-text-muted);
}
```

If `@tinker/panes` emits different class names, adjust the selectors to match. Do not rename the library's classes; this stylesheet is opinionated app chrome.

- [ ] **Step 2: Export import path**

`index.ts`:

```ts
import './PaneTabBar.css';
```

- [ ] **Step 3: Import the reskin in `Workspace.tsx`**

At the top of `Workspace.tsx`, add:

```ts
import './components/PaneTabBar/index.js';
```

- [ ] **Step 4: Visual QA**

Run: `pnpm --filter @tinker/desktop dev`. Open the app, create two panes, switch tabs, verify hover + active colors match Paper `BJ-0` / `EE-0`. Check both themes.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/renderer/workspace/components/PaneTabBar/ \
        apps/desktop/src/renderer/workspace/Workspace.tsx
git commit -m "feat(desktop): reskin @tinker/panes tab strip per Paper BJ-0"
```

### Task 2.16: Mount chrome in `Workspace.tsx`

**Files:**
- Modify: `apps/desktop/src/renderer/workspace/Workspace.tsx`
- Modify: `apps/desktop/src/renderer/App.tsx`

- [ ] **Step 1: Import chrome components**

Add to `Workspace.tsx`:

```ts
import { TitleBar, type TitleBarTheme } from './components/TitleBar/index.js';
import { LeftRail, type LeftRailId } from './components/LeftRail/index.js';
import { StatusDock } from './components/StatusDock/index.js';
```

- [ ] **Step 2: Wire theme + rail state**

Add inside the component:

```tsx
const [theme, setTheme] = useState<TitleBarTheme>(() => (readTheme() ?? 'light'));
const onToggleTheme = useCallback((next: TitleBarTheme) => {
  setTheme(next);
  writeTheme(next);
  applyTheme(next);
}, []);
const [activeRailId, setActiveRailId] = useState<LeftRailId>('workspaces');
```

Import `readTheme`, `writeTheme`, `applyTheme` from `'../theme.js'`.

- [ ] **Step 3: Replace the old header**

Delete the `<header className="tinker-header">` block and the `<div className="tinker-workspace-integrations">` block, replacing them with:

```tsx
<TitleBar theme={theme} onToggleTheme={onToggleTheme} />
<div className="tinker-workspace-body">
  <LeftRail activeId={activeRailId} onSelect={setActiveRailId} />
  <PanesWorkspace store={store} registry={registry} ariaLabel="Tinker workspace" />
</div>
```

The rail's `onSelect` dispatches `openOrFocusPane(kind, title)` for the matching tab kind. Ship `activeRailId` resets via a `useEffect` that watches the store's active pane.

- [ ] **Step 4: Add `StatusDock` inside Chat renderer's footer**

Because `StatusDock` is the LeftPane footer in Paper 9I-0 (scoped to the chat experience), instantiate it inside `Chat.tsx` rather than globally in `Workspace.tsx`. Tracked in Task 3a.7 when the chat renderer lands its final chrome.

- [ ] **Step 5: Run typecheck + tests**

Run: `pnpm typecheck && pnpm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/renderer/workspace/Workspace.tsx apps/desktop/src/renderer/App.tsx
git commit -m "feat(desktop): mount TitleBar + LeftRail chrome around panes"
```

### Task 2.17: Delete `dockview-react` dependency + legacy styles

**Files:**
- Modify: `apps/desktop/package.json`
- Modify: `apps/desktop/src/renderer/styles.css`

- [ ] **Step 1: Drop the dependency**

In `apps/desktop/package.json`, remove the `dockview-react` entry from `dependencies`. Keep any other deps unchanged.

- [ ] **Step 2: Delete dockview-themed rules**

Open `apps/desktop/src/renderer/styles.css`. Remove any selectors beginning with `.dockview-theme-abyss`, `.tinker-dockview`, or rules that only exist to override Dockview internals. If unsure, search for `dockview` within the file and delete matching blocks. Tests + the design-system route both cover the loss.

- [ ] **Step 3: Reinstall**

Run: `pnpm install`
Expected: lockfile updates; no runtime regression.

- [ ] **Step 4: Run the full suite**

Run: `pnpm typecheck && pnpm test && pnpm --filter @tinker/desktop build`
Expected: PASS. If build fails because a stray `dockview-react` import remains, fix the import (should be a leftover and points to an already-rewritten module).

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/package.json apps/desktop/src/renderer/styles.css pnpm-lock.yaml
git commit -m "chore(desktop): remove dockview-react dependency"
```

### Task 2.18: Boot + visual QA pass

**Files:**
- None (QA only).

- [ ] **Step 1: Boot the app**

Run: `pnpm --filter @tinker/desktop dev`. Bring up the app, complete first-run with any vault, and confirm the workspace hydrates without console errors.

- [ ] **Step 2: Compare against Paper**

Open Paper artboards `9I-0` and `1-0`. Eyeball the chrome (TitleBar geometry, LeftRail icon ordering, pane split ratio) against the running app in both themes. File any deltas as `fix(desktop)` commits immediately.

- [ ] **Step 3: Close the phase**

Run: `pnpm typecheck && pnpm test`.

---

## Phase 3a — Memory tab kind + `Dialog` primitive + RefreshModal

### Task 3a.1: `Dialog` primitive failing test

**Files:**
- Create: `packages/design/src/components/Dialog.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Dialog, DialogHeader, DialogBody, DialogFooter } from './Dialog.js';

describe('Dialog', () => {
  test('renders nothing when closed', () => {
    render(
      <Dialog open={false} onDismiss={() => {}} aria-label="Sample">
        <DialogBody>hidden</DialogBody>
      </Dialog>
    );
    expect(screen.queryByText('hidden')).toBeNull();
  });

  test('renders header/body/footer when open', () => {
    render(
      <Dialog open onDismiss={() => {}} aria-label="Sample">
        <DialogHeader>Title</DialogHeader>
        <DialogBody>Body</DialogBody>
        <DialogFooter>Footer</DialogFooter>
      </Dialog>
    );
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Body')).toBeInTheDocument();
    expect(screen.getByText('Footer')).toBeInTheDocument();
  });

  test('does not fire onDismiss on Escape when dismissOnEscape is false', () => {
    let dismissed = false;
    render(
      <Dialog open onDismiss={() => { dismissed = true; }} dismissOnEscape={false} aria-label="Sample">
        <DialogBody>body</DialogBody>
      </Dialog>
    );
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    document.dispatchEvent(event);
    expect(dismissed).toBe(false);
  });

  test('fires onDismiss on Escape when allowed', () => {
    let dismissed = false;
    render(
      <Dialog open onDismiss={() => { dismissed = true; }} aria-label="Sample">
        <DialogBody>body</DialogBody>
      </Dialog>
    );
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    document.dispatchEvent(event);
    expect(dismissed).toBe(true);
  });
});
```

- [ ] **Step 2: Run to confirm fails**

Run: `pnpm --filter @tinker/design test -- Dialog.test.tsx`
Expected: FAIL.

### Task 3a.2: Implement `Dialog` primitive

**Files:**
- Create: `packages/design/src/components/Dialog.tsx`
- Create: `packages/design/src/components/Dialog.css`
- Modify: `packages/design/src/components/index.ts`

- [ ] **Step 1: Write `Dialog.tsx`**

```tsx
import type { JSX, ReactNode } from 'react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import './Dialog.css';

export type DialogProps = {
  readonly open: boolean;
  readonly onDismiss: () => void;
  readonly children: ReactNode;
  readonly dismissOnEscape?: boolean;
  readonly dismissOnBackdrop?: boolean;
  readonly 'aria-label'?: string;
  readonly 'aria-labelledby'?: string;
};

export const Dialog = (props: DialogProps): JSX.Element | null => {
  const {
    open,
    onDismiss,
    children,
    dismissOnEscape = true,
    dismissOnBackdrop = false,
  } = props;

  useEffect(() => {
    if (!open || !dismissOnEscape) return;
    const handle = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onDismiss();
      }
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [open, dismissOnEscape, onDismiss]);

  if (!open) return null;

  return createPortal(
    <div
      className="tk-dialog-backdrop"
      onMouseDown={dismissOnBackdrop ? onDismiss : undefined}
    >
      <div
        className="tk-dialog"
        role="dialog"
        aria-modal
        aria-label={props['aria-label']}
        aria-labelledby={props['aria-labelledby']}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
};

export const DialogHeader = ({ children }: { readonly children: ReactNode }): JSX.Element => (
  <header className="tk-dialog__header">{children}</header>
);

export const DialogBody = ({ children }: { readonly children: ReactNode }): JSX.Element => (
  <div className="tk-dialog__body">{children}</div>
);

export const DialogFooter = ({ children }: { readonly children: ReactNode }): JSX.Element => (
  <footer className="tk-dialog__footer">{children}</footer>
);
```

- [ ] **Step 2: Write `Dialog.css`**

```css
.tk-dialog-backdrop {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--color-bg-primary) 70%, transparent);
  backdrop-filter: blur(6px);
  z-index: 1000;
}

.tk-dialog {
  min-width: 320px;
  max-width: 440px;
  background: var(--color-bg-elevated);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  box-shadow: 0 12px 32px color-mix(in srgb, var(--color-bg-primary) 40%, transparent);
  overflow: hidden;
  font-family: var(--font-sans);
}

.tk-dialog__header {
  padding: var(--space-4);
  border-bottom: 1px solid var(--color-border-subtle);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
}

.tk-dialog__body {
  padding: var(--space-4);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
}

.tk-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--color-border-subtle);
  background: var(--color-bg-panel);
}
```

- [ ] **Step 3: Export from index**

Open `packages/design/src/components/index.ts` and add:

```ts
export { Dialog, DialogBody, DialogFooter, DialogHeader } from './Dialog.js';
export type { DialogProps } from './Dialog.js';
```

- [ ] **Step 4: Run the test**

Run: `pnpm --filter @tinker/design test -- Dialog.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/design/src/components/Dialog.tsx \
        packages/design/src/components/Dialog.css \
        packages/design/src/components/Dialog.test.tsx \
        packages/design/src/components/index.ts
git commit -m "feat(design): add headless Dialog primitive"
```

### Task 3a.3: Add `'memory'` to `TabKind`

**Files:**
- Modify: `packages/shared-types/src/layout.ts`

- [ ] **Step 1: Edit the union**

Add `'memory'` to `TabKind`:

```ts
export type TabKind =
  | 'vault-browser'
  | 'chat'
  | 'today'
  | 'scheduler'
  | 'settings'
  | 'playbook'
  | 'markdown-editor'
  | 'file'
  | 'markdown'
  | 'html'
  | 'csv'
  | 'image'
  | 'code'
  | 'memory';
```

- [ ] **Step 2: Commit**

```bash
git add packages/shared-types/src/layout.ts
git commit -m "feat(shared-types): add memory to TabKind"
```

### Task 3a.4: `MemoryTab` renderer skeleton + test

**Files:**
- Create: `apps/desktop/src/renderer/renderers/MemoryTab/MemoryTab.tsx`
- Create: `apps/desktop/src/renderer/renderers/MemoryTab/MemoryTab.css`
- Create: `apps/desktop/src/renderer/renderers/MemoryTab/MemoryTab.test.tsx`
- Create: `apps/desktop/src/renderer/renderers/MemoryTab/index.ts`

- [ ] **Step 1: Pull Paper IQ-0 JSX**

Invoke `/paper-desktop:design-to-code` on node `IQ-0`. Capture the internal two-column layout: `KO-0 MemorySidebar` (280px) with `KQ-0 SearchRow` + `KZ-0 SectionList`; `KP-0 MemoryDetail` with `MU-0 DetailTabBar`, `N8-0 DetailHeader`, `NO-0 DetailBody`.

- [ ] **Step 2: Write the failing test**

```tsx
import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryTab } from './MemoryTab.js';

describe('MemoryTab', () => {
  test('renders sidebar + empty detail when no entity selected', () => {
    render(<MemoryTab entities={[]} selectedEntityId={null} onSelectEntity={() => {}} onRefresh={() => {}} refreshing={false} />);
    expect(screen.getByRole('search')).toBeInTheDocument();
    expect(screen.getByText(/no memory selected/i)).toBeInTheDocument();
  });

  test('renders entity detail when selected', () => {
    render(
      <MemoryTab
        entities={[{ id: 'e1', title: 'Quarterly plan', subtitle: 'Doc', updatedAt: '2026-04-20' }]}
        selectedEntityId="e1"
        onSelectEntity={() => {}}
        onRefresh={() => {}}
        refreshing={false}
      >
        <p>Body content</p>
      </MemoryTab>
    );
    expect(screen.getByText('Quarterly plan')).toBeInTheDocument();
    expect(screen.getByText('Body content')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Implement `MemoryTab.tsx`**

```tsx
import type { JSX, ReactNode } from 'react';
import { Button, SearchInput } from '@tinker/design';
import './MemoryTab.css';

export type MemoryEntitySummary = {
  readonly id: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly updatedAt?: string;
};

export type MemoryTabProps = {
  readonly entities: ReadonlyArray<MemoryEntitySummary>;
  readonly selectedEntityId: string | null;
  readonly onSelectEntity: (id: string) => void;
  readonly onRefresh: () => void;
  readonly refreshing: boolean;
  readonly children?: ReactNode;
};

export const MemoryTab = ({ entities, selectedEntityId, onSelectEntity, onRefresh, refreshing, children }: MemoryTabProps): JSX.Element => {
  const selected = entities.find((entity) => entity.id === selectedEntityId) ?? null;
  return (
    <section className="tk-memorytab">
      <aside className="tk-memorytab__sidebar" aria-label="Memory entities">
        <div className="tk-memorytab__searchrow" role="search">
          <SearchInput placeholder="Search memory" />
          <Button variant="secondary" size="s" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
        </div>
        <ul className="tk-memorytab__list">
          {entities.map((entity) => (
            <li key={entity.id}>
              <button
                type="button"
                className={`tk-memorytab__item${entity.id === selectedEntityId ? ' tk-memorytab__item--active' : ''}`}
                onClick={() => onSelectEntity(entity.id)}
              >
                <span className="tk-memorytab__title">{entity.title}</span>
                {entity.subtitle ? <span className="tk-memorytab__subtitle">{entity.subtitle}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <article className="tk-memorytab__detail">
        {selected ? (
          <>
            <header className="tk-memorytab__detail-header">
              <h2>{selected.title}</h2>
              {selected.updatedAt ? <p className="tk-memorytab__meta">{selected.updatedAt}</p> : null}
            </header>
            <div className="tk-memorytab__detail-body">{children}</div>
          </>
        ) : (
          <div className="tk-memorytab__empty">No memory selected.</div>
        )}
      </article>
    </section>
  );
};
```

- [ ] **Step 4: Write `MemoryTab.css`**

```css
.tk-memorytab {
  display: grid;
  grid-template-columns: 280px 1fr;
  height: 100%;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-family: var(--font-sans);
}

.tk-memorytab__sidebar {
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--color-border-subtle);
  background: var(--color-bg-elevated);
}

.tk-memorytab__searchrow {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-3);
  border-bottom: 1px solid var(--color-border-subtle);
}

.tk-memorytab__list {
  flex: 1;
  margin: 0;
  padding: var(--space-2);
  list-style: none;
  overflow: auto;
}

.tk-memorytab__item {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  width: 100%;
  padding: var(--space-3);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: transparent;
  text-align: left;
  cursor: pointer;
  color: inherit;
}

.tk-memorytab__item:hover {
  background: var(--color-bg-hover);
}

.tk-memorytab__item--active {
  background: var(--color-bg-panel);
  border-color: var(--color-border-subtle);
}

.tk-memorytab__title {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-medium);
}

.tk-memorytab__subtitle {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.tk-memorytab__detail {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.tk-memorytab__detail-header {
  padding: var(--space-4);
  border-bottom: 1px solid var(--color-border-subtle);
}

.tk-memorytab__meta {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  font-family: var(--font-mono);
}

.tk-memorytab__detail-body {
  flex: 1;
  padding: var(--space-4);
  overflow: auto;
}

.tk-memorytab__empty {
  display: grid;
  place-items: center;
  height: 100%;
  color: var(--color-text-muted);
}
```

- [ ] **Step 5: Write `index.ts`**

```ts
export { MemoryTab } from './MemoryTab.js';
export type { MemoryTabProps, MemoryEntitySummary } from './MemoryTab.js';
```

- [ ] **Step 6: Run + commit**

Run: `pnpm --filter @tinker/desktop test -- MemoryTab.test.tsx`
Expected: PASS.

```bash
git add apps/desktop/src/renderer/renderers/MemoryTab/
git commit -m "feat(desktop): add MemoryTab renderer per Paper IQ-0"
```

### Task 3a.5: `RefreshModal` consumer

**Files:**
- Create: `apps/desktop/src/renderer/renderers/MemoryTab/RefreshModal.tsx`
- Create: `apps/desktop/src/renderer/renderers/MemoryTab/RefreshModal.test.tsx`

- [ ] **Step 1: Pull Paper OK-0 subtree**

Nodes: `UE-0 RefreshModal`, `UF-0 ModalHeader`, `UM-0 ModalBody`, `UN-0 ModalFooter` and their children. Capture copy + button labels.

- [ ] **Step 2: Write failing test**

```tsx
import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RefreshModal } from './RefreshModal.js';

describe('RefreshModal', () => {
  test('renders primary + secondary actions when idle', () => {
    let confirmed = 0;
    let dismissed = 0;
    render(
      <RefreshModal
        open
        mode="idle"
        lastRun="2026-04-19"
        onConfirm={() => { confirmed += 1; }}
        onDismiss={() => { dismissed += 1; }}
      />
    );
    screen.getByRole('button', { name: /refresh memory/i }).click();
    screen.getByRole('button', { name: /not now/i }).click();
    expect(confirmed).toBe(1);
    expect(dismissed).toBe(1);
  });

  test('shows progress text while running and hides the confirm button', () => {
    render(
      <RefreshModal
        open
        mode="running"
        lastRun={null}
        progressMessage="Scanning 128 notes…"
        onConfirm={() => {}}
        onDismiss={() => {}}
      />
    );
    expect(screen.getByText('Scanning 128 notes…')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /refresh memory/i })).toBeNull();
  });
});
```

- [ ] **Step 3: Implement `RefreshModal.tsx`**

```tsx
import type { JSX } from 'react';
import { Button, Dialog, DialogBody, DialogFooter, DialogHeader } from '@tinker/design';

export type RefreshModalProps = {
  readonly open: boolean;
  readonly mode: 'idle' | 'running' | 'error';
  readonly lastRun: string | null;
  readonly progressMessage?: string;
  readonly errorMessage?: string;
  readonly onConfirm: () => void;
  readonly onDismiss: () => void;
};

export const RefreshModal = ({
  open,
  mode,
  lastRun,
  progressMessage,
  errorMessage,
  onConfirm,
  onDismiss,
}: RefreshModalProps): JSX.Element => (
  <Dialog
    open={open}
    onDismiss={onDismiss}
    dismissOnEscape={mode !== 'running'}
    aria-label="Refresh memory"
  >
    <DialogHeader>Refresh memory</DialogHeader>
    <DialogBody>
      {mode === 'idle' ? (
        <p>
          Re-scan the vault and update memory entities. Last run:{' '}
          {lastRun ?? 'never'}.
        </p>
      ) : null}
      {mode === 'running' ? <p>{progressMessage ?? 'Working…'}</p> : null}
      {mode === 'error' ? (
        <p role="alert">
          Refresh failed. {errorMessage ?? 'Try again in a moment.'}
        </p>
      ) : null}
    </DialogBody>
    <DialogFooter>
      <Button variant="ghost" size="s" onClick={onDismiss} disabled={mode === 'running'}>
        Not now
      </Button>
      {mode !== 'running' ? (
        <Button variant="primary" size="s" onClick={onConfirm}>
          {mode === 'error' ? 'Try again' : 'Refresh memory'}
        </Button>
      ) : null}
    </DialogFooter>
  </Dialog>
);
```

- [ ] **Step 4: Run + commit**

Run: `pnpm --filter @tinker/desktop test -- RefreshModal.test.tsx`
Expected: PASS.

```bash
git add apps/desktop/src/renderer/renderers/MemoryTab/RefreshModal.tsx \
        apps/desktop/src/renderer/renderers/MemoryTab/RefreshModal.test.tsx
git commit -m "feat(desktop): add memory refresh modal per Paper OK-0"
```

### Task 3a.6: Wire `MemoryTab` into registry

**Files:**
- Modify: `apps/desktop/src/renderer/workspace/Workspace.tsx`

- [ ] **Step 1: Register the renderer**

Add to the registry list in `Workspace.tsx` inside the `useMemo`:

```tsx
{
  kind: 'memory',
  defaultTitle: 'Memory',
  render: ({ pane, tabId }) => (
    <MemoryTab
      entities={memoryEntities}
      selectedEntityId={(pane.data as MemoryTabData).entityId ?? null}
      onSelectEntity={(id) =>
        store.getState().actions.updatePaneData(tabId, pane.id, (prev) => ({
          ...(prev as MemoryTabData),
          kind: 'memory',
          entityId: id,
        }))
      }
      onRefresh={() => setRefreshModalState({ open: true, mode: 'idle', lastRun })}
      refreshing={refreshModalState.mode === 'running'}
    >
      {/* detail body — markdown render of selected entity */}
    </MemoryTab>
  ),
} as PaneDefinition<TabData>,
```

Add adjacent state hooks for `memoryEntities` (subscribed from `memoryStore`), `refreshModalState`, and `lastRun`. Mount the `<RefreshModal>` alongside the workspace:

```tsx
<RefreshModal {...refreshModalState} lastRun={lastRun} onConfirm={handleConfirmRefresh} onDismiss={handleDismissRefresh} />
```

- [ ] **Step 2: Typecheck + boot**

Run: `pnpm typecheck && pnpm --filter @tinker/desktop dev`. Open a new memory pane via the LeftRail Memory item.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/renderer/workspace/Workspace.tsx
git commit -m "feat(desktop): register memory renderer + wire refresh modal"
```

### Task 3a.7: StatusDock inside Chat renderer

**Files:**
- Modify: `apps/desktop/src/renderer/panes/Chat.tsx`

- [ ] **Step 1: Add `<StatusDock>` below the chat scroll area**

Inside `Chat.tsx`, after the message list, render:

```tsx
<StatusDock
  rows={[
    { id: 'model', label: 'Model', value: modelConnected ? 'GPT-5.4 connected' : 'GPT-5.4 offline' },
    { id: 'vault', label: 'Vault', value: vaultPath ?? 'none' },
    { id: 'skills', label: 'Skills', value: `${activeSkillCount} active` },
  ]}
/>
```

Import from `../workspace/components/StatusDock/index.js`. Feed `activeSkillCount` via `skillStore.getActiveCount()` (or whatever the current store exposes) — match the existing props already received by `Chat`.

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/renderer/panes/Chat.tsx
git commit -m "feat(desktop): render StatusDock inside Chat renderer"
```

### Task 3a.8: Phase 3a verification

- [ ] **Step 1: Full suite**

Run: `pnpm typecheck && pnpm test`
Expected: PASS.

- [ ] **Step 2: Visual parity**

Compare running app's Memory pane against Paper `IQ-0`, and RefreshModal against `OK-0`. Resolve any deltas with follow-up `fix(desktop)` commits.

---

## Phase 3b — Agents tab kind

### Task 3b.1: Add `'agent'` to `TabKind`

**Files:**
- Modify: `packages/shared-types/src/layout.ts`

- [ ] **Step 1: Edit union**

```ts
export type TabKind =
  | 'vault-browser'
  | 'chat'
  | 'today'
  | 'scheduler'
  | 'settings'
  | 'playbook'
  | 'markdown-editor'
  | 'file'
  | 'markdown'
  | 'html'
  | 'csv'
  | 'image'
  | 'code'
  | 'memory'
  | 'agent';
```

- [ ] **Step 2: Commit**

```bash
git add packages/shared-types/src/layout.ts
git commit -m "feat(shared-types): add agent to TabKind"
```

### Task 3b.2: `AgentsTab` failing test + implementation

**Files:**
- Create: `apps/desktop/src/renderer/renderers/AgentsTab/AgentsTab.tsx`
- Create: `apps/desktop/src/renderer/renderers/AgentsTab/AgentsTab.css`
- Create: `apps/desktop/src/renderer/renderers/AgentsTab/AgentsTab.test.tsx`
- Create: `apps/desktop/src/renderer/renderers/AgentsTab/index.ts`

- [ ] **Step 1: Pull Paper IR-0 subtree**

Invoke `/paper-desktop:design-to-code` on node `IR-0`. Capture `XP-0 AgentsSidebar`, `XR-0 SearchRow`, `Y0-0 SectionList`, `XQ-0 AgentsDetail`, `ZD-0 DetailTabBar` (5 children — confirm which labels: likely "Overview", "Runs", "Skills", "Memory", "Settings"), `100-0 DetailHeader`, `10J-0 DetailBody`.

- [ ] **Step 2: Write failing test**

```tsx
import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AgentsTab } from './AgentsTab.js';

describe('AgentsTab', () => {
  test('renders empty state when no agent selected', () => {
    render(<AgentsTab agents={[]} selectedAgentId={null} activeDetailTab="overview" onSelectAgent={() => {}} onSelectDetailTab={() => {}} />);
    expect(screen.getByRole('search')).toBeInTheDocument();
    expect(screen.getByText(/no agent selected/i)).toBeInTheDocument();
  });

  test('renders agent detail with tab strip', () => {
    render(
      <AgentsTab
        agents={[{ id: 'a1', name: 'Rhea', status: 'running' }]}
        selectedAgentId="a1"
        activeDetailTab="runs"
        onSelectAgent={() => {}}
        onSelectDetailTab={() => {}}
      >
        <p>Run log</p>
      </AgentsTab>
    );
    expect(screen.getByText('Rhea')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /runs/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Run log')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Implement `AgentsTab.tsx`**

```tsx
import type { JSX, ReactNode } from 'react';
import { Button, SearchInput, StatusDot } from '@tinker/design';
import './AgentsTab.css';

export type AgentDetailTab = 'overview' | 'runs' | 'skills' | 'memory' | 'settings';

export type AgentSummary = {
  readonly id: string;
  readonly name: string;
  readonly status: 'idle' | 'running' | 'error';
};

export type AgentsTabProps = {
  readonly agents: ReadonlyArray<AgentSummary>;
  readonly selectedAgentId: string | null;
  readonly activeDetailTab: AgentDetailTab;
  readonly onSelectAgent: (id: string) => void;
  readonly onSelectDetailTab: (tab: AgentDetailTab) => void;
  readonly children?: ReactNode;
};

const DETAIL_TABS: ReadonlyArray<{ id: AgentDetailTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'runs', label: 'Runs' },
  { id: 'skills', label: 'Skills' },
  { id: 'memory', label: 'Memory' },
  { id: 'settings', label: 'Settings' },
];

export const AgentsTab = ({ agents, selectedAgentId, activeDetailTab, onSelectAgent, onSelectDetailTab, children }: AgentsTabProps): JSX.Element => {
  const selected = agents.find((agent) => agent.id === selectedAgentId) ?? null;
  return (
    <section className="tk-agentstab">
      <aside className="tk-agentstab__sidebar" aria-label="Agents">
        <div className="tk-agentstab__searchrow" role="search">
          <SearchInput placeholder="Search agents" />
          <Button variant="secondary" size="s">New agent</Button>
        </div>
        <ul className="tk-agentstab__list">
          {agents.map((agent) => (
            <li key={agent.id}>
              <button
                type="button"
                className={`tk-agentstab__item${agent.id === selectedAgentId ? ' tk-agentstab__item--active' : ''}`}
                onClick={() => onSelectAgent(agent.id)}
              >
                <StatusDot tone={agent.status === 'running' ? 'success' : agent.status === 'error' ? 'error' : 'muted'} />
                <span className="tk-agentstab__name">{agent.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <article className="tk-agentstab__detail">
        {selected ? (
          <>
            <div className="tk-agentstab__detail-tabbar" role="tablist">
              {DETAIL_TABS.map((tab) => (
                <button
                  key={tab.id}
                  role="tab"
                  type="button"
                  className={`tk-agentstab__detail-tab${tab.id === activeDetailTab ? ' tk-agentstab__detail-tab--active' : ''}`}
                  aria-selected={tab.id === activeDetailTab}
                  onClick={() => onSelectDetailTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <header className="tk-agentstab__detail-header">
              <h2>{selected.name}</h2>
              <StatusDot tone={selected.status === 'running' ? 'success' : selected.status === 'error' ? 'error' : 'muted'} label={selected.status} />
            </header>
            <div className="tk-agentstab__detail-body" role="tabpanel">{children}</div>
          </>
        ) : (
          <div className="tk-agentstab__empty">No agent selected.</div>
        )}
      </article>
    </section>
  );
};
```

- [ ] **Step 4: `AgentsTab.css`**

```css
.tk-agentstab {
  display: grid;
  grid-template-columns: 280px 1fr;
  height: 100%;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-family: var(--font-sans);
}

.tk-agentstab__sidebar {
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--color-border-subtle);
  background: var(--color-bg-elevated);
}

.tk-agentstab__searchrow {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-3);
  border-bottom: 1px solid var(--color-border-subtle);
}

.tk-agentstab__list {
  flex: 1;
  margin: 0;
  padding: var(--space-2);
  list-style: none;
  overflow: auto;
}

.tk-agentstab__item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-3);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: transparent;
  text-align: left;
  cursor: pointer;
  color: inherit;
}

.tk-agentstab__item:hover {
  background: var(--color-bg-hover);
}

.tk-agentstab__item--active {
  background: var(--color-bg-panel);
  border-color: var(--color-border-subtle);
}

.tk-agentstab__name {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-medium);
}

.tk-agentstab__detail {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.tk-agentstab__detail-tabbar {
  display: flex;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-4);
  border-bottom: 1px solid var(--color-border-subtle);
  background: var(--color-bg-elevated);
}

.tk-agentstab__detail-tab {
  height: 28px;
  padding: 0 var(--space-3);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-secondary);
  font-family: var(--font-sans);
  font-size: var(--font-size-sm);
  cursor: pointer;
}

.tk-agentstab__detail-tab--active {
  background: var(--color-bg-panel);
  border-color: var(--color-border-subtle);
  color: var(--color-text-primary);
}

.tk-agentstab__detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4);
  border-bottom: 1px solid var(--color-border-subtle);
}

.tk-agentstab__detail-body {
  flex: 1;
  padding: var(--space-4);
  overflow: auto;
}

.tk-agentstab__empty {
  display: grid;
  place-items: center;
  height: 100%;
  color: var(--color-text-muted);
}
```

- [ ] **Step 5: `index.ts`**

```ts
export { AgentsTab } from './AgentsTab.js';
export type { AgentsTabProps, AgentSummary, AgentDetailTab } from './AgentsTab.js';
```

- [ ] **Step 6: Run test + commit**

Run: `pnpm --filter @tinker/desktop test -- AgentsTab.test.tsx`
Expected: PASS.

```bash
git add apps/desktop/src/renderer/renderers/AgentsTab/
git commit -m "feat(desktop): add AgentsTab renderer per Paper IR-0"
```

### Task 3b.3: Wire `AgentsTab` into registry

**Files:**
- Modify: `apps/desktop/src/renderer/workspace/Workspace.tsx`

- [ ] **Step 1: Add the renderer entry**

Append to the registry list in `Workspace.tsx`:

```tsx
{
  kind: 'agent',
  defaultTitle: 'Agents',
  render: ({ pane, tabId }) => (
    <AgentsTab
      agents={agentsList}
      selectedAgentId={(pane.data as AgentTabData).agentId ?? null}
      activeDetailTab={activeAgentDetailTab}
      onSelectAgent={(id) =>
        store.getState().actions.updatePaneData(tabId, pane.id, (prev) => ({
          ...(prev as AgentTabData),
          kind: 'agent',
          agentId: id,
        }))
      }
      onSelectDetailTab={setActiveAgentDetailTab}
    />
  ),
} as PaneDefinition<TabData>,
```

Derive `agentsList` from the bridge session list. Hold `activeAgentDetailTab` in local state (`useState<AgentDetailTab>('overview')`).

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/renderer/workspace/Workspace.tsx
git commit -m "feat(desktop): register agent renderer"
```

### Task 3b.4: Phase 3b verification

- [ ] **Step 1: Full suite**

Run: `pnpm typecheck && pnpm test`
Expected: PASS.

- [ ] **Step 2: Visual QA**

Open an Agents tab in the app, compare each detail tab against Paper `IR-0` DetailTabBar children. File any tuning as `fix(desktop)` commits.

---

## Phase 3c — `ask_user` overlay

### Task 3c.1: Failing test for ask_user in Chat

**Files:**
- Create: `apps/desktop/src/renderer/panes/Chat.ask-user.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Chat, type ChatProps } from './Chat.js';

const renderChat = (override: Partial<ChatProps> = {}): ReturnType<typeof render> => {
  const props: ChatProps = {
    ...baseProps(),
    ...override,
  };
  return render(<Chat {...props} />);
};

const baseProps = (): ChatProps => ({
  askUserEvent: { id: 'q-1', prompt: 'Pick one', options: [{ id: 'a', label: 'Apple' }, { id: 'b', label: 'Banana' }, { id: 'cancel', label: 'Cancel' }] },
  onAskUserResolve: vi.fn(),
  // ... (copy the remaining props the real Chat already takes; keep the fixture minimal)
} as unknown as ChatProps);

describe('Chat ask_user overlay', () => {
  test('renders prompt + options when an ask_user event is active', () => {
    renderChat();
    expect(screen.getByText('Pick one')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apple' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Banana' })).toBeInTheDocument();
  });

  test('resolving calls onAskUserResolve with chosen option id', () => {
    const onResolve = vi.fn();
    renderChat({ onAskUserResolve: onResolve });
    screen.getByRole('button', { name: 'Banana' }).click();
    expect(onResolve).toHaveBeenCalledWith('q-1', 'b');
  });
});
```

- [ ] **Step 2: Confirm failure**

Run: `pnpm --filter @tinker/desktop test -- Chat.ask-user.test.tsx`
Expected: FAIL.

### Task 3c.2: Implement `ask_user` overlay

**Files:**
- Modify: `apps/desktop/src/renderer/panes/Chat.tsx`

- [ ] **Step 1: Extend the props**

Add to `ChatProps`:

```ts
readonly askUserEvent: {
  readonly id: string;
  readonly prompt: string;
  readonly options: ReadonlyArray<{ readonly id: string; readonly label: string }>;
} | null;
readonly onAskUserResolve: (eventId: string, optionId: string) => void;
```

- [ ] **Step 2: Render the overlay**

Inside the return tree:

```tsx
<Dialog
  open={askUserEvent !== null}
  onDismiss={() => {
    if (askUserEvent?.options.some((opt) => opt.id === 'cancel')) {
      onAskUserResolve(askUserEvent.id, 'cancel');
    }
  }}
  dismissOnEscape={askUserEvent?.options.some((opt) => opt.id === 'cancel') ?? false}
  aria-label="Agent question"
>
  {askUserEvent ? (
    <>
      <DialogHeader>Agent needs input</DialogHeader>
      <DialogBody>{askUserEvent.prompt}</DialogBody>
      <DialogFooter>
        {askUserEvent.options.map((option) => (
          <Button
            key={option.id}
            variant={option.id === 'cancel' ? 'ghost' : 'secondary'}
            size="s"
            onClick={() => onAskUserResolve(askUserEvent.id, option.id)}
          >
            {option.label}
          </Button>
        ))}
      </DialogFooter>
    </>
  ) : null}
</Dialog>
```

Import `Dialog`, `DialogBody`, `DialogFooter`, `DialogHeader`, `Button` from `@tinker/design`.

- [ ] **Step 3: Wire the bridge subscription**

In the component's parent (`Workspace.tsx` or `App.tsx`), subscribe to bridge `ask_user` events and pipe `{id, prompt, options}` down to the active chat renderer as `askUserEvent`. Resolve by invoking the bridge's reply API.

- [ ] **Step 4: Run + commit**

Run: `pnpm --filter @tinker/desktop test -- Chat.ask-user.test.tsx`
Expected: PASS.

```bash
git add apps/desktop/src/renderer/panes/Chat.tsx \
        apps/desktop/src/renderer/panes/Chat.ask-user.test.tsx \
        apps/desktop/src/renderer/workspace/Workspace.tsx
git commit -m "feat(desktop): render ask_user overlay via Dialog per D20"
```

### Task 3c.3: End-to-end verification

- [ ] **Step 1: Full suite**

Run: `pnpm typecheck && pnpm test && pnpm --filter @tinker/desktop build`
Expected: PASS.

- [ ] **Step 2: Invoke `/superpowers:verification-before-completion`**

Treat the prompt as the gate — run `pnpm dev`, exercise each Paper artboard's flow manually in both themes, and close any deltas with follow-up commits before declaring done.

- [ ] **Step 3: Update knowledge**

Append a session summary to `agent-knowledge/context/sessions/YYYY-MM-DD-HHMM.md` describing the port outcome. Add a new entry `D24` to `agent-knowledge/product/decisions.md` noting the D16 cutover landed. Bump any feature statuses in `agent-knowledge/context/tasks.md`.

- [ ] **Step 4: Refresh CLAUDE.md + AGENTS.md**

Update section 8 (Workspace UI Invariants) to cite the new component tree (`workspace/components/TitleBar`, `LeftRail`, `StatusDock`, `PreviewFrame`, `JumpToBottom`) and theme plumbing (`theme.ts` + `[data-theme]`). Remove any mention of `dockview-react` as an in-repo engine; keep [D16] reference but note cutover complete.

- [ ] **Step 5: Commit knowledge updates**

```bash
git add CLAUDE.md AGENTS.md agent-knowledge/
git commit -m "docs(knowledge): close out workspace port; note D16 cutover complete"
```

---

## Completion checklist

- [ ] All 39 tasks above are checked off.
- [ ] `pnpm typecheck && pnpm test && pnpm --filter @tinker/desktop build` all green.
- [ ] `pnpm dev` boot shows Paper-parity workspace in default (light) theme.
- [ ] Toggling theme via the TitleBar button flips every surface without reload; second boot remembers the choice.
- [ ] `dockview-react` is gone from `pnpm-lock.yaml`.
- [ ] `agent-knowledge/product/decisions.md` records the D16 cutover.
- [ ] Session summary appended under `agent-knowledge/context/sessions/`.
