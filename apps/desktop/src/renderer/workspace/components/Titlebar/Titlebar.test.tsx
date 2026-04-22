// @vitest-environment jsdom

// @ts-expect-error React uses this flag in tests.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { Titlebar } from './Titlebar.js';

describe('<Titlebar>', () => {
  it('renders the brand label', () => {
    const markup = renderToStaticMarkup(
      <Titlebar
        sessionFolderPath={null}
        isLeftRailVisible
        isRightInspectorVisible
        onToggleLeftRail={() => undefined}
        onToggleRightInspector={() => undefined}
      />,
    );
    expect(markup).toContain('Tinker');
  });

  it('shows the basename crumb when sessionFolderPath is set', () => {
    const markup = renderToStaticMarkup(
      <Titlebar
        sessionFolderPath="/Users/foo/bar/baz"
        isLeftRailVisible
        isRightInspectorVisible
        onToggleLeftRail={() => undefined}
        onToggleRightInspector={() => undefined}
      />,
    );
    expect(markup).toContain('tinker-titlebar__crumb');
    expect(markup).toContain('>baz<');
  });

  it('sets the full sessionFolderPath as the crumb title attribute', () => {
    const markup = renderToStaticMarkup(
      <Titlebar
        sessionFolderPath="/Users/foo/projects/very-long-folder-name-here"
        isLeftRailVisible
        isRightInspectorVisible
        onToggleLeftRail={() => undefined}
        onToggleRightInspector={() => undefined}
      />,
    );
    expect(markup).toMatch(
      /<span[^>]*class="tinker-titlebar__crumb"[^>]*title="\/Users\/foo\/projects\/very-long-folder-name-here"/,
    );
  });

  it('shows only the brand when sessionFolderPath is null', () => {
    const markup = renderToStaticMarkup(
      <Titlebar
        sessionFolderPath={null}
        isLeftRailVisible
        isRightInspectorVisible
        onToggleLeftRail={() => undefined}
        onToggleRightInspector={() => undefined}
      />,
    );
    expect(markup).not.toContain('tinker-titlebar__crumb');
    expect(markup).not.toContain('tinker-titlebar__sep');
  });

  it('trims trailing separators before picking the basename', () => {
    const withTrailing = renderToStaticMarkup(
      <Titlebar
        sessionFolderPath="/Users/foo/bar/baz/"
        isLeftRailVisible
        isRightInspectorVisible
        onToggleLeftRail={() => undefined}
        onToggleRightInspector={() => undefined}
      />,
    );
    expect(withTrailing).toContain('>baz<');
  });

  it('marks the root with data-tauri-drag-region', () => {
    const markup = renderToStaticMarkup(
      <Titlebar
        sessionFolderPath={null}
        isLeftRailVisible
        isRightInspectorVisible
        onToggleLeftRail={() => undefined}
        onToggleRightInspector={() => undefined}
      />,
    );
    expect(markup).toMatch(/<header[^>]*class="tinker-titlebar"[^>]*data-tauri-drag-region/);
  });

  it('marks the actions cluster with data-tauri-drag-region="false"', () => {
    const markup = renderToStaticMarkup(
      <Titlebar
        sessionFolderPath={null}
        isLeftRailVisible
        isRightInspectorVisible
        onToggleLeftRail={() => undefined}
        onToggleRightInspector={() => undefined}
      />,
    );
    expect(markup).toMatch(
      /<div[^>]*class="tinker-titlebar__actions"[^>]*data-tauri-drag-region="false"/,
    );
  });

  it('reflects rail visibility via aria-pressed on each toggle', () => {
    const collapsed = renderToStaticMarkup(
      <Titlebar
        sessionFolderPath={null}
        isLeftRailVisible={false}
        isRightInspectorVisible
        onToggleLeftRail={() => undefined}
        onToggleRightInspector={() => undefined}
      />,
    );
    expect(collapsed).toMatch(
      /<button[^>]*aria-label="Toggle left sidebar"[^>]*aria-pressed="true"/,
    );
    expect(collapsed).toMatch(
      /<button[^>]*aria-label="Toggle right inspector"[^>]*aria-pressed="false"/,
    );
  });

  it('keeps the actions cluster to the two Paper window toggles only', () => {
    const markup = renderToStaticMarkup(
      <Titlebar
        sessionFolderPath={null}
        isLeftRailVisible
        isRightInspectorVisible
        onToggleLeftRail={() => undefined}
        onToggleRightInspector={() => undefined}
      />,
    );
    const container = document.createElement('div');
    container.innerHTML = markup;

    const buttons = Array.from(container.querySelectorAll('button')).map((button) =>
      button.getAttribute('aria-label'),
    );

    expect(buttons).toEqual(['Toggle left sidebar', 'Toggle right inspector']);
  });

  it('leaves the traffic-light spacer free to inherit drag-region from the header', () => {
    const markup = renderToStaticMarkup(
      <Titlebar
        sessionFolderPath={null}
        isLeftRailVisible
        isRightInspectorVisible
        onToggleLeftRail={() => undefined}
        onToggleRightInspector={() => undefined}
      />,
    );
    expect(markup).toMatch(/<div[^>]*class="tinker-titlebar__spacer"[^>]*>/);
    expect(markup).not.toMatch(
      /<div[^>]*class="tinker-titlebar__spacer"[^>]*data-tauri-drag-region="false"/,
    );
  });

  describe('click handlers', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);
      root = createRoot(container);
    });

    afterEach(() => {
      act(() => root.unmount());
      container.remove();
    });

    const renderTitlebar = (handlers: {
      onToggleLeftRail?: () => void;
      onToggleRightInspector?: () => void;
    }): void => {
      act(() => {
        root.render(
          <Titlebar
            sessionFolderPath={null}
            isLeftRailVisible
            isRightInspectorVisible
            onToggleLeftRail={handlers.onToggleLeftRail ?? (() => undefined)}
            onToggleRightInspector={handlers.onToggleRightInspector ?? (() => undefined)}
          />,
        );
      });
    };

    const clickByLabel = (label: string): void => {
      const button = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
      expect(button).not.toBeNull();
      if (button) {
        act(() => {
          button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        });
      }
    };

    it('invokes onToggleLeftRail when the left pane toggle is clicked', () => {
      const spy = vi.fn();
      renderTitlebar({ onToggleLeftRail: spy });
      clickByLabel('Toggle left sidebar');
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('invokes onToggleRightInspector when the right inspector toggle is clicked', () => {
      const spy = vi.fn();
      renderTitlebar({ onToggleRightInspector: spy });
      clickByLabel('Toggle right inspector');
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('does not dispatch any internal handler when the titlebar is double-clicked', () => {
      const toggleLeftRail = vi.fn();
      const toggleRightInspector = vi.fn();
      renderTitlebar({
        onToggleLeftRail: toggleLeftRail,
        onToggleRightInspector: toggleRightInspector,
      });
      const header = container.querySelector<HTMLElement>('header.tinker-titlebar');
      expect(header).not.toBeNull();
      act(() => {
        header?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
      });
      expect(toggleLeftRail).not.toHaveBeenCalled();
      expect(toggleRightInspector).not.toHaveBeenCalled();
    });
  });

  describe('Playbook affordance', () => {
    it('omits the Playbook button when onOpenPlaybook is not provided', () => {
      const markup = renderToStaticMarkup(
        <Titlebar
          sessionFolderPath={null}
          isLeftRailVisible
          isRightInspectorVisible
          onToggleLeftRail={() => undefined}
          onToggleRightInspector={() => undefined}
        />,
      );
      expect(markup).not.toContain('aria-label="Playbook"');
    });

    it('renders the Playbook button with a stacked-book glyph when the callback is provided', () => {
      const markup = renderToStaticMarkup(
        <Titlebar
          sessionFolderPath={null}
          isLeftRailVisible
          isRightInspectorVisible
          onToggleLeftRail={() => undefined}
          onToggleRightInspector={() => undefined}
          onOpenPlaybook={() => undefined}
        />,
      );
      expect(markup).toContain('aria-label="Playbook"');
      // Stacked-book glyph: vertical spine + two shelf lines.
      expect(markup).toContain('M7 5v14');
      expect(markup).toContain('M9 9h5M9 12h5');
    });
  });
});
