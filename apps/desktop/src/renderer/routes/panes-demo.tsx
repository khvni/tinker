import { useCallback, useMemo, useRef, useState, type JSX } from 'react';
import {
  countUnreadPanes,
  createAttentionStore,
  useAttentionSnapshot,
} from '@tinker/attention';
import {
  createWorkspaceStore,
  type PaneRegistry,
  type WorkspaceStore,
  Workspace,
  isSplit,
  isStack,
  collectStacks,
} from '@tinker/panes';
import '@tinker/panes/styles.css';
import '@tinker/design/styles/tokens.css';
import { Badge, Button, TextInput } from '@tinker/design';
import './panes-demo.css';

const PANES_DEMO_WORKSPACE_ID = 'panes-demo';

// ────────────────────────────────────────────────────────────────────────────
// Demo data shapes
// ────────────────────────────────────────────────────────────────────────────

type DemoData =
  | { readonly kind: 'chat'; readonly messages: ReadonlyArray<{ readonly id: string; readonly body: string }> }
  | { readonly kind: 'notes'; readonly body: string }
  | { readonly kind: 'timer'; readonly startedAt: number }
  | { readonly kind: 'terminal'; readonly transcript: ReadonlyArray<string> };

const ChatRenderer = ({ pane }: { pane: { data: DemoData } }): JSX.Element => {
  if (pane.data.kind !== 'chat') return <div />;
  return (
    <div className="panes-demo-chat">
      <ul>
        {pane.data.messages.map((message) => (
          <li key={message.id}>{message.body}</li>
        ))}
      </ul>
    </div>
  );
};

const NotesRenderer = ({ pane }: { pane: { data: DemoData } }): JSX.Element => {
  if (pane.data.kind !== 'notes') return <div />;
  return <pre className="panes-demo-notes">{pane.data.body}</pre>;
};

