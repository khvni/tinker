import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { WorkspaceSidebar } from './WorkspaceSidebar.js';
import type { WorkspaceCardModel } from '../types.js';

const workspace = (id: string, title: string, overrides: Partial<WorkspaceCardModel> = {}): WorkspaceCardModel => ({
  id,
  title,
  pinned: false,
  entries: [],
  attention: { unread: false, flash: null },
  ...overrides,
});

const baseWorkspaces: ReadonlyArray<WorkspaceCardModel> = [
  workspace('ws-a', 'vault-a', {
    entries: [
      { key: 'git.branch', value: 'feat/a', priority: 10, format: 'plain', timestamp: 1 },
      { key: 'git.pr', value: '#42', priority: 20, format: 'plain', timestamp: 2 },
      { key: 'ports.web', value: '3000', priority: 30, format: 'plain', timestamp: 3 },
      { key: 'last.active', value: '2m ago', priority: 40, format: 'plain', timestamp: 4 },
    ],
  }),
  workspace('ws-b', 'vault-b', { pinned: true, attention: { unread: true, flash: 'notification-blue' } }),
  workspace('ws-c', 'vault-c'),
];

const makeDataTransfer = () => {
  const store = new Map<string, string>();
  return {
    effectAllowed: 'none',
    dropEffect: 'none',
    setData: vi.fn((type: string, value: string) => {
      store.set(type, value);
    }),
    getData: vi.fn((type: string) => store.get(type) ?? ''),
    types: [] as string[],
  };
};

afterEach(() => cleanup());

describe('<WorkspaceSidebar>', () => {
  it('renders one card per workspace with the required metadata entries', () => {
    render(
      <WorkspaceSidebar
        workspaces={baseWorkspaces}
        activeWorkspaceId="ws-a"
        onActivate={() => undefined}
        onReorder={() => undefined}
        onAddWorkspace={() => undefined}
      />,
    );
    const cards = screen.getAllByRole('option');
    expect(cards).toHaveLength(3);
    expect(cards[0]).toHaveAttribute('data-card-id', 'ws-a');
    expect(cards[0]).toHaveAttribute('data-active', 'true');
    expect(screen.getByText('git.branch')).toBeInTheDocument();
    expect(screen.getByText('feat/a')).toBeInTheDocument();
    expect(screen.getByText('#42')).toBeInTheDocument();
    expect(screen.getByText('3000')).toBeInTheDocument();
    expect(screen.getByText('2m ago')).toBeInTheDocument();
  });

  it('marks pinned and unread state via accessibility labels', () => {
    render(
      <WorkspaceSidebar
        workspaces={baseWorkspaces}
        activeWorkspaceId={null}
        onActivate={() => undefined}
        onReorder={() => undefined}
        onAddWorkspace={() => undefined}
      />,
    );
    expect(screen.getByLabelText('pinned')).toBeInTheDocument();
    expect(screen.getByLabelText('unread')).toBeInTheDocument();
  });

  it('activates a workspace on click', () => {
    const onActivate = vi.fn();
    render(
      <WorkspaceSidebar
        workspaces={baseWorkspaces}
        activeWorkspaceId="ws-a"
        onActivate={onActivate}
        onReorder={() => undefined}
        onAddWorkspace={() => undefined}
      />,
    );
    fireEvent.click(screen.getAllByRole('option')[1]!);
    expect(onActivate).toHaveBeenCalledWith('ws-b');
  });

  it('calls onAddWorkspace when the add button is clicked', () => {
    const onAddWorkspace = vi.fn();
    render(
      <WorkspaceSidebar
        workspaces={baseWorkspaces}
        activeWorkspaceId={null}
        onActivate={() => undefined}
        onReorder={() => undefined}
        onAddWorkspace={onAddWorkspace}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Add workspace/i }));
    expect(onAddWorkspace).toHaveBeenCalledTimes(1);
  });

  it('renders the provided footer', () => {
    render(
      <WorkspaceSidebar
        workspaces={baseWorkspaces}
        activeWorkspaceId={null}
        onActivate={() => undefined}
        onReorder={() => undefined}
        onAddWorkspace={() => undefined}
        footer={<span data-testid="footer">chips</span>}
      />,
    );
    expect(screen.getByTestId('footer')).toBeInTheDocument();
  });

  it('dispatches onReorder with the dropped id and target index', () => {
    const onReorder = vi.fn();
    render(
      <WorkspaceSidebar
        workspaces={baseWorkspaces}
        activeWorkspaceId="ws-a"
        onActivate={() => undefined}
        onReorder={onReorder}
        onAddWorkspace={() => undefined}
      />,
    );
    const cards = screen.getAllByRole('option');
    const source = cards[0]!;
    const target = cards[2]!;
    const dataTransfer = makeDataTransfer();
    fireEvent.dragStart(source, { dataTransfer });
    fireEvent.dragEnter(target, { dataTransfer });
    fireEvent.dragOver(target, { dataTransfer });
    fireEvent.drop(target, { dataTransfer });
    expect(onReorder).toHaveBeenCalledTimes(1);
    expect(onReorder).toHaveBeenCalledWith('ws-a', 2);
  });

  it('ignores drop on the source card (same id)', () => {
    const onReorder = vi.fn();
    render(
      <WorkspaceSidebar
        workspaces={baseWorkspaces}
        activeWorkspaceId={null}
        onActivate={() => undefined}
        onReorder={onReorder}
        onAddWorkspace={() => undefined}
      />,
    );
    const source = screen.getAllByRole('option')[0]!;
    const dataTransfer = makeDataTransfer();
    fireEvent.dragStart(source, { dataTransfer });
    fireEvent.dragOver(source, { dataTransfer });
    fireEvent.drop(source, { dataTransfer });
    expect(onReorder).not.toHaveBeenCalled();
  });
});
