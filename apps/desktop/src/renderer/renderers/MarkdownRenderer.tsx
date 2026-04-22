import { useEffect, useState, type JSX } from 'react';
import DOMPurify from 'dompurify';
import { Renderer, marked, type Tokens } from 'marked';
import type { IDockviewPanelProps } from 'dockview-react';
import { parseFrontmatter } from '@tinker/memory';
import { getPanelTitleForPath, type FilePaneParams } from './file-utils.js';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { highlightCode } from './code-highlighter.js';

const escapeHtml = (value: string): string => {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
};

const getCodeFenceLanguage = (lang?: string): string => {
  const language = lang?.trim().split(/\s+/u, 1)[0];
  return language && language.length > 0 ? language : 'plaintext';
};

const renderHighlightedCodeBlock = async (text: string, lang?: string): Promise<string> => {
  const language = getCodeFenceLanguage(lang);
  const highlightedHtml = await highlightCode(text, language);
  const codeClassName = highlightedHtml
    ? `tinker-code-content hljs language-${language}`
    : `tinker-code-content language-${language}`;
  const blockClassName = highlightedHtml
    ? 'tinker-code-block tinker-code-block--highlighted'
    : 'tinker-code-block';

  return `<pre class="${blockClassName}"><code class="${codeClassName}">${
    highlightedHtml ?? escapeHtml(text)
  }</code></pre>`;
};

type HighlightedCodeToken = Tokens.Code & {
  highlightedHtml?: string;
};

export const renderMarkdown = async (text: string): Promise<string> => {
  const { body } = parseFrontmatter(text);
  const renderer = new Renderer();
  const defaultCodeRenderer = renderer.code.bind(renderer);

  renderer.code = (token: HighlightedCodeToken): string => {
    return token.highlightedHtml ?? defaultCodeRenderer(token);
  };

  return await marked.parse(body, {
    async: true,
    gfm: true,
    renderer,
    async walkTokens(token): Promise<void> {
      if (token.type !== 'code') {
        return;
      }

      const codeToken = token as HighlightedCodeToken;
      codeToken.highlightedHtml = await renderHighlightedCodeBlock(codeToken.text, codeToken.lang);
    },
  });
};

type MarkdownRendererProps = IDockviewPanelProps<FilePaneParams> & {
  vaultRevision: number;
};

export const MarkdownRenderer = ({ api, params, vaultRevision }: MarkdownRendererProps): JSX.Element => {
  void api;
  const path = params?.path;
  const [html, setHtml] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setError('Missing markdown file path.');
      setHtml('');
      return;
    }

    let active = true;

    void (async () => {
      try {
        setError(null);
        const text = await readTextFile(path);
        const rendered = await renderMarkdown(text);
        if (active) {
          setHtml(DOMPurify.sanitize(rendered));
        }
      } catch (nextError) {
        if (active) {
          setError(nextError instanceof Error ? nextError.message : String(nextError));
          setHtml('');
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [path, vaultRevision]);

  return (
    <section className="tinker-pane tinker-renderer-pane">
      <header className="tinker-pane-header">
        <div>
          <p className="tinker-eyebrow">Markdown</p>
          <h2>{path ? getPanelTitleForPath(path) : 'Untitled note'}</h2>
        </div>
      </header>

      {error ? <p className="tinker-muted">{error}</p> : null}
      {!error && html ? <article className="tinker-markdown-body" dangerouslySetInnerHTML={{ __html: html }} /> : null}
    </section>
  );
};
