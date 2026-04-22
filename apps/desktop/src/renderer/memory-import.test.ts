import { describe, it } from 'vitest';
import * as memory from '@tinker/memory';

describe('memory import', () => {
  it('imports', () => {
    console.log('memory keys:', Object.keys(memory).slice(0, 5));
  });
});
