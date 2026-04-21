import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, readTheme, writeTheme } from './theme.js';

type StubStorage = {
  store: Map<string, string>;
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
};

const createStubStorage = (): StubStorage => {
  const store = new Map<string, string>();
  return {
    store,
    getItem: (key) => (store.has(key) ? (store.get(key) ?? null) : null),
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
};

type StubDocument = {
  documentElement: { dataset: Record<string, string> };
};

const createStubDocument = (): StubDocument => ({
  documentElement: { dataset: {} },
});

describe('theme', () => {
  let storage: StubStorage;
  let doc: StubDocument;

  beforeEach(() => {
    storage = createStubStorage();
    doc = createStubDocument();
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('document', doc);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null when theme is unset', () => {
    expect(readTheme()).toBeNull();
  });

  it('roundtrips light and dark through localStorage', () => {
    writeTheme('light');
    expect(readTheme()).toBe('light');

    writeTheme('dark');
    expect(readTheme()).toBe('dark');
  });

  it('returns null when localStorage contains a garbage value', () => {
    storage.setItem('tinker.theme', 'neon');
    expect(readTheme()).toBeNull();
  });

  it('applies the theme to documentElement.dataset.theme', () => {
    applyTheme('dark');
    expect(doc.documentElement.dataset.theme).toBe('dark');

    applyTheme('light');
    expect(doc.documentElement.dataset.theme).toBe('light');
  });
});
