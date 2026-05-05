import type { OpencodeClient, Part } from '@opencode-ai/sdk/v2/client';
import type { ScheduledJob, ScheduledJobRun, ScheduledJobStore, ScheduledOutputSink, VaultService } from '@tinker/shared-types';
import { countSkippedRuns, getFutureRunAfter } from './schedule.js';

export type MemorySweepTaskRunner = () => Promise<string>;

export type SchedulerEngineOptions = {
  jobStore: ScheduledJobStore;
  vaultService: VaultService | null;
  createClient(): OpencodeClient;
  notify?(payload: { title: string; body: string }): Promise<void> | void;
  onMutation?(): void;
  now?: () => Date;
  pollIntervalMs?: number;
  runGraceMs?: number;
  runMemorySweep?: MemorySweepTaskRunner;
};

export type SchedulerEngine = {
  start(): void;
  stop(): void;
  tick(): Promise<void>;
  runNow(jobId: string): Promise<void>;
};

const DEFAULT_POLL_INTERVAL_MS = 30_000;
const DEFAULT_RUN_GRACE_MS = 90_000;

const runPromptWithClient = async (
  client: OpencodeClient,
  title: string,
  prompt: string,
): Promise<string> => {
  const created = await client.session.create({ title: `Scheduled: ${title}` });
  const session = created.data;
  if (!session) throw new Error('OpenCode did not return a session for scheduled job.');

  const response = await client.session.prompt({
    sessionID: session.id,
    parts: [{ type: 'text', text: prompt }],
  });
  const payload = response.data;
  if (!payload) throw new Error('OpenCode did not return output for scheduled job.');

  const text = payload.parts
    .filter((part: Part): part is Extract<Part, { type: 'text' }> => part.type === 'text')
    .map((part) => part.text)
    .join('')
    .trim();
  return text.length > 0 ? text : 'Run completed without text output.';
};

const getNoteTitleFromPath = (path: string): string => {
  const leaf = path.replace(/\\/gu, '/').split('/').filter(Boolean).at(-1) ?? 'Scheduled Output';
  return leaf.replace(/\.md$/iu, '') || 'Scheduled Output';
};

const formatTimestamp = (value: string): string =>
  new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));

const buildVaultAppendBody = (
  existingBody: string | null,
  path: string,
  jobName: string,
  finishedAt: string,
  outputText: string,
): string => {
  const heading = `# ${getNoteTitleFromPath(path)}`;
  const currentBody = existingBody?.trim();
  const prefix = currentBody && currentBody.length > 0 ? currentBody : heading;
  const section = [`## ${formatTimestamp(finishedAt)} — ${jobName}`, '', outputText.trim()].join('\n');
  return `${prefix}\n\n${section}\n`;
};

const truncateNotificationBody = (value: string): string => {
  const trimmed = value.trim().replace(/\s+/gu, ' ');
  return trimmed.length <= 180 ? trimmed : `${trimmed.slice(0, 177)}...`;
};

const serializeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const runMemorySweepTask = async (options: SchedulerEngineOptions): Promise<string> => {
  if (!options.runMemorySweep) {
    throw new Error('Memory sweep job requires a runMemorySweep handler.');
  }
  return options.runMemorySweep();
};

const runJobTask = async (job: ScheduledJob, options: SchedulerEngineOptions): Promise<string> => {
  switch (job.task.kind) {
    case 'memory-sweep':
      return runMemorySweepTask(options);
    case 'prompt':
      return runPromptWithClient(options.createClient(), job.name, job.prompt);
  }
};

const deliverOutput = async (
  job: ScheduledJob,
  outputText: string,
  finishedAt: string,
  options: SchedulerEngineOptions,
): Promise<{ deliveredSinks: ScheduledOutputSink[]; errors: string[] }> => {
  const deliveredSinks: ScheduledOutputSink[] = [];
  const errors: string[] = [];

  for (const sink of job.outputSinks) {
    try {
      if (sink.type === 'vault-append') {
        if (!options.vaultService) {
          throw new Error(`Vault sink "${sink.path}" requires a connected vault.`);
        }
        const existingNote = await options.vaultService.readNote(sink.path);
        const nextBody = buildVaultAppendBody(existingNote?.body ?? null, sink.path, job.name, finishedAt, outputText);
        await options.vaultService.writeNote(sink.path, existingNote?.frontmatter ?? {}, nextBody);
      } else if (sink.type === 'notification') {
        await options.notify?.({ title: sink.title, body: truncateNotificationBody(outputText) });
      }

      deliveredSinks.push(sink);
    } catch (error) {
      errors.push(`${sink.type}: ${serializeError(error)}`);
    }
  }

  return { deliveredSinks, errors };
};

