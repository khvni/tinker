import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type JSX,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { cx } from '../cx.js';
import { ModelPickerTrigger } from './ModelPickerTrigger.js';
import { ModelPickerPanel } from './ModelPickerPanel.js';
import './ModelPicker.css';

export type ModelPickerItem = {
  id: string;
  providerId: string;
  providerName: string;
  name: string;
  contextWindow?: number;
  pricingHint?: string;
};

export type ModelPickerProps = {
  items: ReadonlyArray<ModelPickerItem>;
  value?: string | undefined;
  onSelect: (id: string) => void;
  loading?: boolean | undefined;
  disabled?: boolean | undefined;
  triggerLabel?: string | undefined;
  providerOrder?: ReadonlyArray<string> | undefined;
  searchPlaceholder?: string | undefined;
  emptyLabel?: string | undefined;
  loadingLabel?: string | undefined;
  openShortcut?: string | undefined;
  defaultOpen?: boolean | undefined;
  defaultFilter?: string | undefined;
  className?: string | undefined;
};

export type ModelPickerGroup = {
  readonly providerId: string;
  readonly providerName: string;
  readonly items: ReadonlyArray<ModelPickerItem>;
};

type State = {
  readonly open: boolean;
  readonly filter: string;
  readonly activeIndex: number;
  readonly mouseActive: boolean;
};

type Action =
  | { type: 'setOpen'; open: boolean; initialIndex: number }
  | { type: 'close' }
  | { type: 'setFilter'; filter: string; initialIndex: number }
  | { type: 'setActive'; index: number; fromMouse: boolean }
  | { type: 'disableMouse' };

const DEFAULT_PROVIDER_ORDER: ReadonlyArray<string> = [
  'anthropic',
  'openai',
  'google',
  'openrouter',
];

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'setOpen':
      return { ...state, open: action.open, activeIndex: action.initialIndex };
    case 'close':
      return { ...state, open: false };
    case 'setFilter':
      return { ...state, filter: action.filter, activeIndex: action.initialIndex };
    case 'setActive':
      return { ...state, activeIndex: action.index, mouseActive: action.fromMouse };
    case 'disableMouse':
      return { ...state, mouseActive: false };
  }
};

const isMac = (): boolean =>
  typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac');

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
};

const shortcutMatches = (event: KeyboardEvent, spec: string): boolean => {
  const parts = spec.split('+').map((p) => p.trim()).filter((p) => p.length > 0);
  if (parts.length === 0) return false;
  const keyPart = parts[parts.length - 1];
  if (typeof keyPart !== 'string' || keyPart.length === 0) return false;
  const mods = new Set(parts.slice(0, -1).map((m) => m.toLowerCase()));
  const wantMeta = mods.has('meta') || mods.has('cmd') || (mods.has('mod') && isMac());
  const wantCtrl = mods.has('ctrl') || mods.has('control') || (mods.has('mod') && !isMac());
  const wantShift = mods.has('shift');
  const wantAlt = mods.has('alt') || mods.has('option');
  return (
    event.metaKey === wantMeta &&
    event.ctrlKey === wantCtrl &&
    event.shiftKey === wantShift &&
    event.altKey === wantAlt &&
    event.key.toLowerCase() === keyPart.toLowerCase()
  );
};

const groupAndSort = (
  items: ReadonlyArray<ModelPickerItem>,
  providerOrder: ReadonlyArray<string>,
): ReadonlyArray<ModelPickerGroup> => {
  const byProvider = new Map<string, { providerName: string; items: ModelPickerItem[] }>();
  for (const item of items) {
    const bucket = byProvider.get(item.providerId);
    if (bucket) bucket.items.push(item);
    else byProvider.set(item.providerId, { providerName: item.providerName, items: [item] });
  }
  const ids = Array.from(byProvider.keys()).sort((a, b) => {
    const aIdx = providerOrder.indexOf(a);
    const bIdx = providerOrder.indexOf(b);
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return (byProvider.get(a)?.providerName ?? a).localeCompare(
      byProvider.get(b)?.providerName ?? b,
    );
  });
  return ids.map((providerId) => {
    const entry = byProvider.get(providerId);
    const sorted = [...(entry?.items ?? [])].sort((a, b) => a.name.localeCompare(b.name));
    return { providerId, providerName: entry?.providerName ?? providerId, items: sorted };
  });
};

const filterItems = (
  items: ReadonlyArray<ModelPickerItem>,
  filter: string,
): ReadonlyArray<ModelPickerItem> => {
  const needle = filter.trim().toLowerCase();
  if (needle.length === 0) return items;
  return items.filter((i) =>
    `${i.providerName}\n${i.name}\n${i.id}`.toLowerCase().includes(needle),
  );
};

const findInitialIndex = (
  flat: ReadonlyArray<ModelPickerItem>,
  value: string | undefined,
): number => {
  if (flat.length === 0) return -1;
  if (value != null) {
    const idx = flat.findIndex((i) => i.id === value);
    if (idx !== -1) return idx;
  }
  return 0;
};

