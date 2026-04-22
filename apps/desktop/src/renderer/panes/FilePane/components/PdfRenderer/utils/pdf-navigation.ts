const clampPage = (page: number, pageCount: number): number => {
  return Math.min(Math.max(page, 1), pageCount);
};

export const getNextPdfPage = (key: string, pageNumber: number, pageCount: number): number => {
  if (pageCount <= 0) {
    return 1;
  }

  switch (key) {
    case 'PageUp':
      return clampPage(pageNumber - 1, pageCount);
    case 'PageDown':
      return clampPage(pageNumber + 1, pageCount);
    case 'Home':
      return 1;
    case 'End':
      return pageCount;
    default:
      return pageNumber;
  }
};
