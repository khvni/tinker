import { useCallback, useState, type JSX, type ReactNode } from 'react';
import { EmptyPane } from '../EmptyPane/index.js';
import './SettingsShell.css';

export type SettingsShellSection = {
  readonly id: string;
  readonly label: string;
  readonly icon?: ReactNode;
  readonly content: ReactNode;
};

export type SettingsShellProps = {
  readonly sections: ReadonlyArray<SettingsShellSection>;
  readonly activeSectionId?: string;
  readonly defaultActiveSectionId?: string;
  readonly onActiveSectionChange?: (id: string) => void;
  readonly emptyState?: ReactNode;
  readonly title?: string;
};

const DEFAULT_EMPTY: JSX.Element = (
  <EmptyPane
    eyebrow="Settings"
    title="No settings yet"
    description="Sections plug into this shell as features ship. Pick one from the left once they arrive."
  />
);

export const SettingsShell = ({
  sections,
  activeSectionId,
  defaultActiveSectionId,
  onActiveSectionChange,
  emptyState,
  title = 'Settings',
}: SettingsShellProps): JSX.Element => {
  const firstSectionId = sections[0]?.id;
  const [internalId, setInternalId] = useState<string | undefined>(
    defaultActiveSectionId ?? firstSectionId,
  );
  const isControlled = activeSectionId !== undefined;
  const resolvedId = isControlled ? activeSectionId : internalId;

  const handleSelect = useCallback(
    (id: string) => {
      if (!isControlled) {
        setInternalId(id);
      }
      onActiveSectionChange?.(id);
    },
    [isControlled, onActiveSectionChange],
  );

  if (sections.length === 0) {
    return (
      <section className="tk-settings-shell tk-settings-shell--empty" aria-label={title}>
        {emptyState ?? DEFAULT_EMPTY}
      </section>
    );
  }

  const activeSection =
    sections.find((section) => section.id === resolvedId) ?? sections[0]!;
  const activeId = activeSection.id;
  const navLabel = `${title} sections`;

  return (
    <section className="tk-settings-shell" aria-label={title}>
      <aside className="tk-settings-shell__rail">
        <p className="tk-settings-shell__eyebrow">{title}</p>
        <nav className="tk-settings-shell__nav" aria-label={navLabel}>
          {sections.map((section) => {
            const active = section.id === activeId;
            const classes = active
              ? 'tk-settings-shell__nav-item tk-settings-shell__nav-item--active'
              : 'tk-settings-shell__nav-item';
            return (
              <button
                key={section.id}
                type="button"
                aria-current={active ? 'page' : undefined}
                className={classes}
                onClick={() => handleSelect(section.id)}
              >
                {section.icon ? (
                  <span className="tk-settings-shell__nav-icon" aria-hidden="true">
                    {section.icon}
                  </span>
                ) : null}
                <span className="tk-settings-shell__nav-label">{section.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <div
        className="tk-settings-shell__content"
        role="region"
        aria-label={activeSection.label}
      >
        {activeSection.content ?? emptyState ?? DEFAULT_EMPTY}
      </div>
    </section>
  );
};
