import { describe, it, expect } from 'vitest';
import { open } from './electron-shims-shell.js';

describe('shell import', () => {
  it('imports open as a function', () => {
    expect(typeof open).toBe('function');
  });
});
