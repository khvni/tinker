import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import {
  Badge,
  Button,
  SearchInput,
  SegmentedControl,
  TextInput,
  Textarea,
  Toggle,
  type SegmentedControlOption,
} from '@tinker/design';
import { isGitAvailable, syncSkills } from '@tinker/memory';
import type {
  IDockviewPanelProps,
} from 'dockview-react';
import type { Skill, SkillDraft, SkillGitConfig, SkillStore, SkillSyncReport } from '@tinker/shared-types';
import { isValidSkillSlug, slugify } from '@tinker/memory';

type PlaybookParams = {
  skillStore?: SkillStore;
  vaultPath?: string | null;
  initialDraft?: SkillDraft;
  onActiveSkillsChanged?: () => void;
  focus?: 'list' | 'author';
};

type PlaybookProps = IDockviewPanelProps<PlaybookParams>;

type ViewMode = 'browse' | 'author' | 'git';

const EMPTY_DRAFT: SkillDraft = { slug: '', description: '', body: '' };

const emptyGitConfig: SkillGitConfig = { remoteUrl: '', branch: 'main' };

const MODE_OPTIONS: ReadonlyArray<SegmentedControlOption<ViewMode>> = [
  { value: 'browse', label: 'Browse' },
  { value: 'author', label: 'Author' },
  { value: 'git', label: 'Git sync' },
];

const formatTimestamp = (value: string): string => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
};

const stableSort = (skills: Skill[]): Skill[] => {
  return [...skills].sort((left, right) => left.title.localeCompare(right.title));
};

