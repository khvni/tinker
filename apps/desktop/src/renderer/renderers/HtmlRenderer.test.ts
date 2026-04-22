import { describe, expect, it } from 'vitest';
import { HTML_PREVIEW_SANDBOX, htmlNeedsExternalOpenHint } from './HtmlRenderer.js';

describe('HtmlRenderer helpers', () => {
  it('locks iframe sandbox to same-origin preview only', () => {
    expect(HTML_PREVIEW_SANDBOX).toBe('allow-same-origin');
  });

  it('flags scripted HTML for the external-open hint', () => {
    expect(htmlNeedsExternalOpenHint('<script>window.alert("x")</script>')).toBe(true);
    expect(htmlNeedsExternalOpenHint('<div>Plain preview</div>')).toBe(false);
  });
});
