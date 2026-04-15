import type { HLJSApi, LanguageFn } from 'highlight.js';

type HighlightLanguageModule = {
  default: LanguageFn;
};

export const MAX_HIGHLIGHTABLE_CODE_LENGTH = 200_000;

const LANGUAGE_LOADERS: Record<string, () => Promise<HighlightLanguageModule>> = {
  bash: () => import('highlight.js/lib/languages/bash'),
  c: () => import('highlight.js/lib/languages/c'),
  cpp: () => import('highlight.js/lib/languages/cpp'),
  css: () => import('highlight.js/lib/languages/css'),
  go: () => import('highlight.js/lib/languages/go'),
  html: () => import('highlight.js/lib/languages/xml'),
  java: () => import('highlight.js/lib/languages/java'),
  javascript: () => import('highlight.js/lib/languages/javascript'),
  json: () => import('highlight.js/lib/languages/json'),
  jsx: () => import('highlight.js/lib/languages/javascript'),
  markdown: () => import('highlight.js/lib/languages/markdown'),
  python: () => import('highlight.js/lib/languages/python'),
  rust: () => import('highlight.js/lib/languages/rust'),
  sql: () => import('highlight.js/lib/languages/sql'),
  tsx: () => import('highlight.js/lib/languages/typescript'),
  typescript: () => import('highlight.js/lib/languages/typescript'),
  xml: () => import('highlight.js/lib/languages/xml'),
  yaml: () => import('highlight.js/lib/languages/yaml'),
};

let highlighterPromise: Promise<HLJSApi> | null = null;
const languageLoadPromises = new Map<string, Promise<void>>();

const loadHighlighter = async (): Promise<HLJSApi> => {
  highlighterPromise ??= import('highlight.js/lib/core').then((module) => module.default as HLJSApi);
  return highlighterPromise;
};

const ensureLanguage = async (highlighter: HLJSApi, language: string): Promise<boolean> => {
  if (highlighter.getLanguage(language)) {
    return true;
  }

  const loader = LANGUAGE_LOADERS[language];
  if (!loader) {
    return false;
  }

  let pendingLoad = languageLoadPromises.get(language);
  if (!pendingLoad) {
    pendingLoad = loader()
      .then((module) => {
        highlighter.registerLanguage(language, module.default);
      })
      .finally(() => {
        languageLoadPromises.delete(language);
      });
    languageLoadPromises.set(language, pendingLoad);
  }

  await pendingLoad;
  return Boolean(highlighter.getLanguage(language));
};

export const highlightCode = async (code: string, language: string): Promise<string | null> => {
  if (code.length > MAX_HIGHLIGHTABLE_CODE_LENGTH) {
    return null;
  }

  const highlighter = await loadHighlighter();
  const registered = await ensureLanguage(highlighter, language);
  if (!registered) {
    return null;
  }

  try {
    return highlighter.highlight(code, { ignoreIllegals: true, language }).value;
  } catch {
    return null;
  }
};
