import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { Layout, Model, Actions, DockLocation, type TabNode, type IJsonModel } from 'flexlayout-react';
import '@tinker/design/styles/tokens.css';
import { Badge, Button } from '@tinker/design';
import './panes-demo.css';

type DemoData =
  | { readonly kind: 'chat'; readonly messages: ReadonlyArray<{ readonly id: string; readonly body: string }> }
  | { readonly kind: 'notes'; readonly body: string }
  | { readonly kind: 'timer'; readonly startedAt: number }
  | { readonly kind: 'terminal'; readonly transcript: ReadonlyArray<string> };

const ChatRenderer = ({ data }: { data: DemoData }): JSX.Element => {
  if (data.kind !== 'chat') return <div />;
  return (
    <div className="panes-demo-chat">
      <ul>
        {data.messages.map((message) => (
          <li key={message.id}>{message.body}</li>
        ))}
      </ul>
    </div>
  );
};

const NotesRenderer = ({ data }: { data: DemoData }): JSX.Element => {
  if (data.kind !== 'notes') return <div />;
  return <pre className="panes-demo-notes">{data.body}</pre>;
};

const TimerRenderer = ({ data }: { data: DemoData }): JSX.Element => {
  if (data.kind !== 'timer') return <div />;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const elapsed = Math.max(0, Math.round((now - data.startedAt) / 1000));
  return <div className="panes-demo-timer">Elapsed: {elapsed}s</div>;
};

const TerminalRenderer = ({ data }: { data: DemoData }): JSX.Element => {
  if (data.kind !== 'terminal') return <div />;
  return (
    <pre className="panes-demo-terminal">
      {data.transcript.map((line, index) => (
        <div key={index}>{line}</div>
      ))}
    </pre>
  );
};

const createSeedModel = (): IJsonModel => ({
  global: {
    tabEnableClose: true,
    tabEnableDrag: true,
    tabSetEnableDrop: true,
    tabSetEnableDrag: true,
    tabSetEnableMaximize: true,
  },
  borders: [],
  layout: {
    type: 'row',
    weight: 100,
    children: [
      {
        type: 'row',
        weight: 50,
        children: [
          {
            type: 'tabset',
            weight: 60,
            active: true,
            children: [
              {
                type: 'tab',
                id: 'p-chat',
                name: 'Chat',
                component: 'chat',
                config: {
                  kind: 'chat',
                  messages: [
                    { id: 'm1', body: 'Welcome to FlexLayout — VSCode-style split + tab groups.' },
                    { id: 'm2', body: 'Drag a tab onto another pane edge to split.' },
                    { id: 'm3', body: 'Drag onto the body center to merge it in as a new tab.' },
                  ],
                } satisfies DemoData,
              },
            ],
          },
          {
            type: 'tabset',
            weight: 40,
            children: [
              {
                type: 'tab',
                id: 'p-term',
                name: 'Terminal',
                component: 'terminal',
                config: {
                  kind: 'terminal',
                  transcript: ['$ echo hello', 'hello', '$ ls'],
                } satisfies DemoData,
              },
            ],
          },
        ],
      },
      {
        type: 'tabset',
        weight: 50,
        children: [
          {
            type: 'tab',
            id: 'p-notes',
            name: 'Notes',
            component: 'notes',
            config: { kind: 'notes', body: '# Notes\n\nScratch pad.' } satisfies DemoData,
          },
          {
            type: 'tab',
            id: 'p-timer',
            name: 'Timer',
            component: 'timer',
            config: { kind: 'timer', startedAt: Date.now() } satisfies DemoData,
          },
        ],
      },
    ],
  },
});