export const ModelPicker = ({
  items,
  value,
  onSelect,
  loading = false,
  disabled = false,
  triggerLabel = 'Select model',
  providerOrder = DEFAULT_PROVIDER_ORDER,
  searchPlaceholder = 'Search models',
  emptyLabel = 'No models',
  loadingLabel = 'Loading models\u2026',
  openShortcut = "Mod+'",
  defaultOpen = false,
  defaultFilter = '',
  className,
}: ModelPickerProps): JSX.Element => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    open: defaultOpen,
    filter: defaultFilter,
    activeIndex: -1,
    mouseActive: false,
  }));

  const allGroups = useMemo(() => groupAndSort(items, providerOrder), [items, providerOrder]);
  const flatAll = useMemo(() => allGroups.flatMap((g) => g.items), [allGroups]);

  const filteredGroups = useMemo<ReadonlyArray<ModelPickerGroup>>(() => {
    const allowed = new Set(filterItems(flatAll, state.filter).map((i) => i.id));
    return allGroups
      .map((g) => ({ ...g, items: g.items.filter((i) => allowed.has(i.id)) }))
      .filter((g) => g.items.length > 0);
  }, [allGroups, flatAll, state.filter]);

  const flatFiltered = useMemo(() => filteredGroups.flatMap((g) => g.items), [filteredGroups]);

  // Clamp active index when the list shrinks / grows.
  useEffect(() => {
    if (flatFiltered.length === 0) {
      if (state.activeIndex !== -1) dispatch({ type: 'setActive', index: -1, fromMouse: false });
      return;
    }
    if (state.activeIndex < 0 || state.activeIndex >= flatFiltered.length) {
      dispatch({ type: 'setActive', index: 0, fromMouse: false });
    }
  }, [flatFiltered.length, state.activeIndex]);

  const handleFilterChange = useCallback(
    (next: string) => {
      const filtered = filterItems(flatAll, next);
      dispatch({
        type: 'setFilter',
        filter: next,
        initialIndex: filtered.length === 0 ? -1 : 0,
      });
    },
    [flatAll],
  );

  const openPicker = useCallback(() => {
    if (disabled) return;
    dispatch({
      type: 'setOpen',
      open: true,
      initialIndex: findInitialIndex(flatFiltered, value),
    });
  }, [disabled, flatFiltered, value]);

  const closePicker = useCallback(() => dispatch({ type: 'close' }), []);

  const togglePicker = useCallback(() => {
    if (disabled) return;
    if (state.open) closePicker();
    else openPicker();
  }, [disabled, state.open, openPicker, closePicker]);

  // Open-shortcut listener.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onKey = (event: KeyboardEvent): void => {
      if (isEditableTarget(event.target)) return;
      if (!shortcutMatches(event, openShortcut)) return;
      if (state.open || disabled) return;
      event.preventDefault();
      openPicker();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openShortcut, state.open, disabled, openPicker]);

  // Click outside closes. Guard against scrollbar-gutter mousedown on the
  // document root (target === html/body with clientX past content area).
  useEffect(() => {
    if (!state.open) return;
    const onPointerDown = (event: MouseEvent): void => {
      const wrapper = wrapperRef.current;
      if (wrapper == null) return;
      const target = event.target;
      if (target instanceof Node && wrapper.contains(target)) return;
      if (target === document.documentElement || target === document.body) {
        if (event.clientX >= document.documentElement.clientWidth) return;
      }
      closePicker();
    };
    window.addEventListener('mousedown', onPointerDown);
    return () => window.removeEventListener('mousedown', onPointerDown);
  }, [state.open, closePicker]);

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (!state.open) return;
      // Let macOS text navigation (Alt+Arrow / Cmd+Arrow) pass through.
      if (event.altKey || event.metaKey) return;

      const total = flatFiltered.length;
      const move = (delta: 1 | -1): void => {
        event.preventDefault();
        dispatch({ type: 'disableMouse' });
        if (total === 0) return;
        const base = state.activeIndex < 0 ? (delta === 1 ? -1 : 0) : state.activeIndex;
        const next = (base + delta + total) % total;
        dispatch({ type: 'setActive', index: next, fromMouse: false });
      };

      if (event.key === 'ArrowDown') return move(1);
      if (event.key === 'ArrowUp') return move(-1);
      if (event.ctrlKey && !event.shiftKey && (event.key === 'n' || event.key === 'N')) {
        return move(1);
      }
      if (event.ctrlKey && !event.shiftKey && (event.key === 'p' || event.key === 'P')) {
        return move(-1);
      }
      if (event.key === 'Enter') {
        if (state.activeIndex < 0) return;
        const active = flatFiltered[state.activeIndex];
        if (active == null) return;
        event.preventDefault();
        onSelect(active.id);
        closePicker();
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        closePicker();
      }
    },
    [state.open, state.activeIndex, flatFiltered, onSelect, closePicker],
  );

  const handleSelectItem = useCallback(
    (id: string) => {
      onSelect(id);
      closePicker();
    },
    [onSelect, closePicker],
  );

  const handleRowMouseMove = useCallback((index: number) => {
    dispatch({ type: 'setActive', index, fromMouse: true });
  }, []);

  const selectedItem = useMemo(
    () => (value != null ? flatAll.find((i) => i.id === value) : undefined),
    [flatAll, value],
  );

  return (
    <div
      ref={wrapperRef}
      className={cx('tk-modelpicker', className)}
      onKeyDown={handleKeyDown}
    >
      <ModelPickerTrigger
        selected={selectedItem}
        fallbackLabel={triggerLabel}
        disabled={disabled}
        open={state.open}
        onToggle={togglePicker}
      />
      {state.open ? (
        <ModelPickerPanel
          groups={filteredGroups}
          activeIndex={state.activeIndex}
          filter={state.filter}
          onFilterChange={handleFilterChange}
          onSelectItem={handleSelectItem}
          onRowMouseMove={handleRowMouseMove}
          loading={loading}
          searchPlaceholder={searchPlaceholder}
          emptyLabel={emptyLabel}
          loadingLabel={loadingLabel}
          selectedId={value}
        />
      ) : null}
    </div>
  );
};
