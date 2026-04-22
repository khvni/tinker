import { useEffect, useState, type JSX } from 'react';
import {
  Button,
  Modal,
  Progress,
  TextInput,
} from '@tinker/design';
import type { SkillGitConfig, SkillStore } from '@tinker/shared-types';

const DEFAULT_BRANCH = 'main';

type PlaybookSettingsModalProps = {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly skillStore: SkillStore;
  readonly onSave: (config: SkillGitConfig) => Promise<void>;
  readonly onSyncNow: () => Promise<void>;
};

export const PlaybookSettingsModal = ({
  open,
  onClose,
  skillStore,
  onSave,
  onSyncNow,
}: PlaybookSettingsModalProps): JSX.Element => {
  const [remoteUrl, setRemoteUrl] = useState('');
  const [branch, setBranch] = useState(DEFAULT_BRANCH);
  const [authorName, setAuthorName] = useState('');
  const [authorEmail, setAuthorEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    let active = true;

    void (async () => {
      try {
        const config = await skillStore.getGitConfig();
        if (!active) {
          return;
        }

        setRemoteUrl(config?.remoteUrl ?? '');
        setBranch(config?.branch ?? DEFAULT_BRANCH);
        setAuthorName(config?.authorName ?? '');
        setAuthorEmail(config?.authorEmail ?? '');
        setError(null);
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : String(loadError));
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [open, skillStore]);

  const disableSave = remoteUrl.trim().length === 0 || saving;

  const handleSave = async (): Promise<void> => {
    if (disableSave) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const next: SkillGitConfig = {
        remoteUrl: remoteUrl.trim(),
        branch: branch.trim().length === 0 ? DEFAULT_BRANCH : branch.trim(),
        ...(authorName.trim().length > 0 ? { authorName: authorName.trim() } : {}),
        ...(authorEmail.trim().length > 0 ? { authorEmail: authorEmail.trim() } : {}),
      };

      await onSave(next);
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setSaving(false);
    }
  };

  const handleSyncNow = async (): Promise<void> => {
    setSyncing(true);
    setError(null);
    try {
      await onSyncNow();
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : String(syncError));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Skill sync settings"
      actions={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving || syncing}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void handleSave()} disabled={disableSave}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <div className="tinker-playbook-settings">
        <div>
          <p className="tinker-playbook-settings__section-eyebrow">Remote</p>
          <h3 className="tinker-playbook-settings__section-title">Git mirror</h3>
        </div>

        <div className="tinker-playbook-settings__grid">
          <label className="tinker-playbook-settings__field">
            <span className="tinker-playbook-settings__label">Remote URL</span>
            <TextInput
              value={remoteUrl}
              onChange={(event) => setRemoteUrl(event.target.value)}
              placeholder="git@github.com:you/tinker-skills.git"
              aria-label="Remote URL"
            />
          </label>
          <label className="tinker-playbook-settings__field">
            <span className="tinker-playbook-settings__label">Branch</span>
            <TextInput
              value={branch}
              onChange={(event) => setBranch(event.target.value)}
              placeholder={DEFAULT_BRANCH}
              aria-label="Branch"
            />
          </label>
          <label className="tinker-playbook-settings__field">
            <span className="tinker-playbook-settings__label">Author name (optional)</span>
            <TextInput
              value={authorName}
              onChange={(event) => setAuthorName(event.target.value)}
              placeholder="Tinker"
              aria-label="Author name"
            />
          </label>
          <label className="tinker-playbook-settings__field">
            <span className="tinker-playbook-settings__label">Author email (optional)</span>
            <TextInput
              value={authorEmail}
              onChange={(event) => setAuthorEmail(event.target.value)}
              placeholder="tinker@local"
              aria-label="Author email"
            />
          </label>
        </div>

        <div className="tinker-playbook-settings__sync-row">
          <Button
            variant="secondary"
            onClick={() => void handleSyncNow()}
            disabled={syncing || remoteUrl.trim().length === 0}
            {...(syncing ? { leadingIcon: <Progress variant="spinner" size="sm" /> } : {})}
          >
            {syncing ? 'Syncing…' : 'Sync now'}
          </Button>
        </div>

        {error ? <p className="tinker-playbook-settings__error" role="alert">{error}</p> : null}
      </div>
    </Modal>
  );
};
