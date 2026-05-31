import { describe, it, expect } from 'vitest';
import { openExternalUrl } from '../native-fs.js';

describe('shell import', () => {
  it('imports openExternalUrl as a function', () => {
    expect(typeof openExternalUrl).toBe('function');
  });
});
