import { describe, it } from 'vitest';
import { Command } from '@tauri-apps/plugin-shell';

describe('shell import', () => {
  it('imports', () => {
    console.log('Command imported:', typeof Command);
  });
});
