// @vitest-environment jsdom

// @ts-expect-error React uses this flag in tests.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { WorkspaceSidebar } from './WorkspaceSidebar.js';

const noop = (): void => {};

describe('WorkspaceSidebar', () => {
  it('renders the rail with user initial and core nav labels', () => {
    const markup = renderToStaticMarkup(
      <WorkspaceSidebar
        userInitial="K"
        onOpenChat={noop}
        onOpenMemory={noop}
        onOpenSettings={noop}
        onOpenAccount={noop}
      />,
    );

    expect(markup).toContain('aria-label="Workspace navigation"');
    expect(markup).toContain('aria-label="Workspaces"');
    expect(markup).toContain('aria-label="Chats"');
    expect(markup).toContain('aria-label="Memory"');
    expect(markup).toContain('aria-label="Settings"');
    expect(markup).toContain('aria-label="Account"');
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain('>K<');
  });

  it('disables deferred nav items', () => {
    const markup = renderToStaticMarkup(
      <WorkspaceSidebar
        userInitial="T"
        onOpenChat={noop}
        onOpenMemory={noop}
        onOpenSettings={noop}
        onOpenAccount={noop}
      />,
    );

    const deferred = ['Explorer', 'Skills', 'Agents', 'Connections', 'Playbook', 'Analytics'];
    for (const label of deferred) {
      const pattern = new RegExp(`<button[^>]*aria-label="${label}"[^>]*disabled`);
      expect(markup).toMatch(pattern);
    }
  });

  it('shows the playbook badge when showPlaybookBadge is true', () => {
    const withBadge = renderToStaticMarkup(
      <WorkspaceSidebar
        userInitial="K"
        showPlaybookBadge
        onOpenChat={noop}
        onOpenMemory={noop}
        onOpenSettings={noop}
        onOpenAccount={noop}
      />,
    );
    const withoutBadge = renderToStaticMarkup(
      <WorkspaceSidebar
        userInitial="K"
        onOpenChat={noop}
        onOpenMemory={noop}
        onOpenSettings={noop}
        onOpenAccount={noop}
      />,
    );

    expect(withBadge).toContain('tinker-workspace-sidebar__item-dot');
    expect(withoutBadge).not.toContain('tinker-workspace-sidebar__item-dot');
  });

  it('fires callbacks when rail items are clicked', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onOpenChat = vi.fn();
    const onOpenMemory = vi.fn();
    const onOpenSettings = vi.fn();
    const onOpenAccount = vi.fn();

    await act(async () => {
      root.render(
        <WorkspaceSidebar
          userInitial="K"
          onOpenChat={onOpenChat}
          onOpenMemory={onOpenMemory}
          onOpenSettings={onOpenSettings}
          onOpenAccount={onOpenAccount}
        />,
      );
    });

    const click = (label: string): void => {
      const button = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
      if (!button) {
        throw new Error(`button ${label} not found`);
      }
      button.click();
    };

    click('Chats');
    click('Memory');
    click('Settings');
    click('Account');
    click('New tab');

    expect(onOpenChat).toHaveBeenCalledTimes(2);
    expect(onOpenMemory).toHaveBeenCalledTimes(1);
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
    expect(onOpenAccount).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
