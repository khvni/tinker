import { describe, expect, it } from 'vitest';
import { getPaneMimeForPath } from './file-open.js';

describe('getPaneMimeForPath', () => {
  it('maps PDF paths to the PDF pane MIME', () => {
    expect(getPaneMimeForPath('/vault/guide.pdf')).toBe('application/pdf');
    expect(getPaneMimeForPath('/vault/GUIDE.PDF')).toBe('application/pdf');
  });
});
