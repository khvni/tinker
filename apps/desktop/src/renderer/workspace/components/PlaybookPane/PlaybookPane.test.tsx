// @vitest-environment jsdom

// @ts-expect-error React uses this flag in tests.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ToastProvider } from '@tinker/design';
import type {
  RoleProfile,
  Skill,
  SkillDraft,
  SkillGitConfig,
  SkillStore,
  SkillSearchResult,
} from '@tinker/shared-types';
import { PlaybookPane } from './PlaybookPane.js';
import {
  derivePlaybookRoleOptions,
  matchesPlaybookFilter,
} from './playbookFilters.js';

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}));

// Silence the CSS import in jsdom.
vi.mock('./PlaybookPane.css', () => ({}));

const makeSkill = (overrides: Partial<Skill> = {}): Skill => ({
  id: overrides.slug ?? 'gong-call-analysis',
  slug: overrides.slug ?? 'gong-call-analysis',
  title: overrides.title ?? 'Gong Call Analysis',
  role: overrides.role ?? 'sales',
  description: overrides.description ?? 'Summarize a Gong transcript.',
  tools: overrides.tools ?? [],
  tags: overrides.tags ?? ['sales'],
  version: overrides.version ?? '1.0.0',
  author: overrides.author ?? null,
  body: overrides.body ?? '# Body\n\nStep 1',
  relativePath: overrides.relativePath ?? '.tinker/skills/gong-call-analysis.md',
  frontmatter: overrides.frontmatter ?? {
    id: overrides.slug ?? 'gong-call-analysis',
    title: overrides.title ?? 'Gong Call Analysis',
    version: overrides.version ?? '1.0.0',
  },
  lastModified: overrides.lastModified ?? '2026-04-22T00:00:00.000Z',
  active: overrides.active ?? false,
  installedAt: overrides.installedAt ?? '2026-04-22T00:00:00.000Z',
  ...overrides,
});

type StubStoreHarness = {
  store: SkillStore;
  activations: Array<{ slug: string; active: boolean }>;
  uninstalled: string[];
};

const createStubSkillStore = (initial: ReadonlyArray<Skill>): StubStoreHarness => {
  const records = new Map<string, Skill>(initial.map((skill) => [skill.slug, skill]));
  const activations: Array<{ slug: string; active: boolean }> = [];
  const uninstalled: string[] = [];

  const store: SkillStore = {
    async init(): Promise<void> {
      return;
    },
    async list(): Promise<Skill[]> {
      return [...records.values()];
    },
    async get(slug: string): Promise<Skill | null> {
      return records.get(slug) ?? null;
    },
    async search(_query: string, _limit?: number): Promise<SkillSearchResult[]> {
      return [];
    },
    async getActive(): Promise<Skill[]> {
      return [...records.values()].filter((skill) => skill.active);
    },
    async getRoleProfile(): Promise<RoleProfile> {
      return { roleLabel: '', connectedTools: [], frequentedSkills: [] };
    },
    async setActive(slug: string, active: boolean): Promise<void> {
      activations.push({ slug, active });
      const existing = records.get(slug);
      if (existing) {
        records.set(slug, { ...existing, active });
      }
    },
    async installFromFile(_path: string): Promise<Skill> {
      throw new Error('not used');
    },
    async installFromDraft(_draft: SkillDraft): Promise<Skill> {
      throw new Error('not used');
    },
    async uninstall(slug: string): Promise<void> {
      uninstalled.push(slug);
      records.delete(slug);
    },
    async reindex(): Promise<{ skillsIndexed: number }> {
      return { skillsIndexed: records.size };
    },
    async getGitConfig(): Promise<SkillGitConfig | null> {
      return null;
    },
    async setGitConfig(_config: SkillGitConfig | null): Promise<void> {
      return;
    },
  };

  return { store, activations, uninstalled };
};

