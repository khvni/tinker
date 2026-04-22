// Typed pane renderer registry for the MVP workspace (TIN-6, task M1.2).
//
// New API (`registerPane` / `getRenderer`) is the single dispatch point the
// workspace layout uses to render pane content by kind. Renderers are narrowed
// per kind via `TinkerPaneData`'s discriminator, so passing the wrong data
// shape for a given kind is a compile error.

import type { ReactNode } from 'react';
import type { TinkerPaneData, TinkerPaneKind } from '@tinker/shared-types';

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
