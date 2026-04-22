import type { JSX } from 'react';
import { Button, Toggle } from '@tinker/design';
import type { WorkspacePreferences } from '@tinker/shared-types';
import { useMemoryRootControls } from './useMemoryRootControls.js';
import './MemorySettingsPanel.css';

export type MemorySettingsPanelProps = {
  readonly workspacePreferences: WorkspacePreferences;
  onWorkspacePreferencesChange(nextPreferences: WorkspacePreferences): void;
};

const getProgressPercent = (copiedFiles: number, totalFiles: number): number => {
  if (totalFiles === 0) {
    return 100;
  }

  return Math.min(100, Math.round((copiedFiles / totalFiles) * 100));
};

export const MemorySettingsPanel = ({
  workspacePreferences,
  onWorkspacePreferencesChange,
}: MemorySettingsPanelProps): JSX.Element => {
  const {
    changeMemoryRoot,
    memoryAutoAppendBusy,
    memoryAutoAppendEnabled,
    memoryRoot,
    memoryRootBusy,
    moveProgress,
    notice,
    setMemoryAutoAppendEnabled,
  } = useMemoryRootControls();
  const progressPercent = moveProgress ? getProgressPercent(moveProgress.copiedFiles, moveProgress.totalFiles) : 0;

  return (
    <section className="tk-memory-settings" aria-label="Memory">
      {moveProgress ? (
        <div className="tk-memory-settings__move-backdrop">
          <div className="tk-memory-settings__move-dialog" role="status" aria-live="polite">
            <h3>Updating memory folder</h3>
            <p>Moving markdown memory into new root. Existing files stay untouched until copy finishes.</p>
            <div className="tk-memory-settings__progress" aria-hidden="true">
              <div className="tk-memory-settings__progress-value" style={{ width: `${progressPercent}%` }} />
            </div>
            <p className="tk-memory-settings__move-meta">
              {progressPercent}% complete ({moveProgress.copiedFiles} / {moveProgress.totalFiles} files)
            </p>
            {moveProgress.currentPath ? (
              <p className="tk-memory-settings__move-current">Current file: {moveProgress.currentPath}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      <header className="tk-memory-settings__header">
        <p className="tk-memory-settings__eyebrow">Memory</p>
        <h2 className="tk-memory-settings__title">Storage and capture</h2>
        <p className="tk-memory-settings__lede">
          Keep flat-file memory readable outside app, choose where it lives, control what each chat appends by default.
        </p>
      </header>

      {notice ? (
        <div
          className={`tk-memory-settings__notice tk-memory-settings__notice--${notice.kind}`}
          role={notice.kind === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          {notice.message}
        </div>
      ) : null}

      <div className="tk-memory-settings__stack">
        <article className="tk-memory-settings__card">
          <div className="tk-memory-settings__row">
            <div className="tk-memory-settings__copy">
              <h3>Memory folder</h3>
              <p>
                Desktop-global markdown memory lives here. Tinker creates one subfolder per signed-in user under this root.
              </p>
            </div>
            <Button variant="secondary" onClick={() => void changeMemoryRoot()} disabled={memoryRootBusy}>
              {memoryRootBusy ? 'Moving…' : 'Change location…'}
            </Button>
          </div>
          <div className="tk-memory-settings__path-shell">
            <p className="tk-memory-settings__path-label">Current root</p>
            <p className="tk-memory-settings__path-value" title={memoryRoot ?? 'Resolving memory folder…'}>
              {memoryRoot ?? 'Resolving memory folder…'}
            </p>
          </div>
        </article>

        <article className="tk-memory-settings__card">
          <div className="tk-memory-settings__row">
            <div className="tk-memory-settings__copy">
              <h3>Automatic memory capture</h3>
              <p>
                Append each finished chat exchange to this user&apos;s <code>sessions/</code> memory folder. Tinker writes the raw prompt and final assistant reply verbatim.
              </p>
            </div>
            <Toggle
              checked={memoryAutoAppendEnabled}
              onChange={(next) => {
                void setMemoryAutoAppendEnabled(next);
              }}
              disabled={memoryAutoAppendBusy}
              label="Automatic memory capture"
            />
          </div>
          <p className="tk-memory-settings__state">
            Automatic memory capture: {memoryAutoAppendEnabled ? 'On' : 'Off'}
          </p>
        </article>

        <article className="tk-memory-settings__card">
          <div className="tk-memory-settings__row">
            <div className="tk-memory-settings__copy">
              <h3>Workspace behavior</h3>
              <p>Agent-written files open automatically by default. Turn it off if you want manual review first.</p>
            </div>
            <Toggle
              checked={workspacePreferences.autoOpenAgentWrittenFiles}
              onChange={(next) => {
                onWorkspacePreferencesChange({
                  ...workspacePreferences,
                  autoOpenAgentWrittenFiles: next,
                });
              }}
              label="Auto-open agent-written files"
            />
          </div>
          <p className="tk-memory-settings__state">
            Auto-open agent-written files: {workspacePreferences.autoOpenAgentWrittenFiles ? 'On' : 'Off'}
          </p>
        </article>
      </div>
    </section>
  );
};