const TimerRenderer = ({ pane }: { pane: { data: DemoData } }): JSX.Element => {
  if (pane.data.kind !== 'timer') return <div />;
  const [now, setNow] = useState(() => Date.now());
  useMemo(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const elapsed = Math.max(0, Math.round((now - pane.data.startedAt) / 1000));
  return <div className="panes-demo-timer">Elapsed: {elapsed}s</div>;
};

const TerminalRenderer = ({ pane }: { pane: { data: DemoData } }): JSX.Element => {
  if (pane.data.kind !== 'terminal') return <div />;
  return (
    <pre className="panes-demo-terminal">
      {pane.data.transcript.map((line, index) => (
        <div key={index}>{line}</div>
      ))}
    </pre>
  );
};

const registry: PaneRegistry<DemoData> = {
  chat: { kind: 'chat', defaultTitle: 'Chat', render: ChatRenderer },
  notes: { kind: 'notes', defaultTitle: 'Notes', render: NotesRenderer },
  timer: { kind: 'timer', defaultTitle: 'Timer', render: TimerRenderer },
  terminal: { kind: 'terminal', defaultTitle: 'Terminal', render: TerminalRenderer },
};

// ────────────────────────────────────────────────────────────────────────────
// Seed store
// ────────────────────────────────────────────────────────────────────────────

const seedStore = (): WorkspaceStore<DemoData> => {
  const store = createWorkspaceStore<DemoData>();
  const actions = store.getState().actions;

  actions.openTab({
    id: 'workspace-1',
    title: 'Main',
    pane: {
      id: 'p-chat',
      kind: 'chat',
      data: {
        kind: 'chat',
        messages: [
          { id: 'm1', body: 'Welcome to @tinker/panes — VSCode-style split + tab groups.' },
          { id: 'm2', body: 'Drag a tab onto another pane edge to split.' },
          { id: 'm3', body: 'Drag onto the body center to merge it in as a new tab.' },
        ],
      },
    },
  });

  // Split right — new stack with Notes
  actions.splitPane('workspace-1', 'p-chat', 'right', {
    id: 'p-notes',
    kind: 'notes',
    data: { kind: 'notes', body: '# Notes\n\nScratch pad.' },
  });

  // Add a second pane *into* the right stack (tab group with 2 panes)
  const tab = store.getState().tabs[0]!;
  const stacks = collectStacks(tab.layout);
  const rightStack = stacks[1];
  if (rightStack) {
    actions.addPane('workspace-1', {
      id: 'p-timer',
      kind: 'timer',
      data: { kind: 'timer', startedAt: Date.now() },
    }, { stackId: rightStack.id });
  }

  // Split the left stack bottom — Terminal
  actions.splitPane('workspace-1', 'p-chat', 'bottom', {
    id: 'p-term',
    kind: 'terminal',
    data: { kind: 'terminal', transcript: ['$ echo hello', 'hello', '$ ls'] },
  });

  actions.openTab({
    id: 'workspace-2',
    title: 'Scratch',
    pane: { id: 'p-scratch', kind: 'notes', data: { kind: 'notes', body: 'Second workspace tab.' } },
    activate: false,
  });

  return store;
};

// ────────────────────────────────────────────────────────────────────────────
// Demo page
// ────────────────────────────────────────────────────────────────────────────

export const PanesDemo = (): JSX.Element => {
  const storeRef = useRef<WorkspaceStore<DemoData> | null>(null);
  const attentionStoreRef = useRef(createAttentionStore());
  if (!storeRef.current) storeRef.current = seedStore();
  const store = storeRef.current;
  const attentionStore = attentionStoreRef.current;
  const attentionSnapshot = useAttentionSnapshot(attentionStore);

  const [paneCounter, setPaneCounter] = useState(100);
  const [tabCounter, setTabCounter] = useState(3);
  const [paneTitle, setPaneTitle] = useState('');

  const addTab = useCallback(() => {
    const id = `workspace-${tabCounter}`;
    const paneId = `p-${paneCounter}`;
    setTabCounter((v) => v + 1);
    setPaneCounter((v) => v + 1);
    store.getState().actions.openTab({
      id,
      pane: {
        id: paneId,
        kind: 'chat',
        data: { kind: 'chat', messages: [{ id: 'seed', body: `Fresh workspace ${id}.` }] },
      },
    });
  }, [paneCounter, store, tabCounter]);

  const addPaneToActiveStack = useCallback(() => {
    const state = store.getState();
    const activeTab = state.tabs.find((tab) => tab.id === state.activeTabId);
    if (!activeTab) return;
    const paneId = `p-${paneCounter}`;
    setPaneCounter((v) => v + 1);
    const trimmed = paneTitle.trim();
    store.getState().actions.addPane(activeTab.id, {
      id: paneId,
      kind: 'notes',
      ...(trimmed ? { title: trimmed } : {}),
      data: { kind: 'notes', body: `Pane ${paneId} @ ${new Date().toLocaleTimeString()}` },
    });
    setPaneTitle('');
  }, [paneCounter, paneTitle, store]);

  const splitActiveRight = useCallback(() => {
    const state = store.getState();
    const activeTab = state.tabs.find((tab) => tab.id === state.activeTabId);
    if (!activeTab || !activeTab.activePaneId) return;
    const paneId = `p-${paneCounter}`;
    setPaneCounter((v) => v + 1);
    store.getState().actions.splitPane(activeTab.id, activeTab.activePaneId, 'right', {
      id: paneId,
      kind: 'timer',
      data: { kind: 'timer', startedAt: Date.now() },
    });
  }, [paneCounter, store]);

  const splitActiveBottom = useCallback(() => {
    const state = store.getState();
    const activeTab = state.tabs.find((tab) => tab.id === state.activeTabId);
    if (!activeTab || !activeTab.activePaneId) return;
    const paneId = `p-${paneCounter}`;
    setPaneCounter((v) => v + 1);
    store.getState().actions.splitPane(activeTab.id, activeTab.activePaneId, 'bottom', {
      id: paneId,
      kind: 'terminal',
      data: { kind: 'terminal', transcript: [`$ tail ${paneId}.log`, 'ok'] },
    });
  }, [paneCounter, store]);

  const signalPane = useCallback(
    (paneId: string, reason: 'notification-arrival' | 'navigation') => {
      attentionStore.getState().actions.signal({
        workspaceId: PANES_DEMO_WORKSPACE_ID,
        paneId,
        reason,
      });
    },
    [attentionStore],
  );

  const stats = useMemo(() => {
    const state = store.getState();
    const tab = state.tabs.find((t) => t.id === state.activeTabId);
    if (!tab) return { stacks: 0, panes: 0, splits: 0 };
    let splits = 0;
    const count = (node: typeof tab.layout): void => {
      if (isStack(node)) return;
      if (isSplit(node)) {
        splits += 1;
        count(node.a);
        count(node.b);
      }
    };
    count(tab.layout);
    return { stacks: collectStacks(tab.layout).length, panes: Object.keys(tab.panes).length, splits };
  }, [store]);
  const unreadCount = countUnreadPanes(attentionSnapshot);
  const activeFlash = attentionSnapshot.activeFlash?.accent ?? 'none';

  return (
    <main className="panes-demo-shell">
      <header className="panes-demo-header">
        <div>
          <p className="panes-demo-eyebrow">@tinker/panes v2</p>
          <h1>Workspace with stacks + splits</h1>
        </div>
        <div className="panes-demo-actions">
          <TextInput
            value={paneTitle}
            onChange={(event) => setPaneTitle(event.target.value)}
            placeholder="Title (optional)"
            aria-label="New pane title"
          />
          <Button variant="secondary" size="s" onClick={addPaneToActiveStack}>
            + Pane in active stack
          </Button>
          <Button variant="secondary" size="s" onClick={splitActiveRight}>
            + Split right
          </Button>
          <Button variant="secondary" size="s" onClick={splitActiveBottom}>
            + Split bottom
          </Button>
          <Button variant="secondary" size="s" onClick={() => signalPane('p-notes', 'notification-arrival')}>
            Signal notes
          </Button>
          <Button variant="secondary" size="s" onClick={() => signalPane('p-term', 'navigation')}>
            Flash terminal
          </Button>
          <Button variant="primary" size="s" onClick={addTab}>
            + New workspace tab
          </Button>
          <Badge variant="accent" size="small">
            stacks {stats.stacks} · panes {stats.panes} · splits {stats.splits}
          </Badge>
          <Badge variant="default" size="small">
            unread {unreadCount} · flash {activeFlash}
          </Badge>
        </div>
      </header>

      <section className="panes-demo-workspace" data-testid="panes-demo-root">
        <Workspace
          store={store}
          registry={registry}
          attention={{
            store: attentionStore,
            workspaceId: PANES_DEMO_WORKSPACE_ID,
          }}
          ariaLabel="Tinker panes demo"
          tabStripActions={[{ id: 'new-tab', label: 'New tab', onSelect: addTab, icon: '+' }]}
          emptyState={<p>Click &quot;New workspace tab&quot; to begin.</p>}
        />
      </section>

      <footer className="panes-demo-footer">
        <p>
          Drag pane tabs between stacks · drop on a stack edge to split · drop on a stack body
          center to merge · use arrow keys in the pane-tab bar to cycle
        </p>
      </footer>
    </main>
  );
};
