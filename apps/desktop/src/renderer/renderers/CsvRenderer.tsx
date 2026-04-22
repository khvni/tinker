import { useEffect, useMemo, useState, type JSX } from 'react';
import { Badge, Button } from '@tinker/design';
import { readTextFile } from '@tauri-apps/plugin-fs';
import Papa, { type ParseResult } from 'papaparse';
import { getPanelTitleForPath } from './file-utils.js';

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

export type CsvRendererProps = {
  path: string;
};

export const CsvRenderer = ({ path }: CsvRendererProps): JSX.Element => {
  const [parsed, setParsed] = useState<ParsedCsv>({ header: [], rows: [] });
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
          <h2>{getPanelTitleForPath(path)}</h2>
        </div>
        <Badge variant="default" size="small">
          {parsed.rows.length} rows · page {page + 1} / {pageCount}
        </Badge>
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
      ) : null}
    </section>
  );
};
