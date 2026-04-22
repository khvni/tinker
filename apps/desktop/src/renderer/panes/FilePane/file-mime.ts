import { exists, readFile } from '@tauri-apps/plugin-fs';
import { getFileExtension, getImageMimeType } from '../../renderers/file-utils.js';

const GENERIC_BINARY_MIME = 'application/octet-stream';
const GENERIC_TEXT_MIME = 'text/plain';
const OFFICE_CONTAINER_MIME = 'application/zip';
const TEXT_DECODER = new TextDecoder();

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d];
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const GIF87A_SIGNATURE = [0x47, 0x49, 0x46, 0x38, 0x37, 0x61];
const GIF89A_SIGNATURE = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61];
const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04];

const AMBIGUOUS_MIME_TYPES = new Set([GENERIC_BINARY_MIME, GENERIC_TEXT_MIME]);

export const MISSING_FILE_MIME = 'application/x-tinker-missing-file';

const hasSignature = (bytes: Uint8Array, signature: readonly number[]): boolean => {
  if (bytes.length < signature.length) {
    return false;
  }

  return signature.every((byte, index) => bytes[index] === byte);
};

const looksLikeBinary = (bytes: Uint8Array): boolean => {
  const sample = bytes.subarray(0, 512);
  let suspicious = 0;

  for (const byte of sample) {
    if (byte === 0) {
      return true;
    }

    const isWhitespace = byte === 0x09 || byte === 0x0a || byte === 0x0d;
    const isControl = byte < 0x20 || byte === 0x7f;
    if (isControl && !isWhitespace) {
      suspicious += 1;
    }
  }

  return sample.length > 0 && suspicious / sample.length > 0.1;
};

const sniffTextMime = (bytes: Uint8Array): string | null => {
  const sample = TEXT_DECODER.decode(bytes.subarray(0, 2048));
  const trimmed = sample.replace(/^\uFEFF/u, '').trimStart().toLowerCase();

  if (trimmed.startsWith('<!doctype html') || trimmed.startsWith('<html')) {
    return 'text/html';
  }

  if (trimmed.startsWith('<svg') || (trimmed.startsWith('<?xml') && trimmed.includes('<svg'))) {
    return 'image/svg+xml';
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return 'application/json';
  }

  return null;
};

const sniffZipContainerMime = (absolutePath: string): string => {
  switch (getFileExtension(absolutePath)) {
    case '.docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case '.pptx':
      return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    case '.xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    default:
      return OFFICE_CONTAINER_MIME;
  }
};

export const getFilePaneMimeFromExtension = (absolutePath: string): string => {
  switch (getFileExtension(absolutePath)) {
    case '.csv':
      return 'text/csv';
    case '.docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case '.gif':
    case '.jpeg':
    case '.jpg':
    case '.png':
    case '.svg':
    case '.webp':
      return getImageMimeType(absolutePath);
    case '.htm':
    case '.html':
      return 'text/html';
    case '.json':
      return 'application/json';
    case '.md':
      return 'text/markdown';
    case '.mjs':
    case '.js':
      return 'text/javascript';
    case '.pdf':
      return 'application/pdf';
    case '.ppt':
      return 'application/vnd.ms-powerpoint';
    case '.pptx':
      return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    case '.ts':
      return 'application/typescript';
    case '.tsx':
      return 'text/typescript';
    case '.txt':
      return GENERIC_TEXT_MIME;
    case '.xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    default:
      return GENERIC_BINARY_MIME;
  }
};

export const sniffFileMimeFromBytes = (
  absolutePath: string,
  bytes: Uint8Array,
  fallbackMime: string,
): string => {
  if (hasSignature(bytes, PDF_SIGNATURE)) {
    return 'application/pdf';
  }

  if (hasSignature(bytes, PNG_SIGNATURE)) {
    return 'image/png';
  }

  if (hasSignature(bytes, JPEG_SIGNATURE)) {
    return 'image/jpeg';
  }

  if (hasSignature(bytes, GIF87A_SIGNATURE) || hasSignature(bytes, GIF89A_SIGNATURE)) {
    return 'image/gif';
  }

  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP'
  ) {
    return 'image/webp';
  }

  if (hasSignature(bytes, ZIP_SIGNATURE)) {
    return sniffZipContainerMime(absolutePath);
  }

  const textMime = sniffTextMime(bytes);
  if (textMime) {
    return textMime;
  }

  if (looksLikeBinary(bytes)) {
    return GENERIC_BINARY_MIME;
  }

  return fallbackMime === GENERIC_BINARY_MIME ? GENERIC_TEXT_MIME : fallbackMime;
};

export const resolveFilePaneMime = async (absolutePath: string): Promise<string> => {
  const fallbackMime = getFilePaneMimeFromExtension(absolutePath);

  try {
    const fileExists = await exists(absolutePath);
    if (!fileExists) {
      return MISSING_FILE_MIME;
    }

    if (!AMBIGUOUS_MIME_TYPES.has(fallbackMime)) {
      return fallbackMime;
    }

    const bytes = await readFile(absolutePath);
    return sniffFileMimeFromBytes(absolutePath, bytes, fallbackMime);
  } catch (error) {
    console.warn(`Failed to inspect "${absolutePath}". Falling back to extension MIME.`, error);
    return fallbackMime;
  }
};
