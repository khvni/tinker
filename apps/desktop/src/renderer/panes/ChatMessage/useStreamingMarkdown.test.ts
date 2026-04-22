import { describe, expect, it } from 'vitest';
import { createStreamingBuffer } from './useStreamingMarkdown.js';

describe('createStreamingBuffer', () => {
  it('accumulates appended chunks', () => {
    const buffer = createStreamingBuffer();
    expect(buffer.isEmpty()).toBe(true);

    buffer.append('Hello');
    buffer.append(', ');
    buffer.append('world!');

    expect(buffer.read()).toBe('Hello, world!');
    expect(buffer.isEmpty()).toBe(false);
  });

  it('ignores empty chunks', () => {
    const buffer = createStreamingBuffer();

    buffer.append('');
    expect(buffer.isEmpty()).toBe(true);

    buffer.append('x');
    buffer.append('');
    expect(buffer.read()).toBe('x');
  });

  it('clears state on reset', () => {
    const buffer = createStreamingBuffer();

    buffer.append('abcdef');
    buffer.reset();

    expect(buffer.read()).toBe('');
    expect(buffer.isEmpty()).toBe(true);

    buffer.append('g');
    expect(buffer.read()).toBe('g');
  });

  it('preserves order across many small chunks', () => {
    const buffer = createStreamingBuffer();
    const pieces = Array.from({ length: 500 }, (_, index) => `${index};`);

    for (const piece of pieces) {
      buffer.append(piece);
    }

    expect(buffer.read()).toBe(pieces.join(''));
  });
});
