// @vitest-environment jsdom

// @ts-expect-error React uses this flag in tests.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Titlebar } from './Titlebar.js';

describe('<Titlebar>', () => {
  it('renders the brand label', () => {
    const markup = renderToStaticMarkup(
      <Titlebar
        sessionFolderPath={null}
        onNewSession={() => undefined}
        onOpenMemory={() => undefined}
        onOpenSettings={() => undefined}
      />,
    );
    expect(markup).toContain('Tinker');
  });

  it('shows the basename crumb when sessionFolderPath is set', () => {
    const markup = renderToStaticMarkup(
      <Titlebar
        sessionFolderPath="/Users/foo/bar/baz"
        onNewSession={() => undefined}
        onOpenMemory={() => undefined}
        onOpenSettings={() => undefined}
      />,
    );
    expect(markup).toContain('tinker-titlebar__crumb');
    expect(markup).toContain('>baz<');
  });

  it('shows only the brand when sessionFolderPath is null', () => {
    const markup = renderToStaticMarkup(
      <Titlebar
        sessionFolderPath={null}
        onNewSession={() => undefined}
        onOpenMemory={() => undefined}
        onOpenSettings={() => undefined}
      />,
    );
    expect(markup).not.toContain('tinker-titlebar__crumb');
    expect(markup).not.toContain('tinker-titlebar__sep');
  });

  it('trims trailing separators before picking the basename', () => {
    const withTrailing = renderToStaticMarkup(
      <Titlebar
        sessionFolderPath="/Users/foo/bar/baz/"
        onNewSession={() => undefined}
        onOpenMemory={() => undefined}
        onOpenSettings={() => undefined}
      />,
    );
    expect(withTrailing).toContain('>baz<');
  });

  it('marks the root with data-tauri-drag-region', () => {
    const markup = renderToStaticMarkup(
      <Titlebar
        sessionFolderPath={null}
        onNewSession={() => undefined}
        onOpenMemory={() => undefined}
        onOpenSettings={() => undefined}
      />,
    );
    expect(markup).toMatch(/<header[^>]*class="tinker-titlebar"[^>]*data-tauri-drag-region/);
  });

  it('marks the actions cluster with data-tauri-drag-region="false"', () => {
    const markup = renderToStaticMarkup(
      <Titlebar
        sessionFolderPath={null}
        onNewSession={() => undefined}
        onOpenMemory={() => undefined}
        onOpenSettings={() => undefined}
      />,
    );
    expect(markup).toMatch(
      /<div[^>]*class="tinker-titlebar__actions"[^>]*data-tauri-drag-region="false"/,
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
      onNewSession?: () => void;
      onOpenMemory?: () => void;
      onOpenSettings?: () => void;
    }): void => {
      act(() => {
        root.render(
          <Titlebar
            sessionFolderPath={null}
            onNewSession={handlers.onNewSession ?? (() => undefined)}
            onOpenMemory={handlers.onOpenMemory ?? (() => undefined)}
            onOpenSettings={handlers.onOpenSettings ?? (() => undefined)}
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

    it('invokes onNewSession when the new-chat button is clicked', () => {
      const spy = vi.fn();
      renderTitlebar({ onNewSession: spy });
      clickByLabel('New chat');
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('invokes onOpenMemory when the memory button is clicked', () => {
      const spy = vi.fn();
      renderTitlebar({ onOpenMemory: spy });
      clickByLabel('Memory');
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('invokes onOpenSettings when the settings button is clicked', () => {
      const spy = vi.fn();
      renderTitlebar({ onOpenSettings: spy });
      clickByLabel('Settings');
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
});
