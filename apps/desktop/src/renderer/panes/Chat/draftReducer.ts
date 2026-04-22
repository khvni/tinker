import type { TinkerStreamEvent } from '@tinker/bridge';
import type { Block } from './Block.js';

export type DraftAction =
  | { type: 'reset' }
  | { type: 'event'; event: TinkerStreamEvent };

const upsertBlock = (
  state: Block[],
  partID: string,
  build: (existing: Block | null) => Block | null,
): Block[] => {
  const idx = state.findIndex((block) => block.partID === partID);
  const next = build(idx === -1 ? null : (state[idx] ?? null));
  if (!next) return state;
  if (idx === -1) return [...state, next];
  const out = [...state];
  out[idx] = next;
  return out;
};

export const draftReducer = (state: Block[], action: DraftAction): Block[] => {
  if (action.type === 'reset') return [];
  const e = action.event;

  if (e.type === 'token') {
    return upsertBlock(state, e.partID, (prev) =>
      !prev ? { kind: 'text', partID: e.partID, text: e.text }
        : prev.kind === 'text' ? { ...prev, text: prev.text + e.text }
        : null,
    );
  }
  if (e.type === 'reasoning') {
    return upsertBlock(state, e.partID, (prev) =>
      !prev ? { kind: 'reasoning', partID: e.partID, text: e.text }
        : prev.kind === 'reasoning' ? { ...prev, text: prev.text + e.text }
        : null,
    );
  }
  if (e.type === 'tool_call') {
    return upsertBlock(state, e.partID, (prev) =>
      !prev ? { kind: 'tool', partID: e.partID, name: e.name, input: e.input, state: 'pending' }
        : prev.kind === 'tool' ? { ...prev, name: e.name, input: e.input, state: 'pending' }
        : null,
    );
  }
  if (e.type === 'tool_result') {
    return upsertBlock(state, e.partID, (prev) =>
      !prev ? { kind: 'tool', partID: e.partID, name: e.name, input: {}, state: 'completed', output: e.output }
        : prev.kind === 'tool' ? { ...prev, name: e.name, state: 'completed', output: e.output }
        : null,
    );
  }
  if (e.type === 'tool_error') {
    return upsertBlock(state, e.partID, (prev) =>
      !prev ? { kind: 'tool', partID: e.partID, name: e.name, input: {}, state: 'error', error: e.message }
        : prev.kind === 'tool' ? { ...prev, name: e.name, state: 'error', error: e.message }
        : null,
    );
  }

  return state;
};
