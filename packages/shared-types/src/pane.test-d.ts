// Type-level tests for `TinkerPaneKind` and `TinkerPaneData`.
//
// The shared-types package has no runtime test runner — these assertions are
// exercised purely by `tsc --noEmit` (see `typecheck` script). A regression in
// the discriminated union, kind literals, or required fields will surface as a
// compile error.

import type { TinkerPaneData, TinkerPaneKind } from './pane.js';

type AssertEqual<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

type Expect<T extends true> = T;

// ────────────────────────────────────────────────────────────────────────────
// `TinkerPaneKind` is exactly the four MVP kinds, no more no less.
// ────────────────────────────────────────────────────────────────────────────

type _KindLiterals = Expect<
  AssertEqual<TinkerPaneKind, 'chat' | 'file' | 'settings' | 'memory'>
>;

const _chatKind: TinkerPaneKind = 'chat';
const _fileKind: TinkerPaneKind = 'file';
const _settingsKind: TinkerPaneKind = 'settings';
const _memoryKind: TinkerPaneKind = 'memory';

// @ts-expect-error — unknown kind literal must be rejected
const _bogusKind: TinkerPaneKind = 'not-a-pane';

// @ts-expect-error — deferred Playbook UI is a future route, not an MVP pane kind
const _playbookKind: TinkerPaneKind = 'playbook';

// ────────────────────────────────────────────────────────────────────────────
// `TinkerPaneData` accepts each valid variant.
// ────────────────────────────────────────────────────────────────────────────

const _chatData: TinkerPaneData = { kind: 'chat' };
const _chatDataWithSession: TinkerPaneData = { kind: 'chat', sessionId: 'session-123' };
const _chatDataWithFolder: TinkerPaneData = { kind: 'chat', folderPath: '/tmp', memorySubdir: '/tmp/m' };
const _fileData: TinkerPaneData = { kind: 'file', path: '/tmp/a.md', mime: 'text/markdown' };
const _settingsData: TinkerPaneData = { kind: 'settings' };
const _memoryData: TinkerPaneData = { kind: 'memory' };

// @ts-expect-error — deferred Playbook UI is not part of the persisted pane payload union
const _playbookData: TinkerPaneData = { kind: 'playbook' };

// ────────────────────────────────────────────────────────────────────────────
// `TinkerPaneData` rejects malformed variants.
// ────────────────────────────────────────────────────────────────────────────

// @ts-expect-error — `file` requires `path` and `mime`
const _badFileMissingFields: TinkerPaneData = { kind: 'file' };

// @ts-expect-error — `file.path` must be a string
const _badFilePathType: TinkerPaneData = { kind: 'file', path: 123, mime: 'text/plain' };

// @ts-expect-error — unknown kind rejected
const _badKindData: TinkerPaneData = { kind: 'nope' };

// @ts-expect-error — `chat` does not carry arbitrary extra props
const _chatWithExtras: TinkerPaneData = { kind: 'chat', unknownProp: '/x' };

// ────────────────────────────────────────────────────────────────────────────
// Discriminated narrowing: `data.kind` checks make payload fields accessible.
// ────────────────────────────────────────────────────────────────────────────

const _narrowCheck = (data: TinkerPaneData): string => {
  switch (data.kind) {
    case 'chat':
      return 'chat';
    case 'file':
      // `path` and `mime` must be accessible only inside the `file` branch.
      return `${data.path}:${data.mime}`;
    case 'settings':
      return 'settings';
    case 'memory':
      return 'memory';
  }
};

// Exhaustiveness: if a new kind is added without updating this function, the
// `never` assignment will fail to compile.
const _exhaustive = (data: TinkerPaneData): never => {
  switch (data.kind) {
    case 'chat':
    case 'file':
    case 'settings':
    case 'memory':
      throw new Error('handled');
    default: {
      const _unreachable: never = data;
      return _unreachable;
    }
  }
};

// Silence "unused" noise without leaking runtime side effects. The `void`
// operator discards the value while ensuring the bindings were type-checked.
void _chatKind;
void _fileKind;
void _settingsKind;
void _memoryKind;
void _bogusKind;
void _playbookKind;
void _chatData;
void _chatDataWithSession;
void _fileData;
void _settingsData;
void _memoryData;
void _playbookData;
void _badFileMissingFields;
void _badFilePathType;
void _badKindData;
void _chatWithExtras;
void _narrowCheck;
void _exhaustive;

export {};
