// @vitest-environment jsdom

// @ts-expect-error React uses this flag in tests.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@tinker/design';
import type {
  RoleProfile,
  Skill,
  SkillDraft,
  SkillGitConfig,
  SkillSearchResult,
  SkillStore,
} from '@tinker/shared-types';
import { PlaybookSettingsModal } from './PlaybookSettingsModal.js';

type Harness = {
  store: SkillStore;
  saved: SkillGitConfig[];
  initialConfig: SkillGitConfig | null;
};

const createHarness = (initialConfig: SkillGitConfig | null = null): Harness => {
  const saved: SkillGitConfig[] = [];

  const store: SkillStore = {
    init: () => Promise.resolve(),
    list: () => Promise.resolve([]),
    get: () => Promise.resolve(null),
    search: (): Promise<SkillSearchResult[]> => Promise.resolve([]),
    getActive: () => Promise.resolve([]),
    getRoleProfile: (): Promise<RoleProfile> =>
      Promise.resolve({ roleLabel: '', connectedTools: [], frequentedSkills: [] }),
    setActive: () => Promise.resolve(),
    installFromFile: () => Promise.reject(new Error('not used')),
    installFromDraft: (_draft: SkillDraft): Promise<Skill> => Promise.reject(new Error('not used')),
    uninstall: () => Promise.resolve(),
    reindex: () => Promise.resolve({ skillsIndexed: 0 }),
    getGitConfig: () => Promise.resolve(initialConfig),
    setGitConfig: (config) => {
      if (config) {
        saved.push(config);
      }
      return Promise.resolve();
    },
  };

  return { store, saved, initialConfig };
};

const flushEffects = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

const fireInput = (input: HTMLInputElement, value: string): void => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  if (!setter) throw new Error('no value setter');
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

describe('<PlaybookSettingsModal>', () => {
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

  it('loads the current git config into the fields when opened', async () => {
    const { store } = createHarness({
      remoteUrl: 'git@github.com:you/tinker-skills.git',
      branch: 'mainline',
      authorName: 'Alice',
      authorEmail: 'alice@example.com',
    });

    await act(async () => {
      root.render(
        <ToastProvider>
          <PlaybookSettingsModal
            open
            onClose={() => undefined}
            skillStore={store}
            onSave={() => Promise.resolve()}
            onSyncNow={() => Promise.resolve()}
          />
        </ToastProvider>,
      );
    });
    await flushEffects();

    const inputs = Array.from(container.querySelectorAll('input')) as HTMLInputElement[];
    const [remote, branch, author, email] = inputs;
    if (!remote || !branch || !author || !email) {
      throw new Error('expected four text inputs');
    }

    expect(remote.value).toBe('git@github.com:you/tinker-skills.git');
    expect(branch.value).toBe('mainline');
    expect(author.value).toBe('Alice');
    expect(email.value).toBe('alice@example.com');
  });

  it('disables Save when the remoteUrl field is empty', async () => {
    const { store } = createHarness(null);

    await act(async () => {
      root.render(
        <ToastProvider>
          <PlaybookSettingsModal
            open
            onClose={() => undefined}
            skillStore={store}
            onSave={() => Promise.resolve()}
            onSyncNow={() => Promise.resolve()}
          />
        </ToastProvider>,
      );
    });
    await flushEffects();

    const saveButton = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent?.trim() === 'Save',
    ) as HTMLButtonElement | undefined;
    if (!saveButton) throw new Error('Save button missing');
    expect(saveButton.disabled).toBe(true);
  });

  it('calls onSave with a trimmed config when Save is clicked', async () => {
    const { store } = createHarness(null);
    const onSave = vi.fn<(config: SkillGitConfig) => Promise<void>>(() => Promise.resolve());

    await act(async () => {
      root.render(
        <ToastProvider>
          <PlaybookSettingsModal
            open
            onClose={() => undefined}
            skillStore={store}
            onSave={onSave}
            onSyncNow={() => Promise.resolve()}
          />
        </ToastProvider>,
      );
    });
    await flushEffects();

    const inputs = Array.from(container.querySelectorAll('input')) as HTMLInputElement[];
    const [remote, branch, author, email] = inputs;
    if (!remote || !branch || !author || !email) throw new Error('inputs missing');

    await act(async () => {
      fireInput(remote, '  git@github.com:you/tinker-skills.git  ');
      fireInput(branch, '  develop  ');
      fireInput(author, '  Alice  ');
      fireInput(email, '  alice@example.com  ');
    });
    await flushEffects();

    const saveButton = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent?.trim() === 'Save',
    ) as HTMLButtonElement | undefined;
    if (!saveButton) throw new Error('Save button missing');
    expect(saveButton.disabled).toBe(false);

    await act(async () => {
      saveButton.click();
    });
    await flushEffects();

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({
      remoteUrl: 'git@github.com:you/tinker-skills.git',
      branch: 'develop',
      authorName: 'Alice',
      authorEmail: 'alice@example.com',
    });
  });

  it('calls onClose when Cancel is clicked', async () => {
    const { store } = createHarness(null);
    const onClose = vi.fn();

    await act(async () => {
      root.render(
        <ToastProvider>
          <PlaybookSettingsModal
            open
            onClose={onClose}
            skillStore={store}
            onSave={() => Promise.resolve()}
            onSyncNow={() => Promise.resolve()}
          />
        </ToastProvider>,
      );
    });
    await flushEffects();

    const cancelButton = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent?.trim() === 'Cancel',
    ) as HTMLButtonElement | undefined;
    if (!cancelButton) throw new Error('Cancel button missing');

    await act(async () => {
      cancelButton.click();
    });
    await flushEffects();

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('invokes onSyncNow when Sync now is clicked', async () => {
    const { store } = createHarness({
      remoteUrl: 'git@github.com:you/tinker-skills.git',
      branch: 'main',
    });
    const onSyncNow = vi.fn(() => Promise.resolve());

    await act(async () => {
      root.render(
        <ToastProvider>
          <PlaybookSettingsModal
            open
            onClose={() => undefined}
            skillStore={store}
            onSave={() => Promise.resolve()}
            onSyncNow={onSyncNow}
          />
        </ToastProvider>,
      );
    });
    await flushEffects();

    const syncButton = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent?.trim() === 'Sync now',
    ) as HTMLButtonElement | undefined;
    if (!syncButton) throw new Error('Sync now button missing');

    await act(async () => {
      syncButton.click();
    });
    await flushEffects();

    expect(onSyncNow).toHaveBeenCalledTimes(1);
  });

  it('surfaces onSyncNow errors inline instead of throwing', async () => {
    const { store } = createHarness({
      remoteUrl: 'git@github.com:you/tinker-skills.git',
      branch: 'main',
    });
    const onSyncNow = vi.fn(() => Promise.reject(new Error('No git remote configured')));

    await act(async () => {
      root.render(
        <ToastProvider>
          <PlaybookSettingsModal
            open
            onClose={() => undefined}
            skillStore={store}
            onSave={() => Promise.resolve()}
            onSyncNow={onSyncNow}
          />
        </ToastProvider>,
      );
    });
    await flushEffects();

    const syncButton = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent?.trim() === 'Sync now',
    ) as HTMLButtonElement | undefined;
    if (!syncButton) throw new Error('Sync now button missing');

    await act(async () => {
      syncButton.click();
    });
    await flushEffects();

    expect(onSyncNow).toHaveBeenCalledTimes(1);
    const errorText = container.querySelector('.tinker-playbook-settings__error');
    expect(errorText?.textContent).toContain('No git remote configured');
  });
});
