export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'tinker.theme';

const isTheme = (value: string | null): value is Theme => value === 'light' || value === 'dark';

export const readTheme = (): Theme | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return isTheme(raw) ? raw : null;
  } catch {
    return null;
  }
};

export const writeTheme = (theme: Theme): void => {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* intentionally empty */
  }
};

export const applyTheme = (theme: Theme): void => {
  document.documentElement.dataset.theme = theme;
};
