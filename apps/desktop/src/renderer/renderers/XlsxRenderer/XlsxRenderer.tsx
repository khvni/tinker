import { useEffect, useMemo, useState, type JSX } from 'react';
import { Badge, Button, SegmentedControl } from '@tinker/design';
import { readFile } from '@tauri-apps/plugin-fs';
import { getPanelTitleForPath, type FilePaneParams } from '../file-utils.js';
import { getWorksheetPageCount, getWorksheetPageRows, XLSX_ROWS_PER_PAGE } from './constants.js';
import './XlsxRenderer.css';
import type { WorkbookPreview } from './xlsxPreview.js';

const getDefaultSheetName = (workbook: WorkbookPreview | null): string | null => {
  return workbook?.sheets[0]?.name ?? null;
};

export const XlsxRenderer = ({ params }: { params?: FilePaneParams }): JSX.Element => {
  const path = params?.path;
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [sheetName, setSheetName] = useState<string | null>(null);
  const [workbook, setWorkbook] = useState<WorkbookPreview | null>(null);

  useEffect(() => {
    if (!path) {
      setError('Missing workbook file path.');
      setWorkbook(null);
      setSheetName(null);
      return;
    }

    let active = true;

    void (async () => {
      try {
        setError(null);
        setPage(0);
        setWorkbook(null);
        setSheetName(null);

        const [bytes, previewModule] = await Promise.all([
          readFile(path),
          import('./xlsxPreview.js'),
        ]);
        const nextWorkbook = await previewModule.parseWorkbookPreview(bytes);

        if (!active) {
          return;
        }

        setWorkbook(nextWorkbook);
        setSheetName(getDefaultSheetName(nextWorkbook));
      } catch (nextError) {
        if (!active) {
          return;
        }

        setError(nextError instanceof Error ? nextError.message : String(nextError));
        setWorkbook(null);
        setSheetName(null);
      }
    })();

    return () => {
      active = false;
    };
  }, [path]);

  useEffect(() => {
    setPage(0);
  }, [sheetName]);

  const activeSheet = useMemo(() => {
    if (!workbook) {
      return null;
    }

    if (!sheetName) {
      return workbook.sheets[0] ?? null;
    }

    return workbook.sheets.find((sheet) => sheet.name === sheetName) ?? workbook.sheets[0] ?? null;
  }, [sheetName, workbook]);

  const pageCount = activeSheet ? getWorksheetPageCount(activeSheet.rows.length) : 1;
  const visibleRows = useMemo(() => {
    return activeSheet ? getWorksheetPageRows(activeSheet.rows, page) : [];
  }, [activeSheet, page]);
  const hasPaging = Boolean(activeSheet && activeSheet.rows.length > XLSX_ROWS_PER_PAGE);
  const sheetOptions = useMemo(() => {
    return workbook?.sheets.map((sheet) => ({ value: sheet.name, label: sheet.name })) ?? [];
  }, [workbook]);

  return (
    <section className="tinker-pane tinker-renderer-pane">
      <header className="tinker-pane-header">
        <div>
          <p className="tinker-eyebrow">Workbook</p>
          <h2>{path ? getPanelTitleForPath(path) : 'Untitled workbook'}</h2>
        </div>
        {activeSheet ? (
          <div className="tinker-xlsx-header-meta">
            <Badge variant="default" size="small">
              {workbook?.sheets.length ?? 0} sheets
            </Badge>
            <Badge variant="default" size="small">
              {activeSheet.columnCount} columns
            </Badge>
            <Badge variant="default" size="small">
              {activeSheet.rowCount} data rows
            </Badge>
            {hasPaging ? (
              <Badge variant="accent" size="small">
                {XLSX_ROWS_PER_PAGE} rows per page
              </Badge>
            ) : null}
          </div>
        ) : null}
      </header>

      {error ? <p className="tinker-muted">{error}</p> : null}

      {!error && workbook && activeSheet ? (
        <>
          {sheetOptions.length > 1 ? (
            <div className="tinker-xlsx-toolbar">
              <SegmentedControl
                label="Workbook sheets"
                options={sheetOptions}
                value={activeSheet.name}
                onChange={setSheetName}
              />
            </div>
          ) : null}

          {activeSheet.columnCount === 0 ? (
            <p className="tinker-muted">Sheet is empty.</p>
          ) : (
            <>
              {hasPaging ? (
                <p className="tinker-muted tinker-xlsx-note">
                  Read-only preview. Large sheets show {XLSX_ROWS_PER_PAGE} rows per page to keep UI responsive.
                </p>
              ) : null}

              <div className="tinker-table-wrap">
                <table className="tinker-table" aria-label={`${activeSheet.name} workbook preview`}>
                  <thead>
                    <tr>
                      {activeSheet.header.map((cell, index) => (
                        <th key={`${activeSheet.name}-header-${index}`}>{cell}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row, rowIndex) => (
                      <tr key={`${activeSheet.name}-${page}-${rowIndex}`}>
                        {row.map((cell, cellIndex) => (
                          <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {hasPaging ? (
                <div className="tinker-inline-actions">
                  <Badge variant="ghost" size="small">
                    page {page + 1} / {pageCount}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="s"
                    onClick={() => setPage((current) => Math.max(0, current - 1))}
                    disabled={page === 0}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    size="s"
                    onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
                    disabled={page >= pageCount - 1}
                  >
                    Next
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </>
      ) : null}
    </section>
  );
};
