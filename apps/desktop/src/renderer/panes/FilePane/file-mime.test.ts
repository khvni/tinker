import { describe, expect, it } from 'vitest';
import { getFilePaneMimeFromExtension, sniffFileMimeFromBytes } from './file-mime.js';

const encoder = new TextEncoder();

describe('getFilePaneMimeFromExtension', () => {
  it('maps common MVP extensions to pane MIME types', () => {
    expect(getFilePaneMimeFromExtension('/tmp/note.md')).toBe('text/markdown');
    expect(getFilePaneMimeFromExtension('/tmp/table.csv')).toBe('text/csv');
    expect(getFilePaneMimeFromExtension('/tmp/report.pdf')).toBe('application/pdf');
    expect(getFilePaneMimeFromExtension('/tmp/deck.ppt')).toBe('application/vnd.ms-powerpoint');
    expect(getFilePaneMimeFromExtension('/tmp/deck.pptx')).toBe(
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    );
  });
});

describe('sniffFileMimeFromBytes', () => {
  it('detects PDF files from magic bytes when the extension is ambiguous', () => {
    const bytes = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);

    expect(sniffFileMimeFromBytes('/tmp/report', bytes, 'application/octet-stream')).toBe(
      'application/pdf',
    );
  });

  it('detects SVG content from text bytes when the extension is generic', () => {
    const bytes = encoder.encode('<svg viewBox="0 0 10 10"></svg>');

    expect(sniffFileMimeFromBytes('/tmp/diagram.txt', bytes, 'text/plain')).toBe('image/svg+xml');
  });

  it('keeps unknown binary files on the unsupported path', () => {
    const bytes = Uint8Array.from([0x00, 0xff, 0x00, 0x7f]);

    expect(sniffFileMimeFromBytes('/tmp/archive.bin', bytes, 'application/octet-stream')).toBe(
      'application/octet-stream',
    );
  });

  it('promotes unknown text files into plain-text code views', () => {
    const bytes = encoder.encode('const answer = 42;\n');

    expect(sniffFileMimeFromBytes('/tmp/README', bytes, 'application/octet-stream')).toBe(
      'text/plain',
    );
  });
});