export const createSchedulerEngine = (options: SchedulerEngineOptions): SchedulerEngine => {
  const now = options.now ?? (() => new Date());
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const runGraceMs = options.runGraceMs ?? DEFAULT_RUN_GRACE_MS;
  const activeJobs = new Set<string>();
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let ticking = false;

  const saveJobAndRun = async (job: ScheduledJob, run: ScheduledJobRun): Promise<void> => {
    await options.jobStore.saveJob(job);
    await options.jobStore.recordRun(run);
    options.onMutation?.();
  };

  const runJob = async (
    job: ScheduledJob,
    trigger: ScheduledJobRun['trigger'],
    scheduledFor: string,
  ): Promise<void> => {
    if (activeJobs.has(job.id)) return;

    activeJobs.add(job.id);
    const startedAt = now().toISOString();
    const nextScheduledRun =
      trigger === 'schedule' ? getFutureRunAfter(job.schedule, job.timezone, new Date(scheduledFor)) : job.nextRunAt;

    try {
      const outputText = await runJobTask(job, options);
      const finishedAt = now().toISOString();
      const delivery = await deliverOutput(job, outputText, finishedAt, options);
      const status = delivery.errors.length === 0 ? 'success' : 'error';
      const updatedJob: ScheduledJob = {
        ...job,
        lastRunAt: finishedAt,
        lastRunStatus: status,
        nextRunAt: nextScheduledRun,
        updatedAt: finishedAt,
      };

      await saveJobAndRun(updatedJob, {
        id: crypto.randomUUID(),
        jobId: job.id,
        trigger,
        scheduledFor,
        startedAt,
        finishedAt,
        status,
        outputText,
        errorText: delivery.errors.length > 0 ? delivery.errors.join('\n') : null,
        deliveredSinks: delivery.deliveredSinks,
        skippedCount: 0,
      });
    } catch (error) {
      const finishedAt = now().toISOString();
      const updatedJob: ScheduledJob = {
        ...job,
        lastRunAt: finishedAt,
        lastRunStatus: 'error',
        nextRunAt: nextScheduledRun,
        updatedAt: finishedAt,
      };

      await saveJobAndRun(updatedJob, {
        id: crypto.randomUUID(),
        jobId: job.id,
        trigger,
        scheduledFor,
        startedAt,
        finishedAt,
        status: 'error',
        outputText: null,
        errorText: serializeError(error),
        deliveredSinks: [],
        skippedCount: 0,
      });
    } finally {
      activeJobs.delete(job.id);
    }
  };

  const skipMissedJob = async (job: ScheduledJob, nowDate: Date): Promise<void> => {
    const startedAt = nowDate.toISOString();
    const skipped = countSkippedRuns(job.schedule, job.timezone, new Date(job.nextRunAt), nowDate);
    const finishedAt = now().toISOString();
    const message = `Skipped ${skipped.skippedCount} missed run${skipped.skippedCount === 1 ? '' : 's'} while Tinker was closed or sleeping.`;
    const updatedJob: ScheduledJob = {
      ...job,
      lastRunAt: finishedAt,
      lastRunStatus: 'skipped',
      nextRunAt: skipped.nextRunAt,
      updatedAt: finishedAt,
    };

    await saveJobAndRun(updatedJob, {
      id: crypto.randomUUID(),
      jobId: job.id,
      trigger: 'schedule',
      scheduledFor: job.nextRunAt,
      startedAt,
      finishedAt,
      status: 'skipped',
      outputText: null,
      errorText: message,
      deliveredSinks: [],
      skippedCount: skipped.skippedCount,
    });
  };

  const tick = async (): Promise<void> => {
    if (ticking) return;
    ticking = true;

    try {
      const nowDate = now();
      const jobs = await options.jobStore.listDueJobs(nowDate.toISOString());

      for (const job of jobs) {
        const lagMs = nowDate.getTime() - new Date(job.nextRunAt).getTime();
        if (lagMs > runGraceMs) {
          await skipMissedJob(job, nowDate);
          continue;
        }
        await runJob(job, 'schedule', job.nextRunAt);
      }
    } finally {
      ticking = false;
    }
  };

  return {
    start(): void {
      if (intervalId !== null) return;
      void tick();
      intervalId = setInterval(() => { void tick(); }, pollIntervalMs);
    },

    stop(): void {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    },

    tick,

    async runNow(jobId: string): Promise<void> {
      const job = await options.jobStore.getJob(jobId);
      if (!job) throw new Error('Scheduled job no longer exists.');
      await runJob(job, 'manual', now().toISOString());
    },
  };
};
