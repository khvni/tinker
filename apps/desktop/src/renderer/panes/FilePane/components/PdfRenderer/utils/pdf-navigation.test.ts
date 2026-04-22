import { describe, expect, it } from 'vitest';
import { getNextPdfPage } from './pdf-navigation.js';

describe('getNextPdfPage', () => {
  it('moves one page backward and forward with page keys', () => {
    expect(getNextPdfPage('PageUp', 3, 8)).toBe(2);
    expect(getNextPdfPage('PageDown', 3, 8)).toBe(4);
  });

  it('jumps to document edges with home and end', () => {
    expect(getNextPdfPage('Home', 4, 8)).toBe(1);
    expect(getNextPdfPage('End', 4, 8)).toBe(8);
  });

  it('clamps navigation inside document bounds', () => {
    expect(getNextPdfPage('PageUp', 1, 8)).toBe(1);
    expect(getNextPdfPage('PageDown', 8, 8)).toBe(8);
  });

  it('ignores unrelated keys and empty documents', () => {
    expect(getNextPdfPage('ArrowDown', 2, 8)).toBe(2);
    expect(getNextPdfPage('PageDown', 1, 0)).toBe(1);
  });
});
