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
  SkillSearchResult,
  SkillStore,
} from '@tinker/shared-types';
import { DEFAULT_SKILL_VERSION } from '@tinker/shared-types';
import { SaveAsSkillModal } from './SaveAsSkillModal.js';

// Silence the CSS import in jsdom.
vi.mock('./SaveAsSkillModal.css', () => ({}));

const makeSkill = (overrides: Partial<Skill> = {}): Skill => ({
  id: overrides.slug ?? 'demo-skill',
  slug: overrides.slug ?? 'demo-skill',
  title: overrides.title ?? 'Demo Skill',
  role: overrides.role ?? null,
  description: overrides.description ?? '',
  tools: overrides.tools ?? [],
  tags: overrides.tags ?? [],
  version: overrides.version ?? '1.0.0',
  author: overrides.author ?? null,
  body: overrides.body ?? '# Body',
  relativePath: overrides.relativePath ?? '.tinker/skills/demo-skill.md',
  frontmatter: overrides.frontmatter ?? {
    id: overrides.slug ?? 'demo-skill',
    title: overrides.title ?? 'Demo Skill',
    version: overrides.version ?? '1.0.0',
  },
  lastModified: overrides.lastModified ?? '2026-04-22T00:00:00.000Z',
  active: overrides.active ?? false,
  installedAt: overrides.installedAt ?? '2026-04-22T00:00:00.000Z',
  ...overrides,
});

type Harness = {
  store: SkillStore;
  installedDrafts: SkillDraft[];
  activations: Array<{ slug: string; active: boolean }>;
};

const createHarness = (): Harness => {
  const installedDrafts: SkillDraft[] = [];
  const activations: Array<{ slug: string; active: boolean }> = [];

  const store: SkillStore = {
    init: () => Promise.resolve(),
    list: () => Promise.resolve([]),
    get: () => Promise.resolve(null),
    search: (): Promise<SkillSearchResult[]> => Promise.resolve([]),
    getActive: () => Promise.resolve([]),
    getRoleProfile: (): Promise<RoleProfile> =>
      Promise.resolve({ roleLabel: '', connectedTools: [], frequentedSkills: [] }),
    setActive: (slug, active) => {
      activations.push({ slug, active });
      return Promise.resolve();
    },
    installFromFile: () => Promise.reject(new Error('not used')),
    installFromDraft: (draft) => {
      installedDrafts.push(draft);
      return Promise.resolve(makeSkill({ slug: draft.slug, title: draft.title ?? draft.slug }));
    },
    uninstall: () => Promise.resolve(),
    reindex: () => Promise.resolve({ skillsIndexed: 0 }),
    getGitConfig: (): Promise<SkillGitConfig | null> => Promise.resolve(null),
    setGitConfig: () => Promise.resolve(),
  };

  return { store, installedDrafts, activations };
};

describe('SaveAsSkillModal', () => {
  it('renders all required fields plus the Activate toggle when open', () => {
    const { store } = createHarness();
    const markup = renderToStaticMarkup(
      <ToastProvider>
        <SaveAsSkillModal
          open
          onClose={() => undefined}
          skillStore={store}
          skillsRootPath={null}
          defaultBody="## User\nHi\n"
          onPublished={() => undefined}
        />
      </ToastProvider>,
    );

    expect(markup).toContain('Save conversation as skill');
    expect(markup).toContain('aria-label="Skill title"');
    expect(markup).toContain('aria-label="Skill role"');
    expect(markup).toContain('aria-label="Skill tags"');
    expect(markup).toContain('aria-label="Skill tools"');
    expect(markup).toContain('aria-label="Skill description"');
    expect(markup).toContain('aria-label="Skill body"');
    expect(markup).toContain('Activate in this session after publish');
    expect(markup).toContain('Publish skill');
  });

  it('initial render disables the Save button because title + slug are empty', () => {
    const { store } = createHarness();
    const markup = renderToStaticMarkup(
      <ToastProvider>
        <SaveAsSkillModal
          open
          onClose={() => undefined}
          skillStore={store}
          skillsRootPath={null}
          defaultBody=""
          onPublished={() => undefined}
        />
      </ToastProvider>,
    );

    // Primary Save button is disabled when the title+body are empty.
    expect(markup).toMatch(/tk-button--primary[^"]*tk-button--disabled[^"]*"\s+disabled/);
    expect(markup).toContain('Publish skill');
  });

  it('does not render the dialog when closed', () => {
    const { store } = createHarness();
    const markup = renderToStaticMarkup(
      <ToastProvider>
        <SaveAsSkillModal
          open={false}
          onClose={() => undefined}
          skillStore={store}
          skillsRootPath={null}
          defaultBody=""
          onPublished={() => undefined}
        />
      </ToastProvider>,
    );

    expect(markup).not.toContain('Save conversation as skill');
  });
});

// ----- DOM submit test -----

const flushEffects = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

const fireInput = (element: HTMLInputElement | HTMLTextAreaElement, value: string): void => {
  const proto =
    element instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (!setter) throw new Error('no value setter');
  setter.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
};

describe('SaveAsSkillModal — DOM submit', () => {
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

  it('invokes installFromDraft once with a slug-ified draft when Save skill is clicked', async () => {
    const { store, installedDrafts } = createHarness();
    const onPublished = vi.fn();

    await act(async () => {
      root.render(
        <ToastProvider>
          <SaveAsSkillModal
            open
            onClose={() => undefined}
            skillStore={store}
            skillsRootPath={null}
            defaultBody=""
            onPublished={onPublished}
          />
        </ToastProvider>,
      );
    });
    await flushEffects();

    const titleInput = container.querySelector<HTMLInputElement>('input[aria-label="Skill title"]');
    const tagsInput = container.querySelector<HTMLInputElement>('input[aria-label="Skill tags"]');
    const bodyTextarea = container.querySelector<HTMLTextAreaElement>(
      'textarea[aria-label="Skill body"]',
    );
    if (!titleInput || !tagsInput || !bodyTextarea) {
      throw new Error('required fields missing');
    }

    await act(async () => {
      fireInput(titleInput, 'Gong Call Analysis');
      fireInput(tagsInput, 'crm, sales , qbr');
      fireInput(bodyTextarea, '# Steps\n\nSummarize the transcript.');
    });
    await flushEffects();

    const saveButton = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent?.trim() === 'Publish skill',
    ) as HTMLButtonElement | undefined;
    if (!saveButton) throw new Error('Save skill button missing');
    expect(saveButton.disabled).toBe(false);

    await act(async () => {
      saveButton.click();
    });
    await flushEffects();

    expect(installedDrafts).toHaveLength(1);
    const draft = installedDrafts[0];
    if (!draft) throw new Error('draft not captured');

    expect(draft.slug).toBe('gong-call-analysis');
    expect(draft.title).toBe('Gong Call Analysis');
    expect(draft.tags).toEqual(['crm', 'sales', 'qbr']);
    expect(draft.version).toBe(DEFAULT_SKILL_VERSION);
    expect(draft.body.trim().length).toBeGreaterThan(0);

    expect(onPublished).toHaveBeenCalledTimes(1);
  });
});
