import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { act } from 'react';
import { createWorkspaceStore } from '../../core/store/store.js';
import type { PaneRegistry } from '../types.js';
import { Workspace } from './Workspace.js';
import { resolveTabTitle } from './TabStrip.js';

type Data = { readonly label: string };

const registry: PaneRegistry<Data> = {
  chat: {
    kind: 'chat',
    defaultTitle: 'Chat',
    render: ({ pane }) => <div data-testid={`pane-${pane.id}`}>{pane.data.label}</div>,
  },
  today: {
    kind: 'today',
    defaultTitle: 'Today',
    render: ({ pane }) => <div data-testid={`pane-${pane.id}`}>{pane.data.label}</div>,
  },
};

afterEach(() => cleanup());

describe('<Workspace>', () => {
  it('renders active tab + active pane', () => {
    const store = createWorkspaceStore<Data>();
    act(() => {
      store.getState().actions.openTab({
        id: 't1',
        pane: { id: 'p1', kind: 'chat', data: { label: 'hello' } },
      });
    });
    render(<Workspace store={store} registry={registry} />);
    expect(screen.getByRole('tab', { name: /Chat/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('pane-p1')).toHaveTextContent('hello');
  });

  it('activates a tab on click', () => {
    const store = createWorkspaceStore<Data>();
    act(() => {
      store.getState().actions.openTab({
        id: 't1',
        pane: { id: 'p1', kind: 'chat', data: { label: 'a' } },
      });
      store.getState().actions.openTab({
        id: 't2',
        pane: { id: 'p2', kind: 'today', data: { label: 'b' } },
      });
    });
    render(<Workspace store={store} registry={registry} />);
    const firstTab = screen.getByRole('tab', { name: /Chat/i });
    fireEvent.click(firstTab);
    expect(store.getState().activeTabId).toBe('t1');
  });

  it('closes a tab when × clicked', () => {
    const store = createWorkspaceStore<Data>();
    act(() => {
      store.getState().actions.openTab({
        id: 't1',
        pane: { id: 'p1', kind: 'chat', data: { label: 'a' } },
      });
    });
    render(<Workspace store={store} registry={registry} />);
    const closeButton = screen.getByRole('button', { name: /Close tab Chat/i });
    fireEvent.click(closeButton);
    expect(store.getState().tabs).toHaveLength(0);
  });

  it('renders empty state when no tabs', () => {
    const store = createWorkspaceStore<Data>();
    render(<Workspace store={store} registry={registry} emptyState={<p>empty</p>} />);
    expect(screen.getByText('empty')).toBeInTheDocument();
  });

  it('renders a split layout with two panes and shows the resize separator', () => {
    const store = createWorkspaceStore<Data>();
    act(() => {
      store.getState().actions.openTab({
        id: 't1',
        pane: { id: 'p1', kind: 'chat', data: { label: 'a' } },
      });
      store.getState().actions.splitPane('t1', 'p1', 'right', {
        id: 'p2',
        kind: 'today',
        data: { label: 'b' },
      });
    });
    render(<Workspace store={store} registry={registry} />);
    expect(screen.getByTestId('pane-p1')).toBeInTheDocument();
    expect(screen.getByTestId('pane-p2')).toBeInTheDocument();
    expect(screen.getByRole('separator', { name: /Resize columns/i })).toBeInTheDocument();
  });

  it('tabStripActions renders action buttons', () => {
    const store = createWorkspaceStore<Data>();
    let clicked = 0;
    act(() => {
      store.getState().actions.openTab({
        id: 't1',
        pane: { id: 'p1', kind: 'chat', data: { label: 'a' } },
      });
    });
    render(
      <Workspace
        store={store}
        registry={registry}
        tabStripActions={[{ id: 'new', label: 'New tab', onSelect: () => (clicked += 1) }]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'New tab' }));
    expect(clicked).toBe(1);
  });
});

describe('resolveTabTitle', () => {
  it('uses override when set', () => {
    const tab = {
      id: 't',
      title: 'Custom',
      createdAt: 0,
      activePaneId: 'p',
      layout: { kind: 'leaf' as const, paneId: 'p' },
      panes: { p: { id: 'p', kind: 'chat', data: { label: 'x' } } },
    };
    expect(resolveTabTitle(tab, registry)).toBe('Custom');
  });
  it('falls back to default title', () => {
    const tab = {
      id: 't',
      createdAt: 0,
      activePaneId: 'p',
      layout: { kind: 'leaf' as const, paneId: 'p' },
      panes: { p: { id: 'p', kind: 'today', data: { label: 'x' } } },
    };
    expect(resolveTabTitle(tab, registry)).toBe('Today');
  });
});
