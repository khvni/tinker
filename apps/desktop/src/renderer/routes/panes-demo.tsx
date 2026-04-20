import { useCallback, useMemo, useRef, useState, type JSX } from 'react';
import {
  createWorkspaceStore,
  type PaneRegistry,
  type WorkspaceStore,
  Workspace,
} from '@tinker/panes';
import '@tinker/panes/styles.css';
import '@tinker/design/styles/tokens.css';
import { Badge, Button, TextInput } from '@tinker/design';
import './panes-demo.css';

type DemoData =
  | { readonly kind: 'chat'; readonly messages: ReadonlyArray<{ readonly id: string; readonly body: string }> }
  | { readonly kind: 'notes'; readonly body: string }
  | { readonly kind: 'timer'; readonly startedAt: number };

const chatRenderer = ({ pane }: { pane: { data: DemoData } }): JSX.Element => {
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

const notesRenderer = ({ pane }: { pane: { data: DemoData } }): JSX.Element => {
  if (pane.data.kind !== 'notes') return <div />;
  return <pre className="panes-demo-notes">{pane.data.body}</pre>;
};

const timerRenderer = ({ pane }: { pane: { data: DemoData } }): JSX.Element => {
  if (pane.data.kind !== 'timer') return <div />;
  const [now, setNow] = useState(() => Date.now());
  useMemo(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const elapsed = Math.max(0, Math.round((now - pane.data.startedAt) / 1000));
  return <div className="panes-demo-timer">Elapsed: {elapsed}s</div>;
};

const registry: PaneRegistry<DemoData> = {
  chat: {
    kind: 'chat',
    defaultTitle: 'Chat',
    render: chatRenderer,
  },
  notes: {
    kind: 'notes',
    defaultTitle: 'Notes',
    render: notesRenderer,
  },
  timer: {
    kind: 'timer',
    defaultTitle: 'Timer',
    render: timerRenderer,
  },
};

const seedStore = (): WorkspaceStore<DemoData> => {
  const store = createWorkspaceStore<DemoData>();
  store.getState().actions.openTab({
    id: 'workspace-1',
    title: 'Workspace',
    pane: {
      id: 'p-chat',
      kind: 'chat',
      data: {
        kind: 'chat',
        messages: [
          { id: 'm1', body: 'Welcome to the @tinker/panes demo.' },
          { id: 'm2', body: 'Drag pane headers to re-dock on any edge.' },
        ],
      },
    },
  });
  store.getState().actions.splitPane(
    'workspace-1',
    'p-chat',
    'right',
    {
      id: 'p-notes',
      kind: 'notes',
      data: { kind: 'notes', body: '# Notes\n\nThese are scratch notes for the demo.' },
    },
  );
  return store;
};

export const PanesDemo = (): JSX.Element => {
  const storeRef = useRef<WorkspaceStore<DemoData> | null>(null);
  if (!storeRef.current) {
    storeRef.current = seedStore();
  }
  const store = storeRef.current;

  const [tabCounter, setTabCounter] = useState(2);
  const [paneCounter, setPaneCounter] = useState(3);
  const [paneTitle, setPaneTitle] = useState('');

  const addTab = useCallback(() => {
    const id = `workspace-${tabCounter}`;
    const paneId = `p-${paneCounter}`;
    setTabCounter((value) => value + 1);
    setPaneCounter((value) => value + 1);
    store.getState().actions.openTab({
      id,
      pane: {
        id: paneId,
        kind: 'chat',
        data: {
          kind: 'chat',
          messages: [{ id: 'seed', body: `Fresh workspace ${id} opened.` }],
        },
      },
    });
  }, [paneCounter, store, tabCounter]);

  const addNotesToActive = useCallback(() => {
    const state = store.getState();
    const activeTab = state.tabs.find((tab) => tab.id === state.activeTabId);
    if (!activeTab || !activeTab.activePaneId) return;
    const paneId = `p-${paneCounter}`;
    setPaneCounter((value) => value + 1);
    const trimmedTitle = paneTitle.trim();
    store.getState().actions.splitPane(activeTab.id, activeTab.activePaneId, 'bottom', {
      id: paneId,
      kind: 'notes',
      ...(trimmedTitle ? { title: trimmedTitle } : {}),
      data: { kind: 'notes', body: `Pane ${paneId} created at ${new Date().toLocaleTimeString()}.` },
    });
    setPaneTitle('');
  }, [paneCounter, paneTitle, store]);

  const addTimerToActive = useCallback(() => {
    const state = store.getState();
    const activeTab = state.tabs.find((tab) => tab.id === state.activeTabId);
    if (!activeTab || !activeTab.activePaneId) return;
    const paneId = `p-${paneCounter}`;
    setPaneCounter((value) => value + 1);
    store.getState().actions.splitPane(activeTab.id, activeTab.activePaneId, 'right', {
      id: paneId,
      kind: 'timer',
      data: { kind: 'timer', startedAt: Date.now() },
    });
  }, [paneCounter, store]);

  return (
    <main className="panes-demo-shell">
      <header className="panes-demo-header">
        <div>
          <p className="panes-demo-eyebrow">@tinker/panes demo</p>
          <h1>Workspace layout preview</h1>
        </div>
        <div className="panes-demo-actions">
          <TextInput
            value={paneTitle}
            onChange={(event) => setPaneTitle(event.target.value)}
            placeholder="Title (optional)"
            aria-label="New pane title"
          />
          <Button variant="secondary" size="s" onClick={addNotesToActive}>
            + Notes pane (split bottom)
          </Button>
          <Button variant="secondary" size="s" onClick={addTimerToActive}>
            + Timer pane (split right)
          </Button>
          <Button variant="primary" size="s" onClick={addTab}>
            + New tab
          </Button>
          <Badge variant="accent" size="small">
            data-testid=&quot;panes-demo-root&quot;
          </Badge>
        </div>
      </header>

      <section className="panes-demo-workspace" data-testid="panes-demo-root">
        <Workspace
          store={store}
          registry={registry}
          ariaLabel="Tinker panes demo"
          tabStripActions={[
            { id: 'new-tab', label: 'New tab', onSelect: addTab, icon: '+' },
          ]}
          emptyState={<p>Click &quot;New tab&quot; to begin.</p>}
        />
      </section>
    </main>
  );
};
