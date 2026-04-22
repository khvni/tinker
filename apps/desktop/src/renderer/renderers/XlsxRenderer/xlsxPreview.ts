import { Workbook, type Worksheet } from 'exceljs';

export type WorksheetPreview = {
  name: string;
  header: string[];
  rows: string[][];
  rowCount: number;
  columnCount: number;
};

export type WorkbookPreview = {
  sheets: WorksheetPreview[];
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const getColumnLabel = (columnIndex: number): string => {
  let label = '';
  let remainder = columnIndex;

  while (remainder > 0) {
    const next = (remainder - 1) % 26;
    label = String.fromCharCode(65 + next) + label;
    remainder = Math.floor((remainder - 1) / 26);
  }

  return label;
};

const padRow = (row: readonly string[], columnCount: number): string[] => {
  return Array.from({ length: columnCount }, (_, index) => row[index] ?? '');
};

export const formatWorksheetCellValue = (value: unknown): string => {
  if (value == null) {
    return '';
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => formatWorksheetCellValue(item))
      .filter((item) => item.length > 0)
      .join(', ');
  }

  if (!isRecord(value)) {
    return String(value);
  }

  const richText = value.richText;
  if (Array.isArray(richText)) {
    return richText
      .map((part) => {
        if (!isRecord(part) || typeof part.text !== 'string') {
          return '';
        }
        return part.text;
      })
      .join('');
  }

  if ('hyperlink' in value && typeof value.hyperlink === 'string') {
    if (typeof value.text === 'string' && value.text.length > 0) {
      return value.text;
    }
    return value.hyperlink;
  }

  if ('text' in value && typeof value.text === 'string') {
    return value.text;
  }

  if ('result' in value) {
    return formatWorksheetCellValue(value.result);
  }

  if ('error' in value && typeof value.error === 'string') {
    return value.error;
  }

  if ('formula' in value && typeof value.formula === 'string') {
    return value.formula;
  }

  return JSON.stringify(value);
};

const buildWorksheetPreview = (worksheet: Worksheet): WorksheetPreview => {
  const rows: string[][] = [];
  const columnCount = worksheet.actualColumnCount;

  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    let lastNonEmptyColumn = 0;

    for (let columnIndex = 1; columnIndex <= columnCount; columnIndex += 1) {
      const cell = formatWorksheetCellValue(row.getCell(columnIndex).value);
      if (cell.length > 0) {
        lastNonEmptyColumn = columnIndex;
      }
      cells.push(cell);
    }

    if (lastNonEmptyColumn === 0) {
      return;
    }

    rows.push(cells.slice(0, lastNonEmptyColumn));
  });

  const widestRow = rows.reduce((max, row) => Math.max(max, row.length), columnCount);

  if (widestRow === 0) {
    return {
      name: worksheet.name,
      header: [],
      rows: [],
      rowCount: 0,
      columnCount: 0,
    };
  }

  const [rawHeader = [], ...rawRows] = rows;
  const header = Array.from({ length: widestRow }, (_, index) => {
    const label = rawHeader[index]?.trim();
    return label && label.length > 0 ? label : getColumnLabel(index + 1);
  });

  const bodyRows = rawRows.map((row) => padRow(row, widestRow));

  return {
    name: worksheet.name,
    header,
    rows: bodyRows,
    rowCount: bodyRows.length,
    columnCount: widestRow,
  };
};

export const parseWorkbookPreview = async (bytes: Uint8Array): Promise<WorkbookPreview> => {
  const workbook = new Workbook();
  await workbook.xlsx.load(bytes.slice().buffer);

  return {
    sheets: workbook.worksheets.map((worksheet) => buildWorksheetPreview(worksheet)),
  };
};
