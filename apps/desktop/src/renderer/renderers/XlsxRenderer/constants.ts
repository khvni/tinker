export const XLSX_ROWS_PER_PAGE = 250;

export const getWorksheetPageCount = (rowCount: number): number => {
  return Math.max(1, Math.ceil(rowCount / XLSX_ROWS_PER_PAGE));
};

export const getWorksheetPageRows = <Row>(
  rows: ReadonlyArray<Row>,
  page: number,
): ReadonlyArray<Row> => {
  const start = page * XLSX_ROWS_PER_PAGE;
  return rows.slice(start, start + XLSX_ROWS_PER_PAGE);
};
