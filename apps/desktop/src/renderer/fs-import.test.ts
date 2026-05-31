import { describe, it, expect } from 'vitest';
import { exists } from '../native-fs.js';

describe('fs import', () => {
  it('imports exists as a function', () => {
    expect(typeof exists).toBe('function');
  });
});
