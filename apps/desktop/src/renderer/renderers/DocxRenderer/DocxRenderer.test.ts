// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import {
  MAX_DOCX_PREVIEW_BYTES,
  convertDocxToHtml,
  isDocxPreviewTooLarge,
  sanitizeDocxHtml,
  type DocxConverter,
} from './DocxRenderer.js';

describe('DocxRenderer helpers', () => {
  it('sanitizes DOCX HTML before render', () => {
    const html = sanitizeDocxHtml(
      '<h1>Plan</h1><script>alert("x")</script><img src="data:image/png;base64,abc" alt="inline" />',
    );

    expect(html).toContain('<h1>Plan</h1>');
    expect(html).not.toContain('<script');
    expect(html).toContain('data:image/png;base64,abc');
  });

  it('converts DOCX bytes with Mammoth data-uri images', async () => {
    const dataUriConverter = { __mammothBrand: 'ImageConverter' } as DocxConverter['images']['dataUri'];
    const convertToHtml = vi.fn<DocxConverter['convertToHtml']>().mockResolvedValue({
      value: '<p>Converted</p>',
      messages: [],
    });
    const images = {
      dataUri: dataUriConverter,
      imgElement: vi.fn(() => dataUriConverter),
    } as DocxConverter['images'];
    const mammothModule = {
      convertToHtml,
      images,
    } satisfies DocxConverter;
    const sanitizeHtml = vi.fn((value: string) => value);
    const result = await convertDocxToHtml(new Uint8Array([1, 2, 3]), {
      mammothModule,
      sanitizeHtml,
    });

    expect(convertToHtml).toHaveBeenCalledWith(
      { arrayBuffer: expect.any(ArrayBuffer) },
      { convertImage: dataUriConverter },
    );
    expect(sanitizeHtml).toHaveBeenCalledWith('<p>Converted</p>');
    expect(result).toEqual({
      html: '<p>Converted</p>',
      messages: [],
    });
  });

  it('caps inline preview size at 15 MB', () => {
    expect(isDocxPreviewTooLarge(MAX_DOCX_PREVIEW_BYTES)).toBe(false);
    expect(isDocxPreviewTooLarge(MAX_DOCX_PREVIEW_BYTES + 1)).toBe(true);
  });
});