export const Playbook = ({ params }: PlaybookProps): JSX.Element => {
  const skillStore = params?.skillStore;
  const vaultPath = params?.vaultPath ?? null;
  const initialDraft = params?.initialDraft;
  const onActiveSkillsChanged = params?.onActiveSkillsChanged;
  const initialFocus = params?.focus;

  const [skills, setSkills] = useState<Skill[]>([]);
  const [query, setQuery] = useState('');
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [mode, setMode] = useState<ViewMode>(initialFocus === 'author' ? 'author' : 'browse');
  const [draft, setDraft] = useState<SkillDraft>(initialDraft ?? EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gitConfig, setGitConfig] = useState<SkillGitConfig>(emptyGitConfig);
  const [gitAvailable, setGitAvailable] = useState<boolean | null>(null);
  const [syncReport, setSyncReport] = useState<SkillSyncReport | null>(null);

  const refreshSkills = useCallback(async (): Promise<void> => {
    if (!skillStore) {
      setSkills([]);
      return;
    }
    const next = await skillStore.list();
    setSkills(stableSort(next));
  }, [skillStore]);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!skillStore || !vaultPath) {
        return;
      }
      try {
        await skillStore.init(vaultPath);
        await skillStore.reindex();
        if (!active) {
          return;
        }
        await refreshSkills();
        const config = await skillStore.getGitConfig();
        if (!active) {
          return;
        }
        if (config) {
          setGitConfig(config);
        }
        setGitAvailable(await isGitAvailable());
      } catch (nextError) {
        if (active) {
          setError(nextError instanceof Error ? nextError.message : String(nextError));
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [skillStore, vaultPath, refreshSkills]);

  useEffect(() => {
    if (initialDraft) {
      setDraft(initialDraft);
      setMode('author');
    }
  }, [initialDraft]);

  const filteredSkills = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (trimmed.length === 0) {
      return skills;
    }

    return skills.filter((skill) => {
      return (
        skill.title.toLowerCase().includes(trimmed) ||
        skill.description.toLowerCase().includes(trimmed) ||
        skill.tags.some((tag) => tag.toLowerCase().includes(trimmed)) ||
        skill.tools.some((tool) => tool.toLowerCase().includes(trimmed)) ||
        skill.slug.toLowerCase().includes(trimmed)
      );
    });
  }, [skills, query]);

  const selected = useMemo(() => {
    return skills.find((skill) => skill.slug === selectedSlug) ?? null;
  }, [skills, selectedSlug]);

  const guardStore = (): SkillStore => {
    if (!skillStore) {
      throw new Error('Skill store is not ready. Connect a vault first.');
    }
    return skillStore;
  };

  const handleToggleActive = async (skill: Skill): Promise<void> => {
    try {
      setBusy(true);
      setError(null);
      await guardStore().setActive(skill.slug, !skill.active);
      await refreshSkills();
      setStatus(`${skill.title} is now ${!skill.active ? 'active' : 'inactive'}.`);
      onActiveSkillsChanged?.();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setBusy(false);
    }
  };

  const handleUninstall = async (skill: Skill): Promise<void> => {
    if (!window.confirm(`Uninstall ${skill.title}? This deletes the file from your vault.`)) {
      return;
    }
    try {
      setBusy(true);
      setError(null);
      const wasActive = skill.active;
      await guardStore().uninstall(skill.slug);
      await refreshSkills();
      if (selectedSlug === skill.slug) {
        setSelectedSlug(null);
      }
      setStatus(`Uninstalled ${skill.title}.`);
      if (wasActive) {
        onActiveSkillsChanged?.();
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setBusy(false);
    }
  };

  const handleInstallFromFile = async (): Promise<void> => {
    try {
      setBusy(true);
      setError(null);
      const selection = await openDialog({
        multiple: false,
        title: 'Select a SKILL.md file to install',
        filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
      });
      if (typeof selection !== 'string') {
        return;
      }
      const installed = await guardStore().installFromFile(selection);
      await refreshSkills();
      setSelectedSlug(installed.slug);
      setStatus(`Installed ${installed.title}.`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setBusy(false);
    }
  };

  const handleSaveDraft = async (): Promise<void> => {
    try {
      setBusy(true);
      setError(null);
      const slug = isValidSkillSlug(draft.slug) ? draft.slug : slugify(draft.slug);
      if (slug.length === 0) {
        throw new Error('Provide a skill name.');
      }
      if (draft.description.trim().length === 0) {
        throw new Error('Provide a skill description.');
      }

      const saved = await guardStore().installFromDraft({ ...draft, slug });
      await refreshSkills();
      setSelectedSlug(saved.slug);
      setDraft(EMPTY_DRAFT);
      setMode('browse');
      setStatus(`Saved ${saved.title}.`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setBusy(false);
    }
  };

  const handleEditSelected = (): void => {
    if (!selected) {
      return;
    }
    setDraft({
      slug: selected.slug,
      description: selected.description,
      body: selected.body,
      tools: selected.tools,
      tags: selected.tags,
    });
    setMode('author');
  };

  const handleSaveGitConfig = async (): Promise<void> => {
    try {
      setBusy(true);
      setError(null);
      if (gitConfig.remoteUrl.trim().length === 0) {
        await guardStore().setGitConfig(null);
        setStatus('Cleared Git remote.');
        return;
      }
      if (gitConfig.branch.trim().length === 0) {
        throw new Error('Provide a branch name.');
      }
      await guardStore().setGitConfig(gitConfig);
      setStatus('Saved Playbook Git configuration.');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setBusy(false);
    }
  };

  const handleSync = async (): Promise<void> => {
    if (!vaultPath) {
      setError('Connect a vault before syncing.');
      return;
    }
    try {
      setBusy(true);
      setError(null);
      setSyncReport(null);
      if (!(await isGitAvailable())) {
        throw new Error('Git is not available on PATH. Install git and try again.');
      }
      const report = await syncSkills(vaultPath, gitConfig);
      setSyncReport(report);
      await guardStore().reindex();
      await refreshSkills();
      setStatus(`Sync: ${report.message}`);
      if (report.pulled.length > 0) {
        onActiveSkillsChanged?.();
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setBusy(false);
    }
  };

  const activeCount = skills.filter((skill) => skill.active).length;

  if (!vaultPath || !skillStore) {
    return (
      <section className="tinker-pane tinker-playbook">
        <header className="tinker-pane-header">
          <div>
            <p className="tinker-eyebrow">Playbook</p>
            <h2>Connect a vault to open the Playbook</h2>
          </div>
        </header>
        <p className="tinker-muted">Skills live in <code>&lt;vault&gt;/.tinker/skills/</code>. Select or create a vault to get started.</p>
      </section>
    );
  }

  return (
    <section className="tinker-pane tinker-playbook">
      <header className="tinker-pane-header">
        <div>
          <p className="tinker-eyebrow">Playbook</p>
          <h2>Skill marketplace</h2>
        </div>
        <Badge variant="default" size="small">
          {skills.length} installed · {activeCount} active
        </Badge>
      </header>

      <SegmentedControl<ViewMode>
        value={mode}
        onChange={setMode}
        options={MODE_OPTIONS}
        label="Playbook view"
      />

      {status ? <p className="tinker-playbook-status">{status}</p> : null}
      {error ? <p className="tinker-playbook-error">{error}</p> : null}

      {mode === 'browse' ? (
        <div className="tinker-playbook-body">
          <aside className="tinker-playbook-list">
            <div className="tinker-playbook-toolbar">
              <SearchInput
                placeholder="Search skills"
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
              />
              <Button variant="secondary" size="s" onClick={() => void handleInstallFromFile()} disabled={busy}>
                Install from file
              </Button>
            </div>

            {filteredSkills.length === 0 ? (
              <p className="tinker-muted">
                {skills.length === 0
                  ? 'No skills yet. Author a new skill or install one from a .md file.'
                  : 'No skills match that search.'}
              </p>
            ) : null}

            <ul className="tinker-playbook-items">
              {filteredSkills.map((skill) => (
                <li
                  key={skill.slug}
                  className={`tinker-playbook-item ${selectedSlug === skill.slug ? 'tinker-playbook-item--selected' : ''}`}
                >
                  <button
                    type="button"
                    className="tinker-playbook-item-main"
                    onClick={() => setSelectedSlug(skill.slug)}
                  >
                    <div className="tinker-playbook-item-header">
                      <span className="tinker-playbook-item-title">{skill.title}</span>
                      {skill.active ? (
                        <Badge variant="accent" size="small">
                          active
                        </Badge>
                      ) : null}
                    </div>
                    <p className="tinker-playbook-item-description">{skill.description || 'No description.'}</p>
                    {skill.tools.length > 0 ? (
                      <p className="tinker-playbook-item-meta">Tools: {skill.tools.join(', ')}</p>
                    ) : null}
                  </button>
                  <div className="tinker-playbook-item-actions">
                    <Toggle
                      checked={skill.active}
                      onChange={() => void handleToggleActive(skill)}
                      disabled={busy}
                      label={`Toggle ${skill.title} active`}
                    />
                    <Button variant="ghost" size="s" onClick={() => void handleUninstall(skill)} disabled={busy}>
                      Uninstall
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </aside>

          <article className="tinker-playbook-preview">
            {selected ? (
              <>
                <header className="tinker-playbook-preview-header">
                  <div>
                    <p className="tinker-eyebrow">{selected.slug}</p>
                    <h3>{selected.title}</h3>
                    <p className="tinker-muted">Updated {formatTimestamp(selected.lastModified)}</p>
                  </div>
                  <div className="tinker-inline-actions">
                    <Button variant="secondary" size="s" onClick={handleEditSelected}>
                      Edit
                    </Button>
                  </div>
                </header>
                <pre className="tinker-playbook-body-text">{selected.body}</pre>
              </>
            ) : (
              <p className="tinker-muted">Select a skill to preview its instructions.</p>
            )}
          </article>
        </div>
      ) : null}

      {mode === 'author' ? (
        <form
          className="tinker-playbook-author"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSaveDraft();
          }}
        >
          <label className="tinker-field">
            <span>Name (kebab-case slug)</span>
            <TextInput
              required
              value={draft.slug}
              onChange={(event) => setDraft((current) => ({ ...current, slug: event.currentTarget.value }))}
            />
          </label>
          <label className="tinker-field">
            <span>Description</span>
            <TextInput
              required
              value={draft.description}
              onChange={(event) => setDraft((current) => ({ ...current, description: event.currentTarget.value }))}
            />
          </label>
          <label className="tinker-field">
            <span>Tools (comma separated, optional)</span>
            <TextInput
              value={(draft.tools ?? []).join(', ')}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  tools: event.currentTarget.value
                    .split(',')
                    .map((item) => item.trim())
                    .filter(Boolean),
                }))
              }
            />
          </label>
          <label className="tinker-field">
            <span>Tags (comma separated, optional)</span>
            <TextInput
              value={(draft.tags ?? []).join(', ')}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  tags: event.currentTarget.value
                    .split(',')
                    .map((item) => item.trim())
                    .filter(Boolean),
                }))
              }
            />
          </label>
          <label className="tinker-field">
            <span>Skill body (markdown)</span>
            <Textarea
              className="tinker-markdown-editor"
              required
              rows={14}
              value={draft.body}
              onChange={(event) => setDraft((current) => ({ ...current, body: event.currentTarget.value }))}
            />
          </label>
          <div className="tinker-inline-actions">
            <Button variant="primary" type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save skill'}
            </Button>
            <Button variant="ghost" onClick={() => setDraft(EMPTY_DRAFT)}>
              Clear
            </Button>
          </div>
        </form>
      ) : null}

      {mode === 'git' ? (
        <div className="tinker-playbook-git">
          <p className="tinker-muted">
            {gitAvailable === false
              ? 'Git is not on PATH. Install Git to sync skills.'
              : 'Skills sync to <vault>/.tinker/ as a lightweight Git repo. Point it at a team repo and push/pull stays manual via the Sync button.'}
          </p>
          <label className="tinker-field">
            <span>Remote URL</span>
            <TextInput
              value={gitConfig.remoteUrl}
              placeholder="git@github.com:team/playbook.git"
              onChange={(event) => setGitConfig((current) => ({ ...current, remoteUrl: event.currentTarget.value }))}
            />
          </label>
          <label className="tinker-field">
            <span>Branch</span>
            <TextInput
              value={gitConfig.branch}
              onChange={(event) => setGitConfig((current) => ({ ...current, branch: event.currentTarget.value }))}
            />
          </label>
          <label className="tinker-field">
            <span>Author name (optional)</span>
            <TextInput
              value={gitConfig.authorName ?? ''}
              onChange={(event) =>
                setGitConfig((current) => {
                  const { authorName: _prev, ...rest } = current;
                  const next = event.currentTarget.value;
                  return next.length > 0 ? { ...rest, authorName: next } : rest;
                })
              }
            />
          </label>
          <label className="tinker-field">
            <span>Author email (optional)</span>
            <TextInput
              type="email"
              value={gitConfig.authorEmail ?? ''}
              onChange={(event) =>
                setGitConfig((current) => {
                  const { authorEmail: _prev, ...rest } = current;
                  const next = event.currentTarget.value;
                  return next.length > 0 ? { ...rest, authorEmail: next } : rest;
                })
              }
            />
          </label>
          <div className="tinker-inline-actions">
            <Button variant="secondary" onClick={() => void handleSaveGitConfig()} disabled={busy}>
              Save remote
            </Button>
            <Button
              variant="primary"
              onClick={() => void handleSync()}
              disabled={busy || gitConfig.remoteUrl.trim().length === 0}
            >
              {busy ? 'Syncing…' : 'Sync now'}
            </Button>
          </div>

          {syncReport ? (
            <div className="tinker-playbook-sync-report">
              <p>{syncReport.message}</p>
              {syncReport.pulled.length > 0 ? <p>Pulled: {syncReport.pulled.join(', ')}</p> : null}
              {syncReport.pushed.length > 0 ? <p>Pushed: {syncReport.pushed.join(', ')}</p> : null}
              {syncReport.conflicts.length > 0 ? (
                <p className="tinker-playbook-error">Conflicts: {syncReport.conflicts.join(', ')}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
};
