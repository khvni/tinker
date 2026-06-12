import { describe, expect, it } from 'vitest';
import { sanitizeHighlightedCode } from './CodeRenderer.js';

describe('sanitizeHighlightedCode', () => {
  it('strips style tags from highlighted output', () => {
    const highlighted = '<span class="hljs-keyword">const</span><style>body{color:red}</style>';
    expect(sanitizeHighlightedCode(highlighted)).not.toContain('<style>');
  });

  it('strips style attributes from highlighted output', () => {
    const highlighted = '<span style="color:red">const</span>';
    expect(sanitizeHighlightedCode(highlighted)).not.toContain('style=');
  });

  it('preserves hljs span elements unchanged', () => {
    const highlighted = '<span class="hljs-keyword">const</span> <span class="hljs-built_in">x</span>';
    expect(sanitizeHighlightedCode(highlighted)).toContain('hljs-keyword');
  });

  it('handles empty string', () => {
    expect(sanitizeHighlightedCode('')).toBe('');
  });

  it('strips nested style tags', () => {
    const highlighted = '<code><style>@import "x"</style><span>code</span></code>';
    expect(sanitizeHighlightedCode(highlighted)).not.toContain('<style>');
  });

  it('preserves code with no special elements', () => {
    const clean = '<span>plain code</span>';
    expect(sanitizeHighlightedCode(clean)).toBe(clean);
  });
});