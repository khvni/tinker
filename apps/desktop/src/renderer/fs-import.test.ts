import { describe, it } from 'vitest';
import { exists } from '@tauri-apps/plugin-fs';

describe('fs import', () => {
  it('imports', () => {
    console.log('exists imported:', typeof exists);
  });
});
