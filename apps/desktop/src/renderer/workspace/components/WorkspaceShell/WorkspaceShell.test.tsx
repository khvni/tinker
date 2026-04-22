// @vitest-environment jsdom

// @ts-expect-error React uses this flag in tests.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { WorkspaceShell } from './WorkspaceShell.js';

describe('WorkspaceShell', () => {
  it('renders titlebar, sidebar, and content slots in document order', () => {
    const markup = renderToStaticMarkup(
      <WorkspaceShell
        titlebar={<header data-testid="titlebar">titlebar</header>}
        sidebar={<nav data-testid="sidebar">sidebar</nav>}
      >
        <div data-testid="content">content</div>
      </WorkspaceShell>,
    );

    const titlebarAt = markup.indexOf('data-testid="titlebar"');
    const sidebarAt = markup.indexOf('data-testid="sidebar"');
    const contentAt = markup.indexOf('data-testid="content"');

    expect(titlebarAt).toBeGreaterThanOrEqual(0);
    expect(sidebarAt).toBeGreaterThan(titlebarAt);
    expect(contentAt).toBeGreaterThan(sidebarAt);
  });

  it('wraps children with the token-driven shell class names', () => {
    const markup = renderToStaticMarkup(
      <WorkspaceShell titlebar={null} sidebar={null}>
        <span>content</span>
      </WorkspaceShell>,
    );

    expect(markup).toContain('tinker-workspace-shell');
    expect(markup).toContain('tinker-workspace-shell__titlebar');
    expect(markup).toContain('tinker-workspace-shell__body');
    expect(markup).toContain('tinker-workspace-shell__sidebar');
    expect(markup).toContain('tinker-workspace-shell__content');
  });
});
