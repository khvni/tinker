import { useEffect, useMemo, useState, type JSX } from 'react';
import { readTextFile } from '@tauri-apps/plugin-fs';
import type { IDockviewPanelProps } from 'dockview-react';
import Papa, { type ParseResult } from 'papaparse';
import { getPanelTitleForPath, type FilePaneParams } from './file-utils.js';

const ROWS_PER_PAGE = 500;

type ParsedCsv = {
  header: string[];
  rows: string[][];
};

const parseCsv = (text: string): ParsedCsv => {
  const parsed: ParseResult<string[]> = Papa.parse<string[]>(text.trim(), {
    skipEmptyLines: true,
  });

  const rows = parsed.data.filter((row): row is string[] => Array.isArray(row));
  const [header = [], ...body] = rows;

  return {
    header,
    rows: body,
  };
};

export const CsvRenderer = ({ params }: IDockviewPanelProps<FilePaneParams>): JSX.Element => {
  const path = params?.path;
  const [parsed, setParsed] = useState<ParsedCsv>({ header: [], rows: [] });
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setError('Missing CSV file path.');
      setParsed({ header: [], rows: [] });
      return;
    }

    let active = true;

    void (async () => {
      try {
        setError(null);
        setPage(0);
        const text = await readTextFile(path);
        if (active) {
          setParsed(parseCsv(text));
        }
      } catch (nextError) {
        if (active) {
          setError(nextError instanceof Error ? nextError.message : String(nextError));
          setParsed({ header: [], rows: [] });
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [path]);

  const pageCount = Math.max(1, Math.ceil(parsed.rows.length / ROWS_PER_PAGE));
  const visibleRows = useMemo(() => {
    const start = page * ROWS_PER_PAGE;
    return parsed.rows.slice(start, start + ROWS_PER_PAGE);
  }, [page, parsed.rows]);

  return (
    <section className="tinker-pane tinker-renderer-pane">
      <header className="tinker-pane-header">
        <div>
          <p className="tinker-eyebrow">CSV</p>
          <h2>{path ? getPanelTitleForPath(path) : 'Untitled table'}</h2>
        </div>
        <span className="tinker-pill">
          {parsed.rows.length} rows • page {page + 1} / {pageCount}
        </span>
      </header>

      {error ? <p className="tinker-muted">{error}</p> : null}

      {!error ? (
        <>
          <div className="tinker-table-wrap">
            <table className="tinker-table">
              <thead>
                <tr>
                  {parsed.header.map((cell, index) => (
                    <th key={`${cell}-${index}`}>{cell}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, rowIndex) => (
                  <tr key={`${page}-${rowIndex}`}>
                    {row.map((cell, cellIndex) => (
                      <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {parsed.rows.length > ROWS_PER_PAGE ? (
            <div className="tinker-inline-actions">
              <button className="tinker-button-ghost" type="button" onClick={() => setPage((current) => Math.max(0, current - 1))} disabled={page === 0}>
                Previous
              </button>
              <button
                className="tinker-button-secondary"
                type="button"
                onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
                disabled={page >= pageCount - 1}
              >
                Next
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
};
