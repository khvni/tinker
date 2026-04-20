import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type JSX } from 'react';
import { Badge, Button, TextInput, Textarea } from '@tinker/design';
import { getFutureRunAfter, getSchedulePreview, parseScheduleInput } from '@tinker/scheduler';
import type { ScheduledJob, ScheduledJobRun, ScheduledJobStore, ScheduledOutputSink } from '@tinker/shared-types';

type SchedulerPaneProps = {
  schedulerStore: ScheduledJobStore;
  schedulerRevision: number;
  vaultPath: string | null;
  onRunJobNow(jobId: string): Promise<void>;
  onSchedulerChanged(): void;
};

type SchedulerFormState = {
  id: string | null;
  name: string;
  prompt: string;
  scheduleInput: string;
  enabled: boolean;
  vaultEnabled: boolean;
  vaultPath: string;
  notificationEnabled: boolean;
  notificationTitle: string;
  todayEnabled: boolean;
  todaySection: string;
};

const DEFAULT_SCHEDULE_HINTS = [
  'daily at 8am',
  'every weekday at 8am',
  'monday at 9am',
  '@daily',
] as const;

const createEmptyFormState = (): SchedulerFormState => {
  return {
    id: null,
    name: '',
    prompt: '',
    scheduleInput: 'every weekday at 8am',
    enabled: true,
    vaultEnabled: false,
    vaultPath: 'Today.md',
    notificationEnabled: true,
    notificationTitle: 'Tinker scheduled update',
    todayEnabled: true,
    todaySection: 'Scheduled',
  };
};

const getLocalTimezone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

const describeSinks = (sinks: ScheduledOutputSink[]): string => {
  return sinks
    .map((sink) => {
      if (sink.type === 'vault-append') {
        return `Vault: ${sink.path}`;
      }

      if (sink.type === 'notification') {
        return `Notify: ${sink.title}`;
      }

      return `Today: ${sink.section}`;
    })
    .join(' • ');
};

const toFormState = (job: ScheduledJob): SchedulerFormState => {
  const vaultSink = job.outputSinks.find((sink) => sink.type === 'vault-append');
  const notificationSink = job.outputSinks.find((sink) => sink.type === 'notification');
  const todaySink = job.outputSinks.find((sink) => sink.type === 'today-pane');

  return {
    id: job.id,
    name: job.name,
    prompt: job.prompt,
    scheduleInput: job.schedule,
    enabled: job.enabled,
    vaultEnabled: Boolean(vaultSink),
    vaultPath: vaultSink?.type === 'vault-append' ? vaultSink.path : 'Today.md',
    notificationEnabled: Boolean(notificationSink),
    notificationTitle: notificationSink?.type === 'notification' ? notificationSink.title : 'Tinker scheduled update',
    todayEnabled: Boolean(todaySink),
    todaySection: todaySink?.type === 'today-pane' ? todaySink.section : 'Scheduled',
  };
};

