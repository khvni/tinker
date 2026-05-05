// Type-level tests for the pane registry (TIN-6).
//
// Exercised by `tsc --noEmit`. Every `@ts-expect-error` line below must still
// be an error after a change or the compiler will fail the build — that is
// how we enforce "passing the wrong data shape for a kind is a compile
// error" from the M1.2 acceptance list.

import type { ReactNode } from 'react';
import type { TinkerPaneData } from '@tinker/shared-types';
import { getRenderer, registerPane, type PaneRenderer } from './pane-registry.js';

type AssertEqual<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

type Expect<T extends true> = T;

// ────────────────────────────────────────────────────────────────────────────
// Per-kind renderer signature narrows the `data` argument.
// ────────────────────────────────────────────────────────────────────────────

type _ChatRendererData = Parameters<PaneRenderer<'chat'>>[0];
type _FileRendererData = Parameters<PaneRenderer<'file'>>[0];

type _ChatDataEq = Expect<
  AssertEqual<
    _ChatRendererData,
    {
      readonly kind: 'chat';
      readonly sessionId?: string;
      readonly createFreshSession?: boolean;
      readonly folderPath?: string;
      readonly memorySubdir?: string;
    }
  >
>;
type _FileDataEq = Expect<
  AssertEqual<
    _FileRendererData,
    { readonly kind: 'file'; readonly path: string; readonly mime: string }
  >
>;

// ────────────────────────────────────────────────────────────────────────────
// `registerPane` rejects cross-kind renderer/data mismatches.
// ────────────────────────────────────────────────────────────────────────────

// OK — chat renderer for chat kind
registerPane('chat', (data): ReactNode => data.kind);

// OK — file renderer reads `path` / `mime` because `data` is narrowed.
registerPane('file', (data): ReactNode => `${data.path}:${data.mime}`);

// @ts-expect-error — renderer typed for chat cannot be registered under `file`.
registerPane('file', (data: Extract<TinkerPaneData, { kind: 'chat' }>): ReactNode => data.kind);

// @ts-expect-error — renderer for `file` tries to read `path` which doesn't exist on `chat`.
registerPane('chat', (data) => (data as { path: string }).path);

// @ts-expect-error — unknown kind literal rejected.
registerPane('not-a-pane', () => null);

// ────────────────────────────────────────────────────────────────────────────
// `getRenderer` return type is narrowed to the caller's kind.
// ────────────────────────────────────────────────────────────────────────────

const _useChat = () => {
  const render = getRenderer('chat');
  return render({ kind: 'chat' });
};

const _useFile = () => {
  const render = getRenderer('file');
  return render({ kind: 'file', path: '/a', mime: 'text/plain' });
};

// @ts-expect-error — file renderer cannot be invoked with chat payload.
const _crossKindInvoke = () => getRenderer('file')({ kind: 'chat' });

// @ts-expect-error — unknown kind rejected at `getRenderer`.
const _unknownKind = () => getRenderer('not-a-pane');

void _useChat;
void _useFile;
void _crossKindInvoke;
void _unknownKind;

export {};
