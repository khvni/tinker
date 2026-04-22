import {
  createAttentionStore,
  FLASH_DURATION_MS,
  getFlashOpacity,
  type FlashAccent,
} from '@tinker/attention';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { useStore } from 'zustand';
import type { DropTarget, Pane, StackId, StackNode, Tab } from '../../types.js';
import { classifyBodyDrop, type BodyDrop } from '../../core/utils/layout.js';
import type { PaneDefinition, PaneRegistry, WorkspaceAttentionConfig } from '../types.js';

const PANE_DRAG_MIME = 'application/x-tinker-pane';
const ATTENTION_DISABLED_WORKSPACE_ID = '__tinker-panes-attention-disabled__';
const DISABLED_ATTENTION_STORE = createAttentionStore();
const EMPTY_PANE_IDS = new Set<string>();

type StackProps<TData> = {
  readonly tab: Tab<TData>;
  readonly node: StackNode;
  readonly registry: PaneRegistry<TData>;
  readonly attention?: WorkspaceAttentionConfig;
  readonly isActiveStack: boolean;
  readonly onFocusPane: (stackId: StackId, paneId: string) => void;
  readonly onClosePane: (paneId: string) => void;
  readonly onReorderPaneInStack: (paneId: string, toIndex: number) => void;
  readonly onDropPane: (info: { sourcePaneId: string; targetStackId: StackId; target: DropTarget }) => void;
};

const resolveTitle = <TData,>(definition: PaneDefinition<TData>, pane: Pane<TData>): string => {
  if (pane.title) return pane.title;
  if (typeof definition.defaultTitle === 'function') return definition.defaultTitle(pane);
  return definition.defaultTitle ?? pane.kind;
};

const resolveIcon = <TData,>(definition: PaneDefinition<TData>, pane: Pane<TData>): ReactNode => {
  if (typeof definition.icon === 'function') return definition.icon(pane);
  return definition.icon ?? null;
};