describe('matchesPlaybookFilter', () => {
  const skill = makeSkill({
    title: 'Pull Request Review',
    description: 'Walk through a changeset and leave comments.',
    role: 'engineering',
    tags: ['code-review', 'github'],
  });

  it('matches on empty / whitespace filter', () => {
    expect(matchesPlaybookFilter(skill, '')).toBe(true);
    expect(matchesPlaybookFilter(skill, '   ')).toBe(true);
  });

  it('matches case-insensitively on title', () => {
    expect(matchesPlaybookFilter(skill, 'pull request')).toBe(true);
    expect(matchesPlaybookFilter(skill, 'REQUEST')).toBe(true);
  });

  it('matches on description, role, and tag substrings', () => {
    expect(matchesPlaybookFilter(skill, 'changeset')).toBe(true);
    expect(matchesPlaybookFilter(skill, 'engineer')).toBe(true);
    expect(matchesPlaybookFilter(skill, 'github')).toBe(true);
  });

  it('returns false when no field contains the filter', () => {
    expect(matchesPlaybookFilter(skill, 'zzzzzz')).toBe(false);
  });
});

describe('derivePlaybookRoleOptions', () => {
  it('returns empty array when fewer than 2 distinct roles exist', () => {
    const skills = [makeSkill({ role: 'sales' }), makeSkill({ role: 'sales', slug: 'b' })];
    expect(derivePlaybookRoleOptions(skills)).toEqual([]);
  });

  it('emits an All option + each role when there are multiple', () => {
    const skills = [
      makeSkill({ role: 'sales', slug: 'a' }),
      makeSkill({ role: 'engineering', slug: 'b' }),
    ];
    const options = derivePlaybookRoleOptions(skills);
    expect(options.map((option) => option.value)).toEqual(['', 'engineering', 'sales']);
  });
});

describe('PlaybookPane', () => {
  it('renders the Playbook eyebrow, title, and Install button', () => {
    const { store } = createStubSkillStore([]);
    const markup = renderToStaticMarkup(
      <ToastProvider>
        <PlaybookPane
          runtimeOverride={{
            skillStore: store,
            skillsRootPath: '/memory/google:user-1',
            onActiveSkillsChanged: () => undefined,
          }}
          gitAvailabilityOverride={async () => false}
        />
      </ToastProvider>,
    );

    expect(markup).toContain('Playbook');
    expect(markup).toContain('Skills');
    expect(markup).toContain('Install from file');
  });
});

// ----- DOM-level coverage -----

const flushEffects = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

const fireInput = (element: HTMLInputElement, value: string): void => {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  )?.set;
  if (!setter) throw new Error('no value setter');
  setter.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
};

const findButtonByText = (container: HTMLElement, text: string): HTMLButtonElement | null => {
  for (const btn of Array.from(container.querySelectorAll('button'))) {
    if (btn.textContent?.trim() === text) {
      return btn as HTMLButtonElement;
    }
  }
  return null;
};

const findButtonByLabel = (container: HTMLElement, label: string): HTMLButtonElement | null => {
  return container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
};

