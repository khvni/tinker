import { describe, expect, it } from 'vitest';
import {
  HTML_PREVIEW_SANDBOX,
  htmlNeedsExternalOpenHint,
  sanitizeHtml,
} from './HtmlRenderer.js';

describe('HtmlRenderer helpers', () => {
  it('locks iframe sandbox to same-origin preview only', () => {
    expect(HTML_PREVIEW_SANDBOX).toBe('allow-same-origin');
  });

  it('flags scripted HTML for the external-open hint', () => {
    expect(htmlNeedsExternalOpenHint('<script>window.alert("x")</script>')).toBe(true);
    expect(htmlNeedsExternalOpenHint('<div>Plain preview</div>')).toBe(false);
  });
});

describe('sanitizeHtml', () => {
  it('strips style tags to prevent CSS injection', () => {
    const dirty = '<style>body{color:red}</style><div>Hello</div>';
    expect(sanitizeHtml(dirty)).not.toContain('<style>');
    expect(sanitizeHtml(dirty)).toContain('<div>Hello</div>');
  });

  it('strips style attributes from elements', () => {
    const dirty = '<div style="color:red">Hello</div>';
    expect(sanitizeHtml(dirty)).not.toContain('style=');
    expect(sanitizeHtml(dirty)).toContain('<div>Hello</div>');
  });

  it('preserves non-style HTML unchanged', () => {
    const clean = '<p>Hello <strong>world</strong></p>';
    expect(sanitizeHtml(clean)).toContain('<p>');
    expect(sanitizeHtml(clean)).toContain('<strong>');
  });

  it('allows safe HTML attributes', () => {
    const withAttrs = '<a href="https://example.com" target="_blank">Link</a>';
    expect(sanitizeHtml(withAttrs)).toContain('href=');
  });
});
