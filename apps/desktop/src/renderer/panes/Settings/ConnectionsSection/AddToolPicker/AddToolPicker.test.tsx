import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AddToolPicker } from './AddToolPicker.js';
import { AVAILABLE_MCPS, DEFAULT_UNAVAILABLE_BLURB } from './available-mcps.js';

const countOccurrences = (haystack: string, needle: string): number => {
  if (needle.length === 0) return 0;
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
};

describe('AddToolPicker', () => {
  it('renders nothing when closed', () => {
    const markup = renderToStaticMarkup(<AddToolPicker open={false} onClose={vi.fn()} />);
    expect(markup).toBe('');
  });

  it('lists every available-mcp entry as a disabled card when open', () => {
    const markup = renderToStaticMarkup(<AddToolPicker open onClose={vi.fn()} />);

    expect(markup).toContain('Add a tool');
    for (const mcp of AVAILABLE_MCPS) {
      expect(markup).toContain(mcp.label);
      expect(markup).toContain(mcp.ticket);
      expect(markup).toContain(mcp.ticketUrl);
    }
    const disabledCount = markup.match(/aria-disabled="true"/g)?.length ?? 0;
    expect(disabledCount).toBeGreaterThanOrEqual(AVAILABLE_MCPS.length);
  });

  it('renders the shared "coming soon" blurb once per unavailable row', () => {
    const markup = renderToStaticMarkup(<AddToolPicker open onClose={vi.fn()} />);

    const unavailableCount = AVAILABLE_MCPS.filter((mcp) => !mcp.available).length;
    expect(unavailableCount).toBeGreaterThanOrEqual(6);
    expect(countOccurrences(markup, DEFAULT_UNAVAILABLE_BLURB)).toBe(unavailableCount);
  });
});
