import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { act } from 'react';
import { createAttentionStore } from '@tinker/attention';
import { createWorkspaceStore } from '../../core/store/store.js';
import { isStack } from '../../core/utils/layout.js';
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
    // There are two tabs with the label "Chat": the workspace tab (top) and
    // the pane-level tab inside the stack. We care about the workspace tab
    // here, which carries the `tinker-panes-tab` class.
    const workspaceTab = screen
      .getAllByRole('tab', { name: /Chat/i })
      .find((el) => el.classList.contains('tinker-panes-tab'));
    expect(workspaceTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('pane-p1')).toHaveTextContent('hello');
  });

  it('closes a workspace tab when × clicked', () => {
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

  it('renders the empty state when no tabs', () => {
    const store = createWorkspaceStore<Data>();
    render(<Workspace store={store} registry={registry} emptyState={<p>empty</p>} />);
    expect(screen.getByText('empty')).toBeInTheDocument();
  });

  it('renders a stack with multiple pane tabs', () => {
    const store = createWorkspaceStore<Data>();
    act(() => {
      store.getState().actions.openTab({
        id: 't1',
        pane: { id: 'p1', kind: 'chat', data: { label: 'a' } },
      });
      store.getState().actions.addPane('t1', {
        id: 'p2',
        kind: 'today',
        data: { label: 'b' },
      });
    });
    render(<Workspace store={store} registry={registry} />);
    const stackTabs = screen.getAllByRole('tab').filter((el) => el.getAttribute('data-pane-id'));
    expect(stackTabs.map((el) => el.getAttribute('data-pane-id'))).toEqual(['p1', 'p2']);
  });

  it('renders a split layout with two stacks and a resize separator', () => {
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

  it('clicking a pane tab activates that pane', () => {
    const store = createWorkspaceStore<Data>();
    act(() => {
      store.getState().actions.openTab({
        id: 't1',
        pane: { id: 'p1', kind: 'chat', data: { label: 'a' } },
      });
      store.getState().actions.addPane('t1', {
        id: 'p2',
        kind: 'today',
        data: { label: 'b' },
      });
    });
    render(<Workspace store={store} registry={registry} />);
    // After addPane p2 is active; click p1's tab to re-activate it.
    const p1Tab = screen.getAllByRole('tab').find((el) => el.getAttribute('data-pane-id') === 'p1')!;
    fireEvent.click(p1Tab);
    expect(store.getState().tabs[0]!.activePaneId).toBe('p1');
  });

  it('renders an attention ring on an unread pane frame in an inactive split stack', () => {
    const store = createWorkspaceStore<Data>();
    const attentionStore = createAttentionStore();

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
      store.getState().actions.focusPane('t1', 'p1');
      attentionStore.getState().actions.signal({
        workspaceId: 'workspace-under-test',
        paneId: 'p2',
        reason: 'notification-arrival',
      });
    });

    const { container } = render(
      <Workspace
        store={store}
        registry={registry}
        attention={{ store: attentionStore, workspaceId: 'workspace-under-test' }}
      />,
    );

    expect(
      container.querySelector(
        '[data-active-pane-id="p2"][data-attention-accent="notification-blue"]',
      ),
    ).toBeTruthy();
  });

  it('clears a pane tab attention dot when that pane receives focus', () => {
    const store = createWorkspaceStore<Data>();
    const attentionStore = createAttentionStore();

    act(() => {
      store.getState().actions.openTab({
        id: 't1',
        pane: { id: 'p1', kind: 'chat', data: { label: 'a' } },
      });
      store.getState().actions.addPane('t1', {
        id: 'p2',
        kind: 'today',
        data: { label: 'b' },
      });
      store.getState().actions.focusPane('t1', 'p1');
      attentionStore.getState().actions.signal({
        workspaceId: 'workspace-under-test',
        paneId: 'p2',
        reason: 'notification-arrival',
      });
    });

    const { container } = render(
      <Workspace
        store={store}
        registry={registry}
        attention={{ store: attentionStore, workspaceId: 'workspace-under-test' }}
      />,
    );

    const p2Tab = screen.getAllByRole('tab').find((el) => el.getAttribute('data-pane-id') === 'p2')!;
    expect(
      p2Tab.querySelector('[data-attention-accent="notification-blue"]'),
    ).toBeTruthy();

    fireEvent.click(p2Tab);

    expect(store.getState().tabs[0]!.activePaneId).toBe('p2');
    expect(
      container.querySelector('[data-pane-id="p2"] [data-attention-accent="notification-blue"]'),
    ).toBeFalsy();
  });
});

describe('resolveTabTitle', () => {
  it('uses override when set', () => {
    const store = createWorkspaceStore<Data>();
    store.getState().actions.openTab({
      id: 't',
      title: 'Custom',
      pane: { id: 'p', kind: 'chat', data: { label: 'x' } },
    });
    const tab = store.getState().tabs[0]!;
    expect(resolveTabTitle(tab, registry)).toBe('Custom');
  });

  it('falls back to default title from the stack active pane', () => {
    const store = createWorkspaceStore<Data>();
    store.getState().actions.openTab({
      id: 't',
      pane: { id: 'p', kind: 'today', data: { label: 'x' } },
    });
    const tab = store.getState().tabs[0]!;
    expect(resolveTabTitle(tab, registry)).toBe('Today');
    // sanity: layout is a stack
    expect(isStack(tab.layout)).toBe(true);
  });
});
