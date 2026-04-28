import { describe, it, expect } from 'vitest';
import * as memory from '@tinker/memory';

describe('memory import', () => {
  it('imports memory as a non-null object', () => {
    expect(typeof memory).toBe('object');
    expect(memory).not.toBeNull();
  });
});
