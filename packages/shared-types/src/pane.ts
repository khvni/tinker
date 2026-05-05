// Pane types for the Tinker MVP workspace.
//
// `TinkerPaneKind` is the discriminator used in FlexLayout tab registrations.
// `TinkerPaneData` is the discriminated payload stored in each FlexLayout tab
// node's `config` and persisted inside the layout JSON.
//
// Adding a third kind is an intentional scope change: extend the union, register
// the renderer, and update any exhaustive switches in the same PR.

/**
 * Union of pane kinds shipped in the MVP workspace.
 *
 * Utility surfaces such as Memory, Settings, Connections, and Playbook are
 * workspace routes, not split-tree panes.
 */
export type TinkerPaneKind = 'chat' | 'file';

/**
 * Discriminated union of pane payloads, keyed by `kind`.
 *
 * Narrow via the `kind` tag:
 *
 *   if (data.kind === 'file') { data.path; data.mime; }
 *
 * `chat` stores an optional persisted SQLite session id so pane-local chat
 * preferences survive layout restore and app restart.
 */
export type TinkerPaneData =
  | {
      readonly kind: 'chat';
      readonly sessionId?: string;
      readonly createFreshSession?: boolean;
      readonly folderPath?: string;
      readonly memorySubdir?: string;
    }
  | { readonly kind: 'file'; readonly path: string; readonly mime: string };
