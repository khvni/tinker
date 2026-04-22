// Typed pane renderer registry for the MVP workspace (TIN-6, task M1.2).
//
// New API (`registerPane` / `getRenderer`) is the single dispatch point the
// workspace layout uses to render pane content by kind. Renderers are narrowed
// per kind via `TinkerPaneData`'s discriminator, so passing the wrong data
// shape for a given kind is a compile error.
//
// The legacy `WorkspacePaneMap` / `createPaneRegistry` exports below are the
// Dockview-coupled surface used by `Workspace.tsx`. They stay in place only
// until M1.7 swaps the renderer tree onto `@tinker/panes`; M1.8 deletes them.

import type { FunctionComponent, ReactNode } from 'react';
import type { IDockviewPanelProps } from 'dockview-react';
import type { TabKind, TinkerPaneData, TinkerPaneKind } from '@tinker/shared-types';

// ──────────────────────────────────────────────────────────────────────────
// New API (M1.2) — typed renderer registry keyed by `TinkerPaneKind`.
// ──────────────────────────────────────────────────────────────────────────

/**
 * Renderer for a single `TinkerPaneKind`. Receives the discriminated data
 * payload that matches that kind, narrowed via `Extract`, and returns the
 * React node rendered inside the pane body.
 */
export type PaneRenderer<K extends TinkerPaneKind> = (
  data: Extract<TinkerPaneData, { readonly kind: K }>,
) => ReactNode;

type PaneRendererMap = {
  [K in TinkerPaneKind]?: PaneRenderer<K>;
};

const renderers: PaneRendererMap = {};

/**
 * Register a renderer for `kind`. Populated once at app boot.
 *
 * Throws if a renderer is already registered for `kind` — duplicate
 * registration is almost always a wiring bug and we prefer to surface it
 * immediately rather than silently overwrite.
 */
export const registerPane = <K extends TinkerPaneKind>(
  kind: K,
  render: PaneRenderer<K>,
): void => {
  if (renderers[kind] !== undefined) {
    throw new Error(
      `registerPane: renderer for kind "${kind}" is already registered. ` +
        'Call resetPaneRegistry() before re-registering (tests only).',
    );
  }
  // TypeScript can't prove the mapped-type assignment is safe at the write
  // site (generic K widening), but the public `registerPane` signature does —
  // the narrow cast stays contained at this boundary.
  (renderers as Record<TinkerPaneKind, unknown>)[kind] = render;
};

/**
 * Returns the registered renderer for `kind` or throws a descriptive error
 * naming both the missing kind and the kinds that are currently registered.
 */
export const getRenderer = <K extends TinkerPaneKind>(kind: K): PaneRenderer<K> => {
  const render = renderers[kind];
  if (render === undefined) {
    const available = Object.keys(renderers);
    const known = available.length === 0 ? '<none>' : available.join(', ');
    throw new Error(
      `getRenderer: no renderer registered for pane kind "${kind}". Registered kinds: ${known}.`,
    );
  }
  return render;
};

/**
 * Clears the module-level registry. Intended for test isolation — production
 * code must not call this.
 */
export const resetPaneRegistry = (): void => {
  for (const key of Object.keys(renderers) as Array<TinkerPaneKind>) {
    delete renderers[key];
  }
};

// ──────────────────────────────────────────────────────────────────────────
// Legacy Dockview surface — removed by M1.7/M1.8 alongside `dockview-react`.
// ──────────────────────────────────────────────────────────────────────────

export type WorkspacePaneMap = Record<TabKind, FunctionComponent<IDockviewPanelProps>>;

export const createPaneRegistry = <T extends WorkspacePaneMap>(panes: T): T => panes;