export const Stack = <TData,>({
  tab,
  node,
  registry,
  attention,
  isActiveStack,
  onFocusPane,
  onClosePane,
  onReorderPaneInStack,
  onDropPane,
}: StackProps<TData>): ReactNode => {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [bodyDrop, setBodyDrop] = useState<BodyDrop | null>(null);
  const [tabInsertIndex, setTabInsertIndex] = useState<number | null>(null);
  const attentionStore = attention?.store ?? DISABLED_ATTENTION_STORE;
  const attentionWorkspaceId = attention?.workspaceId ?? ATTENTION_DISABLED_WORKSPACE_ID;
  const unreadPaneIds = useStore(
    attentionStore,
    (state) => state.workspaces[attentionWorkspaceId]?.unreadPaneIds ?? EMPTY_PANE_IDS,
  );
  const manualUnreadPaneIds = useStore(
    attentionStore,
    (state) => state.workspaces[attentionWorkspaceId]?.manualUnreadPaneIds ?? EMPTY_PANE_IDS,
  );
  const activeFlash = useStore(
    attentionStore,
    (state) => state.workspaces[attentionWorkspaceId]?.activeFlash ?? null,
  );
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  const activePaneId = node.activePaneId;
  const activePane = activePaneId ? tab.panes[activePaneId] : undefined;

  useEffect(() => {
    if (!activeFlash) return;

    const raf = typeof globalThis.requestAnimationFrame === 'function';
    let handle: number | ReturnType<typeof setTimeout>;
    setCurrentTime(Date.now());

    const tick = (): void => {
      const nextTime = Date.now();
      setCurrentTime(nextTime);
      if (nextTime - activeFlash.startedAt < FLASH_DURATION_MS) {
        handle = raf ? globalThis.requestAnimationFrame(tick) : setTimeout(tick, 16);
      }
    };

    handle = raf ? globalThis.requestAnimationFrame(tick) : setTimeout(tick, 16);
    return () => {
      if (raf) globalThis.cancelAnimationFrame(handle as number);
      else clearTimeout(handle as ReturnType<typeof setTimeout>);
    };
  }, [activeFlash]);

  const resolvePaneAttention = useCallback(
    (
      paneId: string,
    ): {
      readonly unread: boolean;
      readonly flash: null | { readonly accent: FlashAccent; readonly opacity: number };
    } => {
      const unread =
        unreadPaneIds.has(paneId)
        || manualUnreadPaneIds.has(paneId);
      if (!activeFlash || activeFlash.paneId !== paneId) {
        return { unread, flash: null };
      }

      const elapsed = currentTime - activeFlash.startedAt;
      if (elapsed >= FLASH_DURATION_MS) {
        return { unread, flash: null };
      }

      return {
        unread,
        flash: {
          accent: activeFlash.accent,
          opacity: getFlashOpacity(activeFlash.accent, elapsed),
        },
      };
    },
    [activeFlash, currentTime, manualUnreadPaneIds, unreadPaneIds],
  );

  const activePaneAttention = activePane ? resolvePaneAttention(activePane.id) : null;
  const edgeAttention = !isActiveStack && activePaneAttention
    ? activePaneAttention.unread
      ? { accent: 'notification-blue' as const, opacity: 1 }
      : activePaneAttention.flash
    : null;
  const edgeAttentionStyle = edgeAttention
    ? ({
        '--tinker-pane-attention-opacity': String(edgeAttention.opacity),
      } as CSSProperties)
    : undefined;

  // ────────────────────────────────────────────────────────────────────────
  // Drag sources — tab → pane move
  // ────────────────────────────────────────────────────────────────────────

  const handleTabDragStart = useCallback(
    (paneId: string) => (event: DragEvent<HTMLDivElement>) => {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData(PANE_DRAG_MIME, paneId);
      event.dataTransfer.setData('text/plain', paneId);
    },
    [],
  );

  // ────────────────────────────────────────────────────────────────────────
  // Drop targets — body (edge + center) and tab-bar (insert index)
  // ────────────────────────────────────────────────────────────────────────

  const isPaneDrag = (event: DragEvent<HTMLElement>): boolean =>
    Array.from(event.dataTransfer.types).includes(PANE_DRAG_MIME);

  const handleBodyDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!isPaneDrag(event)) return;
      const body = bodyRef.current;
      if (!body) return;
      const state = classifyBodyDrop(body.getBoundingClientRect(), event.clientX, event.clientY);
      if (!state) {
        setBodyDrop(null);
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      setBodyDrop(state);
    },
    [],
  );

  const handleBodyDragLeave = useCallback(() => setBodyDrop(null), []);

  const handleBodyDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!isPaneDrag(event)) return;
      event.preventDefault();
      const body = bodyRef.current;
      if (!body) return;
      const sourcePaneId = event.dataTransfer.getData(PANE_DRAG_MIME);
      const state = classifyBodyDrop(body.getBoundingClientRect(), event.clientX, event.clientY);
      setBodyDrop(null);
      if (!sourcePaneId || !state) return;
      const target: DropTarget =
        state.kind === 'center'
          ? { kind: 'center' }
          : { kind: 'edge', edge: state.edge };
      onDropPane({ sourcePaneId, targetStackId: node.id, target });
    },
    [node.id, onDropPane],
  );

  const handleTabBarDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!isPaneDrag(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    },
    [],
  );

  const handleTabDragOver = useCallback(
    (index: number) => (event: DragEvent<HTMLDivElement>) => {
      if (!isPaneDrag(event)) return;
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      const effectiveIndex = event.clientX < rect.left + rect.width / 2 ? index : index + 1;
      setTabInsertIndex(effectiveIndex);
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    },
    [],
  );

  const handleTabBarLeave = useCallback(() => setTabInsertIndex(null), []);

  const handleTabDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!isPaneDrag(event)) return;
      event.preventDefault();
      const sourcePaneId = event.dataTransfer.getData(PANE_DRAG_MIME);
      setTabInsertIndex(null);
      if (!sourcePaneId) return;

      // Compute authoritative insert index at drop time (pointer-accurate,
      // not reliant on React state propagation from the last dragover).
      // Walk every tab element; pick the first whose midpoint is to the right
      // of the pointer. Falling through means "append at end".
      const tabListEl = event.currentTarget as HTMLElement;
      const tabEls = tabListEl.querySelectorAll('[role="tab"][data-pane-id]');
      let insertIndex = tabEls.length;
      for (let i = 0; i < tabEls.length; i += 1) {
        const rect = (tabEls[i] as HTMLElement).getBoundingClientRect();
        if (event.clientX < rect.left + rect.width / 2) {
          insertIndex = i;
          break;
        }
      }

      // If source belongs to this stack, prefer a pure reorder.
      if (node.paneIds.includes(sourcePaneId)) {
        const currentIndex = node.paneIds.indexOf(sourcePaneId);
        // reorderPaneInStack moves source out first, then inserts — so adjust
        // the caller-side target index when the source is currently before it.
        const toIndex = currentIndex < insertIndex ? insertIndex - 1 : insertIndex;
        onReorderPaneInStack(sourcePaneId, toIndex);
        return;
      }
      onDropPane({
        sourcePaneId,
        targetStackId: node.id,
        target: { kind: 'insert', index: insertIndex },
      });
    },
    [node.id, node.paneIds, onDropPane, onReorderPaneInStack],
  );

  // ────────────────────────────────────────────────────────────────────────
  // Keyboard nav across tabs (within this stack)
  // ────────────────────────────────────────────────────────────────────────

  const handleTabKeyDown = useCallback(
    (index: number) => (event: KeyboardEvent<HTMLDivElement>) => {
      const pane = tab.panes[node.paneIds[index] ?? ''];
      if (!pane) return;
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        const neighbor = node.paneIds[Math.min(index + 1, node.paneIds.length - 1)];
        if (neighbor) onFocusPane(node.id, neighbor);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        const neighbor = node.paneIds[Math.max(index - 1, 0)];
        if (neighbor) onFocusPane(node.id, neighbor);
      } else if (event.key === 'Delete' || (event.metaKey && event.key === 'w')) {
        event.preventDefault();
        onClosePane(pane.id);
      }
    },
    [node.id, node.paneIds, onClosePane, onFocusPane, tab.panes],
  );

  const handleStackActivate = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      // Don't hijack close-button clicks.
      if ((event.target as HTMLElement).closest('[data-tinker-pane-action]')) return;
      if (activePaneId) onFocusPane(node.id, activePaneId);
    },
    [activePaneId, node.id, onFocusPane],
  );

  const paneTabs = useMemo(() => node.paneIds.map((id) => tab.panes[id]).filter((p): p is Pane<TData> => Boolean(p)), [node.paneIds, tab.panes]);

  return (
    <div
      className={`tinker-stack${isActiveStack ? ' tinker-stack--active' : ''}`}
      data-stack-id={node.id}
      data-active-pane-id={activePaneId ?? undefined}
      data-attention-accent={edgeAttention?.accent ?? undefined}
      data-drop-center={bodyDrop?.kind === 'center' || undefined}
      style={edgeAttentionStyle}
      onPointerDown={handleStackActivate}
    >
      <div
        role="tablist"
        aria-label="Pane tabs"
        className="tinker-stack__tabs"
        onDragOver={handleTabBarDragOver}
        onDragLeave={handleTabBarLeave}
        onDrop={handleTabDrop}
      >
        {paneTabs.map((pane, index) => {
          const definition = registry[pane.kind];
          const title = definition ? resolveTitle(definition, pane) : pane.kind;
          const icon = definition ? resolveIcon(definition, pane) : null;
          const isActive = pane.id === activePaneId;
          const paneAttention = resolvePaneAttention(pane.id);
          const tabAttention = paneAttention.unread
            ? { accent: 'notification-blue' as const, opacity: 1 }
            : paneAttention.flash;
          const showInsertBefore = tabInsertIndex === index;
          const showInsertAfter = tabInsertIndex === index + 1 && index === paneTabs.length - 1;
          const tabAttentionStyle = tabAttention
            ? ({
                '--tinker-pane-attention-opacity': String(tabAttention.opacity),
              } as CSSProperties)
            : undefined;
          return (
            <div
              key={pane.id}
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              draggable
              data-pane-id={pane.id}
              className={`tinker-stack__tab${isActive ? ' tinker-stack__tab--active' : ''}`}
              data-insert-before={showInsertBefore || undefined}
              data-insert-after={showInsertAfter || undefined}
              onDragStart={handleTabDragStart(pane.id)}
              onDragOver={handleTabDragOver(index)}
              onClick={() => onFocusPane(node.id, pane.id)}
              onKeyDown={handleTabKeyDown(index)}
              title={title}
            >
              {icon ? <span className="tinker-stack__tab-icon" aria-hidden>{icon}</span> : null}
              <span className="tinker-stack__tab-label-shell">
                <span className="tinker-stack__tab-label">{title}</span>
                {tabAttention ? (
                  <span
                    className="tinker-stack__tab-attention"
                    data-attention-accent={tabAttention.accent}
                    style={tabAttentionStyle}
                    aria-hidden
                  />
                ) : null}
              </span>
              <span
                role="button"
                tabIndex={-1}
                aria-label={`Close ${title}`}
                data-tinker-pane-action="close"
                className="tinker-stack__tab-close"
                onClick={(event) => {
                  event.stopPropagation();
                  onClosePane(pane.id);
                }}
              >
                ×
              </span>
            </div>
          );
        })}
      </div>

      <div
        ref={bodyRef}
        className="tinker-stack__body"
        onDragOver={handleBodyDragOver}
        onDragLeave={handleBodyDragLeave}
        onDrop={handleBodyDrop}
      >
        {activePane ? <ActivePaneRenderer tab={tab} pane={activePane} registry={registry} isActive={isActiveStack} /> : null}
        {bodyDrop ? (
          <div
            className={`tinker-stack__drop tinker-stack__drop--${bodyDrop.kind === 'center' ? 'center' : bodyDrop.edge}`}
            aria-hidden
          />
        ) : null}
      </div>
    </div>
  );
};

type ActivePaneRendererProps<TData> = {
  readonly tab: Tab<TData>;
  readonly pane: Pane<TData>;
  readonly registry: PaneRegistry<TData>;
  readonly isActive: boolean;
};

const ActivePaneRenderer = <TData,>({ tab, pane, registry, isActive }: ActivePaneRendererProps<TData>): ReactNode => {
  const definition = registry[pane.kind];
  if (!definition) {
    return (
      <div className="tinker-stack__missing" role="alert">
        No renderer registered for kind &quot;{pane.kind}&quot;.
      </div>
    );
  }
  const RenderContent = definition.render;
  return <RenderContent tabId={tab.id} pane={pane} isActive={isActive} />;
};
