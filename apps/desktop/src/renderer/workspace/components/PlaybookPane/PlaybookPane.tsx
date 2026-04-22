import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import {
  Badge,
  Button,
  EmptyState,
  IconButton,
  Modal,
  SearchInput,
  SegmentedControl,
  Skeleton,
  TextInput,
  Toggle,
  useToast,
} from '@tinker/design';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Skill, SkillGitConfig, SkillStore } from '@tinker/shared-types';
import { isGitAvailable, syncSkills } from '@tinker/memory';
import { usePlaybookPaneRuntime } from '../../playbook-pane-runtime.js';
import { runSkillAutoSync } from '../../skill-auto-sync.js';
import { PlaybookSettingsModal } from './components/PlaybookSettingsModal/index.js';
import {
  derivePlaybookRoleOptions,
  matchesPlaybookFilter,
  type PlaybookRoleFilter,
} from './playbookFilters.js';
import './PlaybookPane.css';

const MAX_PREVIEW_BODY_LENGTH = 16_000;

const SettingsIcon = (): JSX.Element => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z" />
  </svg>
);

const OverflowIcon = (): JSX.Element => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="5" cy="12" r="1" />
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
  </svg>
);

export type PlaybookPaneProps = {
  /**
   * Test hook: supply the skill store + active-skill revision callback
   * directly rather than reading from `PlaybookPaneRuntimeContext`. Production
   * callers go through the context.
   */
  readonly runtimeOverride?: {
    readonly skillStore: SkillStore;
    readonly skillsRootPath: string | null;
    readonly onActiveSkillsChanged: () => void;
  };
  /**
   * Test hook: short-circuits `isGitAvailable()` so tests don't invoke the
   * shell plugin. Defaults to the production helper.
   */
  readonly gitAvailabilityOverride?: () => Promise<boolean>;
  /**
   * Test hook: replaces the real `syncSkills` call.
   */
  readonly syncSkillsOverride?: typeof syncSkills;
  /**
   * Test hook: replaces the Tauri dialog.open for the install-from-file flow.
   */
  readonly openFileDialogOverride?: () => Promise<string | null>;
};

export const PlaybookPane = (props: PlaybookPaneProps = {}): JSX.Element => {
  if (props.runtimeOverride) {
    return <PlaybookPaneInner {...props} runtimeOverride={props.runtimeOverride} />;
  }

  return <PlaybookPaneWithContextRuntime {...props} />;
};

const PlaybookPaneWithContextRuntime = (props: PlaybookPaneProps): JSX.Element => {
  const runtime = usePlaybookPaneRuntime();
  return <PlaybookPaneInner {...props} runtimeOverride={runtime} />;
};

type PlaybookPaneInnerProps = PlaybookPaneProps & {
  runtimeOverride: NonNullable<PlaybookPaneProps['runtimeOverride']>;
};

