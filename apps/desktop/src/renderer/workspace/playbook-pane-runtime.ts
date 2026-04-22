import { createContext, useContext } from 'react';
import type { SkillStore } from '@tinker/shared-types';

export type PlaybookPaneRuntime = {
  readonly skillStore: SkillStore;
  /**
   * Absolute filesystem root the skill store was initialized against (same
   * value passed to `skillStore.init`). Used by the Git sync flow as the cwd.
   * `null` while the store has not booted yet.
   */
  readonly skillsRootPath: string | null;
  readonly onActiveSkillsChanged: () => void;
};

export const PlaybookPaneRuntimeContext = createContext<PlaybookPaneRuntime | null>(null);

export const usePlaybookPaneRuntime = (): PlaybookPaneRuntime => {
  const runtime = useContext(PlaybookPaneRuntimeContext);
  if (!runtime) {
    throw new Error(
      'Playbook pane runtime is missing. Wrap workspace panes in PlaybookPaneRuntimeContext.Provider.',
    );
  }

  return runtime;
};
