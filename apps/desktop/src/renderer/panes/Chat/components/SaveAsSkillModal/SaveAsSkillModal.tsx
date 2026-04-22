import { useEffect, useMemo, useState, type JSX } from 'react';
import {
  Button,
  Modal,
  Progress,
  TextInput,
  Textarea,
  Toggle,
  useToast,
} from '@tinker/design';
import { isValidSkillSlug, slugify } from '@tinker/memory';
import {
  DEFAULT_SKILL_VERSION,
  type SkillDraft,
  type SkillStore,
} from '@tinker/shared-types';
import { runSkillAutoSync } from '../../../../workspace/skill-auto-sync.js';
import './SaveAsSkillModal.css';

type SaveAsSkillModalProps = {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly skillStore: SkillStore;
  readonly skillsRootPath: string | null;
  readonly defaultBody: string;
  readonly onPublished: () => void;
};

const splitCommaList = (value: string): string[] => {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

export const SaveAsSkillModal = ({
  open,
  onClose,
  skillStore,
  skillsRootPath,
  defaultBody,
  onPublished,
}: SaveAsSkillModalProps): JSX.Element => {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [role, setRole] = useState('');
  const [tags, setTags] = useState('');
  const [tools, setTools] = useState('');
  const [description, setDescription] = useState('');
  const [body, setBody] = useState(defaultBody);
  const [activate, setActivate] = useState(false);
  const [saving, setSaving] = useState(false);

  // When the modal opens, re-seed the body textarea with the fresh transcript
  // so stale prior text doesn't survive across re-opens.
  useEffect(() => {
    if (!open) {
      return;
    }

    setTitle('');
    setRole('');
    setTags('');
    setTools('');
    setDescription('');
    setBody(defaultBody);
    setActivate(false);
    setSaving(false);
  }, [defaultBody, open]);

  const computedSlug = useMemo(() => slugify(title), [title]);
  const slugLooksValid = title.trim().length > 0 && isValidSkillSlug(computedSlug);
  const disableSubmit =
    saving
    || title.trim().length === 0
    || body.trim().length === 0
    || !slugLooksValid;

  const handleSubmit = async (): Promise<void> => {
    if (disableSubmit) {
      return;
    }

    setSaving(true);

    try {
      const draft: SkillDraft = {
        slug: computedSlug,
        title: title.trim(),
        description: description.trim(),
        body: body.trim(),
        version: DEFAULT_SKILL_VERSION,
        ...(role.trim().length > 0 ? { role: role.trim() } : {}),
        ...(tools.trim().length > 0 ? { tools: splitCommaList(tools) } : {}),
        ...(tags.trim().length > 0 ? { tags: splitCommaList(tags) } : {}),
      };

      const saved = await skillStore.installFromDraft(draft);

      if (activate) {
        await skillStore.setActive(saved.slug, true);
      }

      onPublished();

      try {
        await runSkillAutoSync({
          skillStore,
          skillsRootPath,
        });
      } catch (syncError) {
        toast.show({
          title: 'Skill saved, git sync failed',
          description: syncError instanceof Error ? syncError.message : String(syncError),
          variant: 'warning',
        });
      }

      toast.show({
        title: `Saved ${saved.title}`,
        description: activate ? 'Skill is active in this session.' : 'Enable it in the Playbook when ready.',
        variant: 'success',
      });

      onClose();
    } catch (error) {
      toast.show({
        title: 'Could not save skill',
        description: error instanceof Error ? error.message : String(error),
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Save conversation as skill"
      actions={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => void handleSubmit()}
            disabled={disableSubmit}
            {...(saving ? { leadingIcon: <Progress variant="spinner" size="sm" /> } : {})}
          >
            {saving ? 'Publishing…' : 'Publish skill'}
          </Button>
        </>
      }
    >
      <form
        className="tinker-save-skill-modal"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <label className="tinker-save-skill-modal__field">
          <span className="tinker-save-skill-modal__label">Title</span>
          <TextInput
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Gong Call Analysis"
            aria-label="Skill title"
            required
          />
          <span
            className="tinker-save-skill-modal__slug"
            aria-live="polite"
          >
            <span aria-hidden="true" className="tinker-save-skill-modal__slug-arrow">→</span>
            <code className="tinker-save-skill-modal__slug-value">
              {slugLooksValid ? computedSlug : '—'}
            </code>
          </span>
        </label>

        <label className="tinker-save-skill-modal__field">
          <span className="tinker-save-skill-modal__label">Role (optional)</span>
          <TextInput
            value={role}
            onChange={(event) => setRole(event.target.value)}
            placeholder="sales"
            aria-label="Skill role"
          />
        </label>

        <label className="tinker-save-skill-modal__field">
          <span className="tinker-save-skill-modal__label">Tags (comma-separated)</span>
          <TextInput
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="crm, sales, qbr"
            aria-label="Skill tags"
          />
        </label>

        <label className="tinker-save-skill-modal__field">
          <span className="tinker-save-skill-modal__label">Tools (comma-separated)</span>
          <TextInput
            value={tools}
            onChange={(event) => setTools(event.target.value)}
            placeholder="gong, slack"
            aria-label="Skill tools"
          />
        </label>

        <label className="tinker-save-skill-modal__field">
          <span className="tinker-save-skill-modal__label">Description (optional)</span>
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Short summary for the Playbook card."
            rows={2}
            resize="none"
            aria-label="Skill description"
          />
        </label>

        <label className="tinker-save-skill-modal__field">
          <span className="tinker-save-skill-modal__label">Body</span>
          <Textarea
            className="tinker-save-skill-modal__body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={10}
            resize="vertical"
            aria-label="Skill body"
            required
          />
        </label>

        <label className="tinker-save-skill-modal__toggle">
          <Toggle
            checked={activate}
            onChange={setActivate}
            label={activate ? 'Disable activate-immediately' : 'Enable activate-immediately'}
          />
          <span>Activate in this session after publish</span>
        </label>
      </form>
    </Modal>
  );
};