const PlaybookPaneInner = ({
  runtimeOverride: { skillStore, skillsRootPath, onActiveSkillsChanged },
  gitAvailabilityOverride,
  syncSkillsOverride,
  openFileDialogOverride,
}: PlaybookPaneInnerProps): JSX.Element => {

  const toast = useToast();
  const [skills, setSkills] = useState<ReadonlyArray<Skill>>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState<PlaybookRoleFilter>('');
  const [previewSkill, setPreviewSkill] = useState<Skill | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [uninstallTarget, setUninstallTarget] = useState<Skill | null>(null);

  const refresh = useCallback(async (): Promise<ReadonlyArray<Skill>> => {
    const next = await skillStore.list();
    setSkills(next);
    return next;
  }, [skillStore]);

  useEffect(() => {
    let active = true;

    void (async () => {
      setLoading(true);
      try {
        await refresh();
      } catch (error) {
        if (active) {
          toast.show({
            title: 'Could not load skills',
            description: error instanceof Error ? error.message : String(error),
            variant: 'error',
          });
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [refresh, toast]);

  const runAutoSync = useCallback(async (): Promise<void> => {
    try {
      await runSkillAutoSync({
        skillStore,
        skillsRootPath,
        ...(gitAvailabilityOverride ? { isGitAvailable: gitAvailabilityOverride } : {}),
        ...(syncSkillsOverride ? { syncSkills: syncSkillsOverride } : {}),
      });
    } catch (error) {
      toast.show({
        title: 'Skill git sync failed',
        description: error instanceof Error ? error.message : String(error),
        variant: 'warning',
      });
    }
  }, [gitAvailabilityOverride, skillStore, skillsRootPath, syncSkillsOverride, toast]);

  const installFromFile = useCallback(
    async (sourcePath: string): Promise<void> => {
      setInstalling(true);
      try {
        const installed = await skillStore.installFromFile(sourcePath);
        await refresh();
        onActiveSkillsChanged();
        toast.show({
          title: `Installed ${installed.title}`,
          variant: 'success',
        });
        void runAutoSync();
      } catch (error) {
        toast.show({
          title: 'Skill install failed',
          description: error instanceof Error ? error.message : String(error),
          variant: 'error',
        });
      } finally {
        setInstalling(false);
      }
    },
    [onActiveSkillsChanged, refresh, runAutoSync, skillStore, toast],
  );

  const handlePickInstallFile = useCallback(async (): Promise<void> => {
    try {
      const picker = openFileDialogOverride
        ?? (async () => {
          const result = await openDialog({
            multiple: false,
            directory: false,
            title: 'Pick a skill markdown file',
            filters: [{ name: 'Skill markdown', extensions: ['md', 'markdown'] }],
          });
          return typeof result === 'string' ? result : null;
        });

      const selected = await picker();
      if (!selected) {
        return;
      }

      await installFromFile(selected);
    } catch (error) {
      toast.show({
        title: 'Could not open file picker',
        description: error instanceof Error ? error.message : String(error),
        variant: 'error',
      });
    }
  }, [installFromFile, openFileDialogOverride, toast]);

  const handleToggleActive = useCallback(
    async (skill: Skill, next: boolean): Promise<void> => {
      try {
        await skillStore.setActive(skill.slug, next);
        await refresh();
        onActiveSkillsChanged();
      } catch (error) {
        toast.show({
          title: 'Could not update skill',
          description: error instanceof Error ? error.message : String(error),
          variant: 'error',
        });
      }
    },
    [onActiveSkillsChanged, refresh, skillStore, toast],
  );

  const handleSaveGitConfig = useCallback(
    async (config: SkillGitConfig): Promise<void> => {
      await skillStore.setGitConfig(config);
      toast.show({ title: 'Skill sync settings saved', variant: 'success' });
    },
    [skillStore, toast],
  );

  const handleSyncNow = useCallback(async (): Promise<void> => {
    // Validation errors surface inline in PlaybookSettingsModal via its own
    // try/catch → setError. Throw a descriptive Error and let the modal render
    // it; no toast here (single source of truth per review).
    const config = await skillStore.getGitConfig();
    if (!config) {
      throw new Error('No git remote configured. Add one in Settings before syncing.');
    }

    const isAvailable = await (gitAvailabilityOverride ?? isGitAvailable)();
    if (!isAvailable) {
      throw new Error('Git is not available on this machine. Install git before syncing skills.');
    }

    if (!skillsRootPath) {
      throw new Error('Skill store is not initialized yet.');
    }

    const syncFn = syncSkillsOverride ?? syncSkills;
    const report = await syncFn(skillsRootPath, config);
    await refresh();
    toast.show({
      title: 'Skill sync complete',
      description: `${report.message}${report.conflicts.length > 0 ? ` · conflicts: ${report.conflicts.join(', ')}` : ''}`,
      variant: report.conflicts.length > 0 ? 'warning' : 'success',
    });
  }, [gitAvailabilityOverride, refresh, skillStore, skillsRootPath, syncSkillsOverride, toast]);

  const handleConfirmUninstall = useCallback(
    async (skill: Skill): Promise<void> => {
      try {
        await skillStore.uninstall(skill.slug);
        await refresh();
        onActiveSkillsChanged();
        toast.show({ title: `Uninstalled ${skill.title}`, variant: 'success' });
        void runAutoSync();
      } catch (error) {
        toast.show({
          title: 'Could not uninstall skill',
          description: error instanceof Error ? error.message : String(error),
          variant: 'error',
        });
      } finally {
        setUninstallTarget(null);
      }
    },
    [onActiveSkillsChanged, refresh, runAutoSync, skillStore, toast],
  );

  const roleOptions = useMemo(() => derivePlaybookRoleOptions(skills), [skills]);

  const filteredSkills = useMemo(() => {
    return skills.filter((skill) => {
      if (roleFilter.length > 0 && skill.role !== roleFilter) {
        return false;
      }

      return matchesPlaybookFilter(skill, filter);
    });
  }, [filter, roleFilter, skills]);

  return (
    <section className="tinker-pane tinker-playbook-pane">
      <header className="tinker-playbook-pane__header">
        <div>
          <p className="tinker-eyebrow">Playbook</p>
          <h2 className="tinker-playbook-pane__title">Skills</h2>
        </div>
        <div className="tinker-playbook-pane__header-actions">
          <Button
            variant="secondary"
            size="s"
            onClick={() => void handlePickInstallFile()}
            disabled={installing}
          >
            {installing ? 'Installing…' : 'Install from file…'}
          </Button>
          <IconButton
            variant="ghost"
            size="s"
            icon={<SettingsIcon />}
            label="Playbook settings"
            onClick={() => setSettingsOpen(true)}
          />
        </div>
      </header>

      <div className="tinker-playbook-pane__toolbar">
        <div className="tinker-playbook-pane__search">
          <SearchInput
            aria-label="Search skills"
            placeholder="Search by title, description, role, or tag"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
        </div>
        {roleOptions.length > 0 ? (
          <div className="tinker-playbook-pane__roles">
            <SegmentedControl<PlaybookRoleFilter>
              value={roleFilter}
              onChange={setRoleFilter}
              options={roleOptions}
              label="Filter by role"
            />
          </div>
        ) : null}
      </div>

      <div className="tinker-playbook-pane__grid-wrap">
        {loading ? (
          <div className="tinker-playbook-pane__grid" data-testid="playbook-skeletons">
            <Skeleton variant="rect" width="100%" height={140} />
            <Skeleton variant="rect" width="100%" height={140} />
            <Skeleton variant="rect" width="100%" height={140} />
          </div>
        ) : filteredSkills.length === 0 ? (
          <EmptyState
            title={skills.length === 0 ? 'Empty bookshelf.' : 'No plays match this search.'}
            description={
              skills.length === 0
                ? 'Install a skill from disk or save a conversation to start your playbook.'
                : 'Try a different search or clear the role filter.'
            }
            action={
              skills.length === 0 ? (
                <Button variant="primary" size="s" onClick={() => void handlePickInstallFile()}>
                  Install from file…
                </Button>
              ) : (
                <Button variant="ghost" size="s" onClick={() => { setFilter(''); setRoleFilter(''); }}>
                  Clear filters
                </Button>
              )
            }
          />
        ) : (
          <div className="tinker-playbook-pane__grid">
            {filteredSkills.map((skill) => (
              <SkillCard
                key={skill.slug}
                skill={skill}
                onPreview={() => setPreviewSkill(skill)}
                onToggleActive={(next) => void handleToggleActive(skill, next)}
                onRequestUninstall={() => setUninstallTarget(skill)}
              />
            ))}
          </div>
        )}
      </div>

      <PreviewModal
        skill={previewSkill}
        onClose={() => setPreviewSkill(null)}
        onToggleActive={(next) => {
          if (previewSkill) {
            void handleToggleActive(previewSkill, next);
            setPreviewSkill(null);
          }
        }}
      />

      <UninstallConfirmModal
        skill={uninstallTarget}
        onClose={() => setUninstallTarget(null)}
        onConfirm={handleConfirmUninstall}
      />

      <PlaybookSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        skillStore={skillStore}
        onSave={handleSaveGitConfig}
        onSyncNow={handleSyncNow}
      />
    </section>
  );
};

type SkillCardProps = {
  readonly skill: Skill;
  readonly onPreview: () => void;
  readonly onToggleActive: (next: boolean) => void;
  readonly onRequestUninstall: () => void;
};

const SkillCard = ({ skill, onPreview, onToggleActive, onRequestUninstall }: SkillCardProps): JSX.Element => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const handleOutside = (event: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [menuOpen]);

  const handleCardKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>): void => {
      // Ignore keys that originate from focusable children (toggle, button,
      // overflow menu) so we don't hijack their native behavior.
      if (event.target !== event.currentTarget) {
        return;
      }

      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onPreview();
        return;
      }

      if (event.key === 'a' || event.key === 'A') {
        event.preventDefault();
        onToggleActive(!skill.active);
        return;
      }

      if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault();
        onRequestUninstall();
      }
    },
    [onPreview, onRequestUninstall, onToggleActive, skill.active],
  );

  const glyph = skill.active ? '\u25C6' : '\u25C7';

  return (
    <article
      className={`tinker-playbook-card${skill.active ? ' tinker-playbook-card--active' : ''}`}
      role="article"
      tabIndex={0}
      aria-label={skill.title}
      aria-current={skill.active ? 'true' : undefined}
      onKeyDown={handleCardKeyDown}
    >
      <header className="tinker-playbook-card__header">
        <h3 className="tinker-playbook-card__title">
          <span
            className="tinker-playbook-card__glyph"
            aria-hidden="true"
          >
            {glyph}
          </span>
          <span className="tinker-playbook-card__title-text">{skill.title}</span>
        </h3>
        <div className="tinker-playbook-card__header-actions">
          {skill.role ? <Badge variant="skill" size="small">{skill.role}</Badge> : null}
          <div className="tinker-playbook-card__menu" ref={menuRef}>
            <IconButton
              variant="ghost"
              size="s"
              icon={<OverflowIcon />}
              label={`More actions for ${skill.title}`}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((prev) => !prev)}
            />
            {menuOpen ? (
              <div className="tinker-playbook-card__menu-popover" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  className="tinker-playbook-card__menu-item tinker-playbook-card__menu-item--danger"
                  onClick={() => {
                    setMenuOpen(false);
                    onRequestUninstall();
                  }}
                >
                  Uninstall…
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>
      {skill.description ? (
        <p className="tinker-playbook-card__description">{skill.description}</p>
      ) : (
        <p className="tinker-playbook-card__description tinker-playbook-card__description--muted">
          No description provided.
        </p>
      )}
      <footer className="tinker-playbook-card__footer">
        <label className="tinker-playbook-card__toggle">
          <Toggle
            checked={skill.active}
            onChange={onToggleActive}
            label={skill.active ? `Disable ${skill.title} in session` : `Enable ${skill.title} in session`}
          />
          <span>{skill.active ? 'In play' : 'Shelved'}</span>
        </label>
        <Button variant="ghost" size="s" onClick={onPreview}>
          Preview
        </Button>
      </footer>
    </article>
  );
};

type PreviewModalProps = {
  readonly skill: Skill | null;
  readonly onClose: () => void;
  readonly onToggleActive: (next: boolean) => void;
};

const PreviewModal = ({ skill, onClose, onToggleActive }: PreviewModalProps): JSX.Element => {
  if (!skill) {
    return (
      <Modal open={false} onClose={onClose} title="Skill preview">
        {null}
      </Modal>
    );
  }

  const meta: string[] = [];
  if (skill.role) meta.push(skill.role);
  if (skill.version) meta.push(`v${skill.version}`);
  if (skill.author) meta.push(skill.author);
  if (skill.tags.length > 0) meta.push(`${skill.tags.length} tag${skill.tags.length === 1 ? '' : 's'}`);
  if (skill.tools.length > 0) meta.push(`${skill.tools.length} tool${skill.tools.length === 1 ? '' : 's'}`);

  return (
    <Modal
      open
      onClose={onClose}
      title={skill.title}
      contentClassName="tinker-playbook-preview-card"
      actions={
        <>
          <Button
            variant="ghost"
            onClick={() => onToggleActive(!skill.active)}
          >
            {skill.active ? 'Shelve' : 'Put in play'}
          </Button>
          <Button variant="primary" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      <div className="tinker-playbook-pane__preview">
        {meta.length > 0 ? (
          <p className="tinker-playbook-pane__preview-meta" aria-label="Skill metadata">
            {meta.join(' · ')}
          </p>
        ) : null}
        {skill.description ? (
          <p className="tinker-playbook-pane__preview-description">{skill.description}</p>
        ) : null}
        <div className="tinker-chat-markdown tinker-playbook-pane__preview-body">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {skill.body.slice(0, MAX_PREVIEW_BODY_LENGTH)}
          </ReactMarkdown>
        </div>
      </div>
    </Modal>
  );
};

type UninstallConfirmModalProps = {
  readonly skill: Skill | null;
  readonly onClose: () => void;
  readonly onConfirm: (skill: Skill) => Promise<void>;
};

const UninstallConfirmModal = ({
  skill,
  onClose,
  onConfirm,
}: UninstallConfirmModalProps): JSX.Element => {
  const inputId = useId();
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!skill) {
      setConfirmation('');
      setBusy(false);
    }
  }, [skill]);

  if (!skill) {
    return (
      <Modal open={false} onClose={onClose} title="Uninstall skill">
        {null}
      </Modal>
    );
  }

  const matches = confirmation.trim() === skill.title.trim();
  const disableConfirm = !matches || busy;

  const handleConfirm = async (): Promise<void> => {
    if (disableConfirm) {
      return;
    }
    setBusy(true);
    await onConfirm(skill);
    setConfirmation('');
    setBusy(false);
  };

  return (
    <Modal
      open
      onClose={busy ? () => undefined : onClose}
      title="Uninstall skill"
      actions={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => void handleConfirm()}
            disabled={disableConfirm}
          >
            {busy ? 'Uninstalling…' : 'Uninstall'}
          </Button>
        </>
      }
    >
      <div className="tinker-playbook-pane__uninstall">
        <p className="tinker-playbook-pane__uninstall-copy">
          This removes <strong>{skill.title}</strong> from your playbook. The
          skill file will be deleted from disk.
        </p>
        <label className="tinker-playbook-pane__uninstall-field" htmlFor={inputId}>
          <span className="tinker-playbook-pane__uninstall-label">
            Type the skill title to confirm
          </span>
          <TextInput
            id={inputId}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder={skill.title}
            aria-label="Confirm skill title"
            autoComplete="off"
          />
        </label>
      </div>
    </Modal>
  );
};
