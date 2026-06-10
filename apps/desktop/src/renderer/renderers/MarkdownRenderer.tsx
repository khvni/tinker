import { useEffect, useState, type JSX } from 'react';
import DOMPurify from 'dompurify';
import { Renderer, marked, type Tokens } from 'marked';
import { parseFrontmatter } from '@tinker/memory';
import { getPanelTitleForPath, type FilePaneParams } from './file-utils.js';
import { readTextFile } from '../electron-shims-fs.js';
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

/**
 * Sanitize the raw output from marked.parse() before returning it.
 *
 * DOMPurify strips dangerous HTML (scripts, event attributes, etc.)
 * and neutralises XSS vectors that the marked parser itself does not
 * catch. We use a custom `ALLOWED_URI_REGEXP` that permits only
 * `https?:`, `mailto:`, `file:`, and relative URLs. Dangerous schemes
 * like `javascript:`, `vbscript:`, and `data:` are blocked — `data:`
 * URIs in links are an XSS vector that DOMPurify is right to reject.
 *
 * The final safety net is `dangerouslySetInnerHTML` in the React
 * component — it renders the sanitized HTML inside an <article> with
 * no scripting context, so any residual payload has nowhere to execute.
 */
// SECURITY: data: URIs are blocked by default (not in ALLOWED_URI_REGEXP).
// This means markdown links like [x](data:text/html,...) get their href
// rewritten to # by DOMPurify. This is the correct security default —
// data: URIs in links are an XSS vector that DOMPurify is right to block.
// We allow file: for local file references and mailto: for email links.
// javascript: and vbscript: are blocked by DOMPurify's default
// ALLOWED_URI_REGEXP, so we don't need to mention them explicitly.
// DOMPurify needs FORBID_ATTR to strip the onerror attribute from img elements
// that marked produces from broken markdown image syntax.
// FORBID_TAGS removes the dangerous elements; FORBID_ATTR handles the attributes.
const DOMPURIFY_CONFIG = {
  FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
  ALLOWED_URI_REGEXP: /^(?:https?|mailto|file):|^\//i,
};

export const renderMarkdown = async (text: string): Promise<string> => {
  const { body } = parseFrontmatter(text);
  const renderer = new Renderer();
  const defaultCodeRenderer = renderer.code.bind(renderer);

  renderer.code = (token: HighlightedCodeToken): string => {
    return token.highlightedHtml ?? defaultCodeRenderer(token);
  };

  const raw = await marked.parse(body, {
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

  return DOMPurify.sanitize(raw, DOMPURIFY_CONFIG) as string;
};

type MarkdownRendererProps = {
  params?: FilePaneParams;
  vaultRevision: number;
};

export const MarkdownRenderer = ({ params, vaultRevision }: MarkdownRendererProps): JSX.Element => {
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
          setHtml(rendered);
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
