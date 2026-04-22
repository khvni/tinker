// Pane types for the Tinker MVP workspace.
//
// `TinkerPaneKind` is the discriminator shipped in `@tinker/panes` registrations
// (`PaneRegistry<TinkerPaneKind>`, see spec [[20-mvp-panes-workspace]]).
// `TinkerPaneData` is the discriminated payload stored on each `Pane<TData>`
// instance and persisted inside `WorkspaceState<TinkerPaneData>`.
//
// Adding a fifth kind is an intentional scope change: extend the union, register
// the renderer, and update any exhaustive switches in the same PR.

/**
 * Union of pane kinds shipped in the MVP workspace.
 *
 * `playbook` ships post-MVP (TIN-114) as the skills marketplace pane. It is
 * registered with the pane registry so arbitrary layouts can adopt it, but is
 * intentionally absent from the default layout (see `layout.default.ts`).
 */
export type TinkerPaneKind = 'chat' | 'file' | 'settings' | 'memory' | 'playbook';

/**
 * Discriminated union of pane payloads, keyed by `kind`.
 *
 * Narrow via the `kind` tag:
 *
 *   if (data.kind === 'file') { data.path; data.mime; }
 *
 * `settings`, `memory`, and `playbook` carry no payload fields in the MVP but
 * keep the `kind` discriminator so the union stays narrowable and so future
 * payload additions don't require touching call sites that already destructure
 * `kind`.
 *
 * `chat` stores an optional persisted SQLite session id so pane-local chat
 * preferences survive layout restore and app restart.
 */
export type TinkerPaneData =
  | {
      readonly kind: 'chat';
      readonly sessionId?: string;
      readonly folderPath?: string;
      readonly memorySubdir?: string;
    }
  | { readonly kind: 'file'; readonly path: string; readonly mime: string }
  | { readonly kind: 'settings' }
  | { readonly kind: 'memory' }
  | { readonly kind: 'playbook' };