describe('PlaybookPane — DOM behavior', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
      await Promise.resolve();
    });
    container.remove();
    vi.clearAllMocks();
  });

  const renderPane = async (harness: StubStoreHarness): Promise<void> => {
    await act(async () => {
      root.render(
        <ToastProvider>
          <PlaybookPane
            runtimeOverride={{
              skillStore: harness.store,
              skillsRootPath: '/memory/google:user-1',
              onActiveSkillsChanged: () => undefined,
            }}
            gitAvailabilityOverride={async () => false}
          />
        </ToastProvider>,
      );
    });
    await flushEffects();
  };

  it('toggling the switch on a card calls skillStore.setActive with the slug + next flag', async () => {
    const skill = makeSkill({ slug: 'pull-request-review', title: 'Pull Request Review', active: false });
    const harness = createStubSkillStore([skill]);

    await renderPane(harness);

    const toggle = container.querySelector<HTMLButtonElement>(
      'button[role="switch"]',
    );
    expect(toggle).not.toBeNull();
    if (!toggle) throw new Error('toggle missing');

    await act(async () => {
      toggle.click();
    });
    await flushEffects();

    expect(harness.activations).toEqual([{ slug: 'pull-request-review', active: true }]);
  });

  it('clicking Preview opens the modal with skill body rendered', async () => {
    const skill = makeSkill({
      slug: 'gong-call-analysis',
      title: 'Gong Call Analysis',
      body: '# Heading\n\nSome **bold** body.',
    });
    const harness = createStubSkillStore([skill]);

    await renderPane(harness);

    const previewBtn = findButtonByText(container, 'Preview');
    if (!previewBtn) throw new Error('Preview button missing');

    await act(async () => {
      previewBtn.click();
    });
    await flushEffects();

    const dialog = document.querySelector<HTMLDivElement>('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent ?? '').toContain('Heading');
    expect(dialog?.textContent ?? '').toContain('bold');

    const closeBtn = findButtonByText(dialog as HTMLElement, 'Close');
    if (!closeBtn) throw new Error('Close button missing');

    await act(async () => {
      closeBtn.click();
    });
    await flushEffects();

    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('uninstall flow requires typing the title before enabling confirm', async () => {
    const skill = makeSkill({
      slug: 'gong-call-analysis',
      title: 'Gong Call Analysis',
    });
    const harness = createStubSkillStore([skill]);

    await renderPane(harness);

    const overflowBtn = findButtonByLabel(container, 'More actions for Gong Call Analysis');
    if (!overflowBtn) throw new Error('overflow button missing');

    await act(async () => {
      overflowBtn.click();
    });
    await flushEffects();

    const uninstallMenuItem = Array.from(container.querySelectorAll('button[role="menuitem"]'))
      .find((el) => el.textContent?.trim() === 'Uninstall…') as HTMLButtonElement | undefined;
    if (!uninstallMenuItem) throw new Error('Uninstall menu item missing');

    await act(async () => {
      uninstallMenuItem.click();
    });
    await flushEffects();

    const dialog = document.querySelector<HTMLDivElement>('[role="dialog"]');
    expect(dialog).not.toBeNull();
    if (!dialog) throw new Error('dialog missing');

    const confirmBtn = findButtonByText(dialog, 'Uninstall');
    if (!confirmBtn) throw new Error('Uninstall confirm button missing');
    expect(confirmBtn.disabled).toBe(true);

    const input = dialog.querySelector<HTMLInputElement>('input[aria-label="Confirm skill title"]');
    if (!input) throw new Error('confirmation input missing');

    // wrong text keeps it disabled
    await act(async () => {
      fireInput(input, 'not the title');
    });
    await flushEffects();
    expect(confirmBtn.disabled).toBe(true);

    // right text enables it
    await act(async () => {
      fireInput(input, 'Gong Call Analysis');
    });
    await flushEffects();
    expect(confirmBtn.disabled).toBe(false);

    await act(async () => {
      confirmBtn.click();
    });
    await flushEffects();

    expect(harness.uninstalled).toEqual(['gong-call-analysis']);
  });

  it('renders the bookshelf empty state + catalog copy when no skills exist', async () => {
    const harness = createStubSkillStore([]);

    await renderPane(harness);

    expect(container.textContent ?? '').toContain('Empty bookshelf.');
    expect(container.textContent ?? '').toContain(
      'Install a skill from disk or save a conversation to start your playbook.',
    );
  });

  it('search filter hides non-matching skills from the grid', async () => {
    const harness = createStubSkillStore([
      makeSkill({ slug: 'a', title: 'Pull Request Review' }),
      makeSkill({ slug: 'b', title: 'Standup Notes' }),
    ]);

    await renderPane(harness);

    expect(container.textContent ?? '').toContain('Pull Request Review');
    expect(container.textContent ?? '').toContain('Standup Notes');

    const search = container.querySelector<HTMLInputElement>('input[aria-label="Search skills"]');
    if (!search) throw new Error('search input missing');

    await act(async () => {
      fireInput(search, 'standup');
    });
    await flushEffects();

    expect(container.textContent ?? '').not.toContain('Pull Request Review');
    expect(container.textContent ?? '').toContain('Standup Notes');
  });
});
