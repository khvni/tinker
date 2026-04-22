import { describe, expect, it } from 'vitest';
import { Workbook } from 'exceljs';
import { getWorksheetPageCount, getWorksheetPageRows, XLSX_ROWS_PER_PAGE } from './constants.js';
import { formatWorksheetCellValue, parseWorkbookPreview } from './xlsxPreview.js';

const createWorkbookBytes = async (): Promise<Uint8Array> => {
  const workbook = new Workbook();
  const summary = workbook.addWorksheet('Summary');
  summary.addRow(['Name', 'Score', 'Notes']);
  summary.addRow(['Ada', 42, { formula: '21*2', result: 42 }]);
  summary.addRow([
    {
      richText: [
        { text: 'Hello' },
        { text: ' world' },
      ],
    },
    true,
    { hyperlink: 'https://example.com', text: 'Spec' },
  ]);

  const backlog = workbook.addWorksheet('Backlog');
  backlog.addRow(['Task']);
  for (let index = 0; index < XLSX_ROWS_PER_PAGE + 10; index += 1) {
    backlog.addRow([`Row ${index + 1}`]);
  }

  return new Uint8Array(await workbook.xlsx.writeBuffer());
};

describe('xlsxPreview helpers', () => {
  it('formats structured Excel cell values into readable text', () => {
    expect(formatWorksheetCellValue({ formula: '2+2', result: 4 })).toBe('4');
    expect(
      formatWorksheetCellValue({
        richText: [{ text: 'Hello' }, { text: ' world' }],
      }),
    ).toBe('Hello world');
    expect(formatWorksheetCellValue({ hyperlink: 'https://example.com', text: 'Spec' })).toBe('Spec');
  });

  it('parses workbook previews with first-sheet default data and multiple sheets', async () => {
    const preview = await parseWorkbookPreview(await createWorkbookBytes());

    expect(preview.sheets.map((sheet) => sheet.name)).toEqual(['Summary', 'Backlog']);
    expect(preview.sheets[0]).toMatchObject({
      name: 'Summary',
      header: ['Name', 'Score', 'Notes'],
      rows: [
        ['Ada', '42', '42'],
        ['Hello world', 'true', 'Spec'],
      ],
      rowCount: 2,
      columnCount: 3,
    });
  });

  it('keeps large sheets paged instead of rendering every row at once', () => {
    const rows = Array.from({ length: XLSX_ROWS_PER_PAGE + 10 }, (_, index) => [`Row ${index + 1}`]);

    expect(getWorksheetPageCount(rows.length)).toBe(2);
    expect(getWorksheetPageRows(rows, 0)).toHaveLength(XLSX_ROWS_PER_PAGE);
    expect(getWorksheetPageRows(rows, 1)).toHaveLength(10);
  });
});