export const PanesDemo = (): JSX.Element => {
  const modelRef = useRef<Model | null>(null);
  if (!modelRef.current) {
    modelRef.current = Model.fromJson(createSeedModel());
  }
  const model = modelRef.current;

  const [paneCounter, setPaneCounter] = useState(100);
  const [modelRevision, setModelRevision] = useState(0);

  const handleModelChange = useCallback(() => {
    setModelRevision((v) => v + 1);
  }, []);

  const factory = useCallback((node: TabNode): JSX.Element => {
    const component = node.getComponent();
    const config = node.getConfig() as DemoData;

    switch (component) {
      case 'chat':
        return <ChatRenderer data={config} />;
      case 'notes':
        return <NotesRenderer data={config} />;
      case 'timer':
        return <TimerRenderer data={config} />;
      case 'terminal':
        return <TerminalRenderer data={config} />;
      default:
        return <div>Unknown: {component}</div>;
    }
  }, []);

  const addPaneToActiveTabset = useCallback(() => {
    const paneId = `p-${paneCounter}`;
    setPaneCounter((v) => v + 1);
    const activeTabset = model.getActiveTabset();
    const targetId = activeTabset?.getId() ?? model.getFirstTabSet().getId();

    model.doAction(
      Actions.addTab(
        {
          type: 'tab',
          id: paneId,
          name: `Notes ${paneId}`,
          component: 'notes',
          config: { kind: 'notes', body: `Pane ${paneId} @ ${new Date().toLocaleTimeString()}` } satisfies DemoData,
        },
        targetId,
        DockLocation.CENTER,
        -1,
        true,
      ),
    );
  }, [paneCounter, model]);

  const splitActiveRight = useCallback(() => {
    const paneId = `p-${paneCounter}`;
    setPaneCounter((v) => v + 1);
    const activeTabset = model.getActiveTabset();
    const targetId = activeTabset?.getId() ?? model.getFirstTabSet().getId();

    model.doAction(
      Actions.addTab(
        {
          type: 'tab',
          id: paneId,
          name: `Timer ${paneId}`,
          component: 'timer',
          config: { kind: 'timer', startedAt: Date.now() } satisfies DemoData,
        },
        targetId,
        DockLocation.RIGHT,
        -1,
        true,
      ),
    );
  }, [paneCounter, model]);

  const splitActiveBottom = useCallback(() => {
    const paneId = `p-${paneCounter}`;
    setPaneCounter((v) => v + 1);
    const activeTabset = model.getActiveTabset();
    const targetId = activeTabset?.getId() ?? model.getFirstTabSet().getId();

    model.doAction(
      Actions.addTab(
        {
          type: 'tab',
          id: paneId,
          name: `Terminal ${paneId}`,
          component: 'terminal',
          config: { kind: 'terminal', transcript: [`$ tail ${paneId}.log`, 'ok'] } satisfies DemoData,
        },
        targetId,
        DockLocation.BOTTOM,
        -1,
        true,
      ),
    );
  }, [paneCounter, model]);

  const stats = useMemo(() => {
    let tabsets = 0;
    let tabs = 0;
    model.visitNodes((node) => {
      if (node.getType() === 'tabset') tabsets += 1;
      if (node.getType() === 'tab') tabs += 1;
    });
    return { tabsets, tabs };
  }, [model, modelRevision]);

  return (
    <main className="panes-demo-shell">
      <header className="panes-demo-header">
        <div>
          <p className="panes-demo-eyebrow">FlexLayout workspace</p>
          <h1>Workspace with tabsets + splits</h1>
        </div>
        <div className="panes-demo-actions">
          <Button variant="secondary" size="s" onClick={addPaneToActiveTabset}>
            + Pane in active tabset
          </Button>
          <Button variant="secondary" size="s" onClick={splitActiveRight}>
            + Split right
          </Button>
          <Button variant="secondary" size="s" onClick={splitActiveBottom}>
            + Split bottom
          </Button>
          <Badge variant="accent" size="small">
            tabsets {stats.tabsets} · tabs {stats.tabs}
          </Badge>
        </div>
      </header>

      <section className="panes-demo-workspace" data-testid="panes-demo-root">
        <Layout
          model={model}
          factory={factory}
          onModelChange={handleModelChange}
        />
      </section>

      <footer className="panes-demo-footer">
        <p>
          Drag pane tabs between tabsets · drop on edges to split · drop on center to merge
        </p>
      </footer>
    </main>
  );
};
