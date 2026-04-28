import { describe, it, expect } from 'vitest';
import { exists } from '@tauri-apps/plugin-fs';

describe('fs import', () => {
  it('imports exists as a function', () => {
    expect(typeof exists).toBe('function');
  });
});