export const SchedulerPane = ({
  schedulerStore,
  schedulerRevision,
  vaultPath,
  onRunJobNow,
  onSchedulerChanged,
}: SchedulerPaneProps): JSX.Element => {
  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [history, setHistory] = useState<ScheduledJobRun[]>([]);
  const [form, setForm] = useState<SchedulerFormState>(createEmptyFormState);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [runBusyJobId, setRunBusyJobId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const timezone = getLocalTimezone();
  const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? null;

  useEffect(() => {
    let active = true;

    void (async () => {
      const nextJobs = await schedulerStore.listJobs();
      if (!active) {
        return;
      }

      setJobs(nextJobs);
      setSelectedJobId((current) => {
        if (current && nextJobs.some((job) => job.id === current)) {
          return current;
        }

        return nextJobs[0]?.id ?? null;
      });
    })();

    return () => {
      active = false;
    };
  }, [schedulerStore, schedulerRevision]);

  useEffect(() => {
    if (!selectedJobId) {
      setHistory([]);
      return;
    }

    let active = true;

    void (async () => {
      const runs = await schedulerStore.listRuns(selectedJobId, 10);
      if (active) {
        setHistory(runs);
      }
    })();

    return () => {
      active = false;
    };
  }, [schedulerStore, schedulerRevision, selectedJobId]);

  const scheduleState = useMemo(() => {
    try {
      const parsed = parseScheduleInput(form.scheduleInput, timezone, new Date());
      return {
        parsed,
        preview: getSchedulePreview(parsed.expression, timezone, new Date()),
        error: null,
      };
    } catch (error) {
      return {
        parsed: null,
        preview: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }, [form.scheduleInput, timezone]);

  const updateForm = (patch: Partial<SchedulerFormState>): void => {
    setForm((current) => ({
      ...current,
      ...patch,
    }));
  };

  const openCreate = (): void => {
    setErrorMessage(null);
    setForm(createEmptyFormState());
    setDialogOpen(true);
  };

  const openEdit = (job: ScheduledJob): void => {
    setErrorMessage(null);
    setForm(toFormState(job));
    setDialogOpen(true);
  };

  const closeDialog = (): void => {
    setDialogOpen(false);
    setErrorMessage(null);
  };

  const toggleEnabled = async (job: ScheduledJob): Promise<void> => {
    const now = new Date();
    const nextRunAt =
      !job.enabled && new Date(job.nextRunAt).getTime() <= now.getTime()
        ? getFutureRunAfter(job.schedule, job.timezone, now)
        : job.nextRunAt;

    await schedulerStore.saveJob({
      ...job,
      enabled: !job.enabled,
      nextRunAt,
      updatedAt: now.toISOString(),
    });
    onSchedulerChanged();
  };

  const deleteJob = async (job: ScheduledJob): Promise<void> => {
    await schedulerStore.deleteJob(job.id);
    onSchedulerChanged();
  };

  const runNow = async (job: ScheduledJob): Promise<void> => {
    setRunBusyJobId(job.id);

    try {
      await onRunJobNow(job.id);
      onSchedulerChanged();
    } finally {
      setRunBusyJobId(null);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setErrorMessage(null);

    if (!scheduleState.parsed) {
      setErrorMessage(scheduleState.error ?? 'Schedule is invalid.');
      return;
    }

    const outputSinks: ScheduledOutputSink[] = [];
    if (form.vaultEnabled) {
      if (!vaultPath) {
        setErrorMessage('Vault sink requires connected vault.');
        return;
      }

      if (form.vaultPath.trim().length === 0) {
        setErrorMessage('Vault path cannot be empty.');
        return;
      }

      outputSinks.push({ type: 'vault-append', path: form.vaultPath.trim() });
    }

    if (form.notificationEnabled) {
      outputSinks.push({
        type: 'notification',
        title: form.notificationTitle.trim() || form.name.trim() || 'Tinker scheduled update',
      });
    }

    if (form.todayEnabled) {
      outputSinks.push({
        type: 'today-pane',
        section: form.todaySection.trim() || 'Scheduled',
      });
    }

    if (outputSinks.length === 0) {
      setErrorMessage('Choose at least one output sink.');
      return;
    }

    if (form.name.trim().length === 0 || form.prompt.trim().length === 0) {
      setErrorMessage('Name and prompt are required.');
      return;
    }

    setSaveBusy(true);

    try {
      const now = new Date();
      const existing = form.id ? await schedulerStore.getJob(form.id) : null;
      const nextRunAt =
        existing &&
        existing.schedule === scheduleState.parsed.expression &&
        new Date(existing.nextRunAt).getTime() > now.getTime()
          ? existing.nextRunAt
          : getFutureRunAfter(scheduleState.parsed.expression, timezone, now);

      await schedulerStore.saveJob({
        id: form.id ?? crypto.randomUUID(),
        name: form.name.trim(),
        prompt: form.prompt.trim(),
        schedule: scheduleState.parsed.expression,
        timezone,
        outputSinks,
        enabled: form.enabled,
        lastRunAt: existing?.lastRunAt ?? null,
        lastRunStatus: existing?.lastRunStatus ?? null,
        nextRunAt,
        createdAt: existing?.createdAt ?? now.toISOString(),
        updatedAt: now.toISOString(),
      });

      closeDialog();
      onSchedulerChanged();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setSaveBusy(false);
    }
  };

  const onTextChange =
    (field: keyof SchedulerFormState) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
      updateForm({ [field]: event.currentTarget.value } as Partial<SchedulerFormState>);
    };

  return (
    <section className="tinker-pane">
      <header className="tinker-pane-header">
        <div>
          <p className="tinker-eyebrow">Scheduler</p>
          <h2>Run prompts while Tinker stays open</h2>
        </div>
        <div className="tinker-inline-actions">
          <Badge variant="default" size="small">
            Jobs fire only while app open
          </Badge>
          <Button variant="primary" onClick={openCreate}>
            Create scheduled prompt
          </Button>
        </div>
      </header>

      <div className="tinker-scheduler-grid">
        <div className="tinker-list tinker-scheduler-list">
          {jobs.length === 0 ? (
            <article className="tinker-list-item">
              <h3>No scheduled prompts yet</h3>
              <p className="tinker-muted">Create daily standups, Monday planning, or quiet recurring research.</p>
            </article>
          ) : null}

          {jobs.map((job) => (
            <article
              key={job.id}
              className={`tinker-list-item tinker-job-card ${job.id === selectedJobId ? 'tinker-job-card--selected' : ''}`}
            >
              <button className="tinker-job-select" type="button" onClick={() => setSelectedJobId(job.id)}>
                <div>
                  <h3>{job.name}</h3>
                  <p className="tinker-muted">
                    {job.enabled ? 'Enabled' : 'Paused'} • Next {new Date(job.nextRunAt).toLocaleString()}
                  </p>
                  <p className="tinker-muted">{describeSinks(job.outputSinks)}</p>
                </div>
              </button>

              <div className="tinker-inline-actions">
                <Button variant="secondary" size="s" onClick={() => void toggleEnabled(job)}>
                  {job.enabled ? 'Disable' : 'Enable'}
                </Button>
                <Button variant="secondary" size="s" onClick={() => openEdit(job)}>
                  Edit
                </Button>
                <Button
                  variant="secondary"
                  size="s"
                  onClick={() => void runNow(job)}
                  disabled={runBusyJobId === job.id}
                >
                  {runBusyJobId === job.id ? 'Running…' : 'Run now'}
                </Button>
                <Button variant="ghost" size="s" onClick={() => void deleteJob(job)}>
                  Delete
                </Button>
              </div>
            </article>
          ))}
        </div>

        <div className="tinker-list tinker-scheduler-history">
          <article className="tinker-list-item">
            <h3>{selectedJob ? selectedJob.name : 'Select scheduled prompt'}</h3>
            <p className="tinker-muted">
              {selectedJob
                ? `${selectedJob.schedule} • ${selectedJob.timezone} • last status ${selectedJob.lastRunStatus ?? 'never run'}`
                : 'Pick job to inspect last 10 runs.'}
            </p>
          </article>

          {selectedJob && history.length === 0 ? (
            <article className="tinker-list-item">
              <h3>No history yet</h3>
              <p className="tinker-muted">First run lands here with success, error, or skipped state.</p>
            </article>
          ) : null}

          {history.map((run) => (
            <article key={run.id} className="tinker-list-item">
              <h3>
                {run.status} • {new Date(run.finishedAt).toLocaleString()}
              </h3>
              <p className="tinker-muted">
                {run.trigger} trigger • scheduled for {new Date(run.scheduledFor).toLocaleString()}
              </p>
              {run.errorText ? <p className="tinker-muted">{run.errorText}</p> : null}
              {run.outputText ? <p className="tinker-today-output">{run.outputText}</p> : null}
            </article>
          ))}
        </div>
      </div>

      {dialogOpen ? (
        <div className="tinker-modal-backdrop" role="presentation" onClick={closeDialog}>
          <section className="tinker-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <header className="tinker-pane-header">
              <div>
                <p className="tinker-eyebrow">{form.id ? 'Edit job' : 'Create job'}</p>
                <h2>Scheduled prompt</h2>
              </div>
              <Button variant="ghost" size="s" onClick={closeDialog}>
                Close
              </Button>
            </header>

            <form className="tinker-form" onSubmit={(event) => void handleSubmit(event)}>
              <label className="tinker-field">
                <span>Name</span>
                <TextInput value={form.name} onChange={onTextChange('name')} placeholder="Daily standup summary" />
              </label>

              <label className="tinker-field">
                <span>Prompt</span>
                <Textarea
                  className="tinker-markdown-editor"
                  value={form.prompt}
                  onChange={onTextChange('prompt')}
                  placeholder="Summarize yesterday's calendar and unread email. Append concise summary."
                />
              </label>

              <label className="tinker-field">
                <span>Schedule</span>
                <TextInput
                  value={form.scheduleInput}
                  onChange={onTextChange('scheduleInput')}
                  placeholder="every weekday at 8am or 0 8 * * 1-5"
                />
              </label>

              <div className="tinker-inline-actions">
                {DEFAULT_SCHEDULE_HINTS.map((hint) => (
                  <Button key={hint} variant="ghost" size="s" onClick={() => updateForm({ scheduleInput: hint })}>
                    {hint}
                  </Button>
                ))}
              </div>

              <div className="tinker-list-item">
                <h3>Preview</h3>
                <p className="tinker-muted">
                  {scheduleState.error ? scheduleState.error : `Next run ${scheduleState.preview} (${timezone})`}
                </p>
              </div>

              <div className="tinker-field-grid">
                <label className="tinker-check">
                  <input
                    type="checkbox"
                    checked={form.todayEnabled}
                    onChange={(event) => updateForm({ todayEnabled: event.currentTarget.checked })}
                  />
                  <span>Today pane sink</span>
                </label>

                {form.todayEnabled ? (
                  <label className="tinker-field">
                    <span>Today section</span>
                    <TextInput value={form.todaySection} onChange={onTextChange('todaySection')} placeholder="Scheduled" />
                  </label>
                ) : null}

                <label className="tinker-check">
                  <input
                    type="checkbox"
                    checked={form.notificationEnabled}
                    onChange={(event) => updateForm({ notificationEnabled: event.currentTarget.checked })}
                  />
                  <span>Desktop notification</span>
                </label>

                {form.notificationEnabled ? (
                  <label className="tinker-field">
                    <span>Notification title</span>
                    <TextInput value={form.notificationTitle} onChange={onTextChange('notificationTitle')} placeholder="Tinker update" />
                  </label>
                ) : null}

                <label className="tinker-check">
                  <input
                    type="checkbox"
                    checked={form.vaultEnabled}
                    onChange={(event) => updateForm({ vaultEnabled: event.currentTarget.checked })}
                  />
                  <span>Append to vault</span>
                </label>

                {form.vaultEnabled ? (
                  <label className="tinker-field">
                    <span>Vault note path</span>
                    <TextInput value={form.vaultPath} onChange={onTextChange('vaultPath')} placeholder="Daily/Standup.md" />
                  </label>
                ) : null}
              </div>

              <label className="tinker-check">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(event) => updateForm({ enabled: event.currentTarget.checked })}
                />
                <span>Enabled after save</span>
              </label>

              {errorMessage ? <p className="tinker-muted">{errorMessage}</p> : null}

              <div className="tinker-inline-actions">
                <Button variant="primary" type="submit" disabled={saveBusy}>
                  {saveBusy ? 'Saving…' : form.id ? 'Save changes' : 'Create job'}
                </Button>
                <Button variant="secondary" onClick={closeDialog} disabled={saveBusy}>
                  Cancel
                </Button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </section>
  );
};
