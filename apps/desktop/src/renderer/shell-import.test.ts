import { describe, it, expect } from 'vitest';
import { Command } from '@tauri-apps/plugin-shell';

describe('shell import', () => {
  it('imports Command as a function', () => {
    expect(typeof Command).toBe('function');
  });
});
