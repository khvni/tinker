// @vitest-environment jsdom

// @ts-expect-error React uses this flag in tests.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { TinkerPaneKind } from '@tinker/shared-types';
import { WorkspaceSidebar } from './WorkspaceSidebar.js';

const noop = (): void => {};

describe('WorkspaceSidebar', () => {
  it('renders the rail with user initial and core nav labels', () => {
    const markup = renderToStaticMarkup(
      <WorkspaceSidebar
        userInitial="K"
        avatarUrl={null}
        accountLabel="Account · Guest"
        activeRailItem="chat"
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
    expect(markup).toContain('>K<');

    const chatButtonPattern = /<button[^>]*aria-label="Chats"[^>]*aria-current="page"/;
    expect(markup).toMatch(chatButtonPattern);
    const workspacesButtonPattern = /<button[^>]*aria-label="Workspaces"[^>]*aria-current="page"/;
    expect(markup).not.toMatch(workspacesButtonPattern);
  });

  it('disables deferred nav items', () => {
    const markup = renderToStaticMarkup(
      <WorkspaceSidebar
        userInitial="T"
        avatarUrl={null}
        accountLabel="Account · Guest"
        activeRailItem={null}
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
        avatarUrl={null}
        accountLabel="Account · Guest"
        activeRailItem={null}
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
        avatarUrl={null}
        accountLabel="Account · Guest"
        activeRailItem={null}
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
          avatarUrl={null}
          accountLabel="Account · Guest"
          activeRailItem={null}
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

  it('aria-current follows activeRailItem across chat/memory/settings', () => {
    const cases: ReadonlyArray<{ readonly kind: TinkerPaneKind; readonly activeLabel: string }> = [
      { kind: 'chat', activeLabel: 'Chats' },
      { kind: 'memory', activeLabel: 'Memory' },
      { kind: 'settings', activeLabel: 'Settings' },
    ];

    for (const { kind, activeLabel } of cases) {
      const markup = renderToStaticMarkup(
        <WorkspaceSidebar
          userInitial="K"
          avatarUrl={null}
          accountLabel="Account · Guest"
          activeRailItem={kind}
          onOpenChat={noop}
          onOpenMemory={noop}
          onOpenSettings={noop}
          onOpenAccount={noop}
        />,
      );

      const activePattern = new RegExp(`<button[^>]*aria-label="${activeLabel}"[^>]*aria-current="page"`);
      expect(markup).toMatch(activePattern);

      for (const otherLabel of ['Chats', 'Memory', 'Settings'].filter((label) => label !== activeLabel)) {
        const otherPattern = new RegExp(`<button[^>]*aria-label="${otherLabel}"[^>]*aria-current="page"`);
        expect(markup).not.toMatch(otherPattern);
      }
    }

    const nullMarkup = renderToStaticMarkup(
      <WorkspaceSidebar
        userInitial="K"
        avatarUrl={null}
        accountLabel="Account · Guest"
        activeRailItem={null}
        onOpenChat={noop}
        onOpenMemory={noop}
        onOpenSettings={noop}
        onOpenAccount={noop}
      />,
    );
    expect(nullMarkup).not.toContain('aria-current="page"');
  });

  it('renders avatar image when avatarUrl provided', () => {
    const markup = renderToStaticMarkup(
      <WorkspaceSidebar
        userInitial="K"
        avatarUrl="https://example.com/a.png"
        accountLabel="Account · alice@example.com"
        activeRailItem={null}
        onOpenChat={noop}
        onOpenMemory={noop}
        onOpenSettings={noop}
        onOpenAccount={noop}
      />,
    );

    expect(markup).toMatch(/<img[^>]*src="https:\/\/example\.com\/a\.png"/);
    expect(markup).toMatch(/<img[^>]*alt=""/);
    expect(markup).toMatch(/<img[^>]*loading="lazy"/);
    expect(markup).toMatch(/<img[^>]*class="tinker-workspace-sidebar__avatar-image"/);
  });

  it('falls back to initial when avatarUrl is null', () => {
    const markup = renderToStaticMarkup(
      <WorkspaceSidebar
        userInitial="G"
        avatarUrl={null}
        accountLabel="Account · Guest"
        activeRailItem={null}
        onOpenChat={noop}
        onOpenMemory={noop}
        onOpenSettings={noop}
        onOpenAccount={noop}
      />,
    );

    expect(markup).not.toContain('tinker-workspace-sidebar__avatar-image');
    expect(markup).toContain('>G<');
  });

  it('falls back to initial when avatar image fails to load', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <WorkspaceSidebar
          userInitial="G"
          avatarUrl="https://example.com/broken.png"
          accountLabel="Account · alice@example.com"
          activeRailItem={null}
          onOpenChat={noop}
          onOpenMemory={noop}
          onOpenSettings={noop}
          onOpenAccount={noop}
        />,
      );
    });

    const img = container.querySelector<HTMLImageElement>('img.tinker-workspace-sidebar__avatar-image');
    if (!img) {
      throw new Error('avatar image not found');
    }

    await act(async () => {
      img.dispatchEvent(new Event('error'));
    });

    const imgAfter = container.querySelector('img.tinker-workspace-sidebar__avatar-image');
    expect(imgAfter).toBeNull();
    const initial = container.querySelector('.tinker-workspace-sidebar__avatar');
    expect(initial?.textContent).toBe('G');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('account tooltip uses accountLabel', () => {
    const markup = renderToStaticMarkup(
      <WorkspaceSidebar
        userInitial="G"
        avatarUrl={null}
        accountLabel="Account · Guest"
        activeRailItem={null}
        onOpenChat={noop}
        onOpenMemory={noop}
        onOpenSettings={noop}
        onOpenAccount={noop}
      />,
    );

    const accountTooltipPattern = /<button[^>]*aria-label="Account"[^>]*title="Account · Guest"/;
    expect(markup).toMatch(accountTooltipPattern);
  });

  it('rail items carry their label as title tooltip', () => {
    const markup = renderToStaticMarkup(
      <WorkspaceSidebar
        userInitial="K"
        avatarUrl={null}
        accountLabel="Account · Guest"
        activeRailItem={null}
        onOpenChat={noop}
        onOpenMemory={noop}
        onOpenSettings={noop}
        onOpenAccount={noop}
      />,
    );

    const labels = [
      'Workspaces',
      'Explorer',
      'Chats',
      'Skills',
      'Agents',
      'Connections',
      'Memory',
      'New tab',
      'Playbook',
      'Analytics',
      'Settings',
    ];
    for (const label of labels) {
      const pattern = new RegExp(`<button[^>]*aria-label="${label}"[^>]*title="${label}"`);
      expect(markup).toMatch(pattern);
    }
  });
});
