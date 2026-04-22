import { useEffect, useRef, type ChangeEvent, type JSX } from 'react';
import { cx } from '../cx.js';
import type { ModelPickerGroup } from './ModelPicker.js';

const SearchIcon = (): JSX.Element => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden="true"
    className="tk-modelpicker__search-icon"
  >
    <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
    <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export type ModelPickerPanelProps = {
  readonly groups: ReadonlyArray<ModelPickerGroup>;
  readonly activeIndex: number;
  readonly filter: string;
  readonly onFilterChange: (next: string) => void;
  readonly onSelectItem: (id: string) => void;
  readonly onRowMouseMove: (flatIndex: number) => void;
  readonly loading: boolean;
  readonly searchPlaceholder: string;
  readonly emptyLabel: string;
  readonly loadingLabel: string;
  readonly selectedId: string | undefined;
};

const formatContextWindow = (tokens: number): string => {
  if (tokens >= 1_000_000) {
    const value = tokens / 1_000_000;
    const rounded = Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
    return `${rounded}M ctx`;
  }
  if (tokens >= 1_000) {
    const value = tokens / 1_000;
    const rounded = Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
    return `${rounded}K ctx`;
  }
  return `${tokens} ctx`;
};

export const ModelPickerPanel = ({
  groups,
  activeIndex,
  filter,
  onFilterChange,
  onSelectItem,
  onRowMouseMove,
  loading,
  searchPlaceholder,
  emptyLabel,
  loadingLabel,
  selectedId,
}: ModelPickerPanelProps): JSX.Element => {
  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const node = searchRef.current;
    if (node == null) return;
    node.focus();
  }, []);

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>): void => {
    onFilterChange(event.target.value);
  };

  let flatIndex = 0;
  const isEmpty = !loading && groups.length === 0;

  return (
    <div className="tk-modelpicker__panel" role="dialog" aria-label="Select model">
      <div className="tk-modelpicker__search">
        <SearchIcon />
        <input
          ref={searchRef}
          type="search"
          className="tk-modelpicker__search-input"
          value={filter}
          onChange={handleSearchChange}
          placeholder={searchPlaceholder}
          spellCheck={false}
          autoCorrect="off"
          autoComplete="off"
          autoCapitalize="off"
          data-testid="modelpicker-search"
        />
      </div>

      <div
        className="tk-modelpicker__body"
        role="listbox"
        aria-label="Models"
        data-testid="modelpicker-list"
      >
        {loading ? (
          <div className="tk-modelpicker__status" data-testid="modelpicker-loading">
            {loadingLabel}
          </div>
        ) : isEmpty ? (
          <div className="tk-modelpicker__status" data-testid="modelpicker-empty">
            {emptyLabel}
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.providerId} className="tk-modelpicker__group">
              <div className="tk-modelpicker__group-header" aria-hidden="true">
                {group.providerName}
              </div>
              {group.items.map((item) => {
                const thisIndex = flatIndex;
                flatIndex += 1;
                const active = thisIndex === activeIndex;
                const isSelected = selectedId != null && item.id === selectedId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    data-key={item.id}
                    data-active={active ? 'true' : 'false'}
                    data-selected={isSelected ? 'true' : 'false'}
                    className={cx(
                      'tk-modelpicker__row',
                      active && 'tk-modelpicker__row--active',
                    )}
                    onClick={() => onSelectItem(item.id)}
                    onMouseMove={(event) => {
                      if (event.movementX === 0 && event.movementY === 0) return;
                      onRowMouseMove(thisIndex);
                    }}
                  >
                    <span className="tk-modelpicker__row-provider">{item.providerName}</span>
                    <span className="tk-modelpicker__row-name">{item.name}</span>
                    <span className="tk-modelpicker__row-meta">
                      {item.contextWindow != null ? (
                        <span className="tk-modelpicker__row-context">
                          {formatContextWindow(item.contextWindow)}
                        </span>
                      ) : null}
                      {item.pricingHint != null ? (
                        <span className="tk-modelpicker__row-price">{item.pricingHint}</span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
