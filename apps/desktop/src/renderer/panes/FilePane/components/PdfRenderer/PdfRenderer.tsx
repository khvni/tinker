import { useEffect, useRef, useState, type JSX, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Badge, Button } from '@tinker/design';
import { readFile } from '@tauri-apps/plugin-fs';
import {
  AnnotationMode,
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentLoadingTask,
  type PDFDocumentProxy,
  type RenderTask,
} from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { getPanelTitleForPath } from '../../../../renderers/file-utils.js';
import { getNextPdfPage } from './utils/pdf-navigation.js';
import './PdfRenderer.css';

export type PdfRendererProps = {
  path: string;
};

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const isPdfAbortError = (error: unknown): boolean => {
  return error instanceof Error
    && (error.name === 'AbortException' || error.name === 'RenderingCancelledException');
};

export const PdfRenderer = ({ path }: PdfRendererProps): JSX.Element => {
  const [documentProxy, setDocumentProxy] = useState<PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingDocument, setIsLoadingDocument] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const documentRef = useRef<PDFDocumentProxy | null>(null);
  const loadingTaskRef = useRef<PDFDocumentLoadingTask | null>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const viewerRef = useRef<HTMLElement | null>(null);
  const canvasWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!path) {
      setError('Missing PDF file path.');
      setDocumentProxy(null);
      setPageCount(0);
      setPageNumber(1);
      return;
    }

    let active = true;
    const previousDocument = documentRef.current;
    const previousLoadingTask = loadingTaskRef.current;
    documentRef.current = null;
    loadingTaskRef.current = null;
    renderTaskRef.current?.cancel();
    renderTaskRef.current = null;
    setIsLoadingDocument(true);
    setError(null);
    setDocumentProxy(null);
    setPageCount(0);
    setPageNumber(1);

    void previousLoadingTask?.destroy();
    void previousDocument?.destroy();

    void (async () => {
      try {
        const bytes = await readFile(path);
        if (!active) {
          return;
        }

        const loadingTask = getDocument({
          data: bytes,
          disableFontFace: false,
          enableXfa: false,
        });
        loadingTaskRef.current = loadingTask;

        const nextDocument = await loadingTask.promise;
        if (!active) {
          await nextDocument.destroy();
          return;
        }

        documentRef.current = nextDocument;
        setDocumentProxy(nextDocument);
        setPageCount(nextDocument.numPages);
        setPageNumber(1);
      } catch (nextError) {
        if (active && !isPdfAbortError(nextError)) {
          setError(nextError instanceof Error ? nextError.message : String(nextError));
        }
      } finally {
        if (active) {
          setIsLoadingDocument(false);
        }
      }
    })();

    return () => {
      active = false;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
      const loadingTask = loadingTaskRef.current;
      const loadedDocument = documentRef.current;
      loadingTaskRef.current = null;
      documentRef.current = null;
      void loadingTask?.destroy();
      void loadedDocument?.destroy();
    };
  }, [path]);

  useEffect(() => {
    const canvasWrap = canvasWrapRef.current;
    if (!canvasWrap) {
      return;
    }

    const updateWidth = (): void => {
      const styles = window.getComputedStyle(canvasWrap);
      const horizontalPadding = Number.parseFloat(styles.paddingLeft) + Number.parseFloat(styles.paddingRight);
      setContainerWidth(Math.max(canvasWrap.clientWidth - horizontalPadding, 0));
    };

    updateWidth();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateWidth);
      return () => {
        window.removeEventListener('resize', updateWidth);
      };
    }

    const observer = new ResizeObserver(() => {
      updateWidth();
    });
    observer.observe(canvasWrap);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!documentProxy || !canvasRef.current || containerWidth <= 0) {
      return;
    }

    let active = true;
    const canvas = canvasRef.current;

    void (async () => {
      try {
        renderTaskRef.current?.cancel();

        const page = await documentProxy.getPage(pageNumber);
        if (!active) {
          page.cleanup();
          return;
        }

        const context = canvas.getContext('2d');
        if (!context) {
          throw new Error('PDF preview canvas is unavailable.');
        }

        const baseViewport = page.getViewport({ scale: 1 });
        const scale = Math.max(containerWidth / baseViewport.width, 0.1);
        const viewport = page.getViewport({ scale });
        const outputScale = window.devicePixelRatio || 1;

        canvas.width = Math.ceil(viewport.width * outputScale);
        canvas.height = Math.ceil(viewport.height * outputScale);
        canvas.style.width = `${Math.ceil(viewport.width)}px`;
        canvas.style.height = `${Math.ceil(viewport.height)}px`;

        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, canvas.width, canvas.height);

        const renderTask = page.render({
          annotationMode: AnnotationMode.ENABLE,
          canvasContext: context,
          transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
          viewport,
        });
        renderTaskRef.current = renderTask;
        await renderTask.promise;
        page.cleanup();
      } catch (nextError) {
        if (active && !isPdfAbortError(nextError)) {
          setError(nextError instanceof Error ? nextError.message : String(nextError));
        }
      }
    })();

    return () => {
      active = false;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
    };
  }, [containerWidth, documentProxy, pageNumber]);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLElement>): void => {
    const nextPage = getNextPdfPage(event.key, pageNumber, pageCount);
    if (nextPage === pageNumber) {
      return;
    }

    event.preventDefault();
    setPageNumber(nextPage);
  };

  const focusViewer = (): void => {
    viewerRef.current?.focus();
  };

  const canGoBackward = pageNumber > 1;
  const canGoForward = pageNumber < pageCount;

  return (
    <section
      ref={viewerRef}
      className="tinker-pane tinker-renderer-pane tinker-pdf-pane"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-busy={isLoadingDocument}
    >
      <header className="tinker-pane-header">
        <div>
          <p className="tinker-eyebrow">PDF</p>
          <h2>{getPanelTitleForPath(path)}</h2>
        </div>
        {pageCount > 0 ? (
          <Badge variant="default" size="small">
            Page {pageNumber} / {pageCount}
          </Badge>
        ) : null}
      </header>

      <div className="tinker-inline-actions tinker-pdf-toolbar">
        <div className="tinker-pdf-toolbar-buttons">
          <Button
            variant="ghost"
            size="s"
            onClick={() => setPageNumber((current) => Math.max(1, current - 1))}
            disabled={!canGoBackward}
          >
            Previous
          </Button>
          <Button
            variant="secondary"
            size="s"
            onClick={() => setPageNumber((current) => Math.min(pageCount, current + 1))}
            disabled={!canGoForward}
          >
            Next
          </Button>
        </div>
        <p className="tinker-muted tinker-pdf-status">Keys: PgUp / PgDn / Home / End</p>
      </div>

      {error ? <p className="tinker-muted">{error}</p> : null}
      {!error && isLoadingDocument ? <p className="tinker-muted">Loading PDF preview…</p> : null}

      {!error ? (
        <div
          ref={canvasWrapRef}
          className="tinker-pdf-canvas-wrap"
          onMouseDown={focusViewer}
          onTouchStart={focusViewer}
        >
          <canvas ref={canvasRef} className="tinker-pdf-canvas" />
        </div>
      ) : null}
    </section>
  );
};
