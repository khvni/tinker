// @vitest-environment jsdom

// @ts-expect-error React uses this flag in tests.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pdfTestMocks = vi.hoisted(() => ({
  AnnotationMode: { ENABLE: 1 },
  GlobalWorkerOptions: { workerSrc: '' },
  destroyDocumentMock: vi.fn(),
  destroyLoadingTaskMock: vi.fn(),
  getDocumentMock: vi.fn(),
  getPageMock: vi.fn(),
  getViewportMock: vi.fn(),
  pageCleanupMock: vi.fn(),
  readFileMock: vi.fn(),
  renderPageMock: vi.fn(),
  renderTaskCancelMock: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  readFile: pdfTestMocks.readFileMock,
}));

vi.mock('pdfjs-dist', () => ({
  AnnotationMode: pdfTestMocks.AnnotationMode,
  GlobalWorkerOptions: pdfTestMocks.GlobalWorkerOptions,
  getDocument: pdfTestMocks.getDocumentMock,
}));

vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({
  default: '/pdf.worker.min.mjs',
}));

import { PdfRenderer } from './PdfRenderer.js';

type ResizeObserverCallback = ConstructorParameters<typeof ResizeObserver>[0];

const flushEffects = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe('<PdfRenderer>', () => {
  let container: HTMLDivElement;
  let root: Root;
  let originalResizeObserver: typeof ResizeObserver | undefined;
  let originalClientWidth: PropertyDescriptor | undefined;
  let originalGetContext: typeof HTMLCanvasElement.prototype.getContext;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    originalResizeObserver = globalThis.ResizeObserver;
    originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
    originalGetContext = HTMLCanvasElement.prototype.getContext;

    class MockResizeObserver {
      callback: ResizeObserverCallback;

      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
      }

      disconnect(): void {}

      observe(): void {
        this.callback([], this as unknown as ResizeObserver);
      }

      unobserve(): void {}
    }

    globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get() {
        return 720;
      },
    });
    HTMLCanvasElement.prototype.getContext = vi.fn(() => {
      return {
        clearRect: vi.fn(),
        setTransform: vi.fn(),
      } as unknown as CanvasRenderingContext2D;
    }) as unknown as HTMLCanvasElement['getContext'];

    pdfTestMocks.readFileMock.mockResolvedValue(new Uint8Array([0x25, 0x50, 0x44, 0x46]));
    pdfTestMocks.getViewportMock.mockImplementation(({ scale }: { scale: number }) => ({
      height: 240 * scale,
      width: 180 * scale,
    }));
    pdfTestMocks.renderPageMock.mockReturnValue({
      cancel: pdfTestMocks.renderTaskCancelMock,
      promise: Promise.resolve(),
    });
    pdfTestMocks.getPageMock.mockResolvedValue({
      cleanup: pdfTestMocks.pageCleanupMock,
      getViewport: pdfTestMocks.getViewportMock,
      render: pdfTestMocks.renderPageMock,
    });
    pdfTestMocks.getDocumentMock.mockReturnValue({
      destroy: pdfTestMocks.destroyLoadingTaskMock,
      promise: Promise.resolve({
        destroy: pdfTestMocks.destroyDocumentMock,
        getPage: pdfTestMocks.getPageMock,
        numPages: 5,
      }),
    });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
      await Promise.resolve();
    });
    container.remove();

    if (originalResizeObserver) {
      globalThis.ResizeObserver = originalResizeObserver;
    } else {
      delete (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
    }

    if (originalClientWidth) {
      Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalClientWidth);
    }
    HTMLCanvasElement.prototype.getContext = originalGetContext;

    vi.clearAllMocks();
  });

  it('loads a PDF document, configures worker URL, and responds to keyboard navigation', async () => {
    await act(async () => {
      root.render(<PdfRenderer path="/tmp/report.pdf" />);
    });
    await flushEffects();

    expect(pdfTestMocks.GlobalWorkerOptions.workerSrc).toBe('/pdf.worker.min.mjs');
    expect(pdfTestMocks.readFileMock).toHaveBeenCalledWith('/tmp/report.pdf');
    expect(pdfTestMocks.getDocumentMock).toHaveBeenCalledWith({
      data: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
      disableFontFace: false,
      enableXfa: false,
    });
    expect(pdfTestMocks.getPageMock).toHaveBeenCalledWith(1);
    expect(container.textContent).toContain('Page 1 / 5');

    const viewer = container.querySelector('.tinker-pdf-pane');
    if (!(viewer instanceof HTMLElement)) {
      throw new Error('expected PDF viewer to render');
    }

    await act(async () => {
      viewer.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'PageDown' }));
      await Promise.resolve();
    });
    await flushEffects();
    expect(pdfTestMocks.getPageMock).toHaveBeenLastCalledWith(2);

    await act(async () => {
      viewer.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'End' }));
      await Promise.resolve();
    });
    await flushEffects();
    expect(pdfTestMocks.getPageMock).toHaveBeenLastCalledWith(5);

    await act(async () => {
      viewer.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Home' }));
      await Promise.resolve();
    });
    await flushEffects();
    expect(pdfTestMocks.getPageMock).toHaveBeenLastCalledWith(1);
  });
});
