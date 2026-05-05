import type {
  ScheduledJob,
  ScheduledJobRun,
  ScheduledJobRunStatus,
  ScheduledJobStore,
  ScheduledJobTask,
  ScheduledJobTaskKind,
  ScheduledOutputSink,
  ScheduledTodayEntry,
} from '@tinker/shared-types';
import { getDatabase } from './database.js';

type JobRow = {
  id: string;
  name: string;
  prompt: string;
  schedule: string;
  timezone: string;
  output_sinks_json: string;
  enabled: number;
  last_run_at: string | null;
  last_run_status: ScheduledJobRunStatus | null;
  next_run_at: string;
  created_at: string;
  updated_at: string;
  task_kind: string | null;
};

type JobRunRow = {
  id: string;
  job_id: string;
  trigger: 'schedule' | 'manual';
  scheduled_for: string;
  started_at: string;
  finished_at: string;
  status: ScheduledJobRunStatus;
  output_text: string | null;
  error_text: string | null;
  delivered_sinks_json: string;
  skipped_count: number;
};

type TodayEntryRow = JobRunRow & {
  job_name: string;
};

const parseOutputSinks = (raw: string): ScheduledOutputSink[] => {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as ScheduledOutputSink[]) : [];
  } catch {
    return [];
  }
};

const TASK_KINDS: readonly ScheduledJobTaskKind[] = ['prompt', 'memory-sweep'];

const isScheduledTaskKind = (value: string | null): value is ScheduledJobTaskKind => {
  if (value === null) return false;
  return (TASK_KINDS as readonly string[]).includes(value);
};

const hydrateTask = (row: JobRow): ScheduledJobTask => {
  if (isScheduledTaskKind(row.task_kind)) {
    return { kind: row.task_kind };
  }
  return { kind: 'prompt' };
};

const hydrateJob = (row: JobRow): ScheduledJob => {
  return {
    id: row.id,
    name: row.name,
    prompt: row.prompt,
    schedule: row.schedule,
    timezone: row.timezone,
    outputSinks: parseOutputSinks(row.output_sinks_json),
    enabled: row.enabled === 1,
    lastRunAt: row.last_run_at,
    lastRunStatus: row.last_run_status,
    nextRunAt: row.next_run_at,
    task: hydrateTask(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const hydrateRun = (row: JobRunRow): ScheduledJobRun => {
  return {
    id: row.id,
    jobId: row.job_id,
    trigger: row.trigger,
    scheduledFor: row.scheduled_for,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    status: row.status,
    outputText: row.output_text,
    errorText: row.error_text,
    deliveredSinks: parseOutputSinks(row.delivered_sinks_json),
    skippedCount: row.skipped_count,
  };
};

export const createScheduledJobStore = (): ScheduledJobStore => {
  return {
    async listJobs(): Promise<ScheduledJob[]> {
      const database = await getDatabase();
      const rows = await database.select<JobRow[]>(
        `SELECT
           id,
           name,
           prompt,
           schedule,
           timezone,
           output_sinks_json,
           enabled,
           last_run_at,
           last_run_status,
           next_run_at,
           created_at,
           updated_at,
           task_kind
         FROM jobs
         ORDER BY enabled DESC, datetime(next_run_at) ASC, name ASC`,
      );

      return rows.map(hydrateJob);
    },

    async getJob(id: string): Promise<ScheduledJob | null> {
      const database = await getDatabase();
      const rows = await database.select<JobRow[]>(
        `SELECT
           id,
           name,
           prompt,
           schedule,
           timezone,
           output_sinks_json,
           enabled,
           last_run_at,
           last_run_status,
           next_run_at,
           created_at,
           updated_at,
           task_kind
         FROM jobs
         WHERE id = $1
         LIMIT 1`,
        [id],
      );

      const row = rows[0];
      return row ? hydrateJob(row) : null;
    },

    async saveJob(job: ScheduledJob): Promise<void> {
      const database = await getDatabase();

      await database.execute(
        `INSERT INTO jobs (
           id,
           name,
           prompt,
           schedule,
           timezone,
           output_sinks_json,
           enabled,
           last_run_at,
           last_run_status,
           next_run_at,
           created_at,
           updated_at,
           task_kind
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           prompt = excluded.prompt,
           schedule = excluded.schedule,
           timezone = excluded.timezone,
           output_sinks_json = excluded.output_sinks_json,
           enabled = excluded.enabled,
           last_run_at = excluded.last_run_at,
           last_run_status = excluded.last_run_status,
           next_run_at = excluded.next_run_at,
           created_at = excluded.created_at,
           updated_at = excluded.updated_at,
           task_kind = excluded.task_kind`,
        [
          job.id,
          job.name,
          job.prompt,
          job.schedule,
          job.timezone,
          JSON.stringify(job.outputSinks),
          job.enabled ? 1 : 0,
          job.lastRunAt,
          job.lastRunStatus,
          job.nextRunAt,
          job.createdAt,
          job.updatedAt,
          job.task.kind,
        ],
      );
    },

    async deleteJob(id: string): Promise<void> {
      const database = await getDatabase();
      await database.execute('DELETE FROM job_runs WHERE job_id = $1', [id]);
      await database.execute('DELETE FROM jobs WHERE id = $1', [id]);
    },

    async listDueJobs(now: string): Promise<ScheduledJob[]> {
      const database = await getDatabase();
      const rows = await database.select<JobRow[]>(
        `SELECT
           id,
           name,
           prompt,
           schedule,
           timezone,
           output_sinks_json,
           enabled,
           last_run_at,
           last_run_status,
           next_run_at,
           created_at,
           updated_at,
           task_kind
         FROM jobs
         WHERE enabled = 1
           AND datetime(next_run_at) <= datetime($1)
         ORDER BY datetime(next_run_at) ASC`,
        [now],
      );

      return rows.map(hydrateJob);
    },

    async recordRun(run: ScheduledJobRun): Promise<void> {
      const database = await getDatabase();

      await database.execute(
        `INSERT INTO job_runs (
           id,
           job_id,
           trigger,
           scheduled_for,
           started_at,
           finished_at,
           status,
           output_text,
           error_text,
           delivered_sinks_json,
           skipped_count
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          run.id,
          run.jobId,
          run.trigger,
          run.scheduledFor,
          run.startedAt,
          run.finishedAt,
          run.status,
          run.outputText,
          run.errorText,
          JSON.stringify(run.deliveredSinks),
          run.skippedCount,
        ],
      );
    },

    async listRuns(jobId: string, limit = 10): Promise<ScheduledJobRun[]> {
      const database = await getDatabase();
      const rows = await database.select<JobRunRow[]>(
        `SELECT
           id,
           job_id,
           trigger,
           scheduled_for,
           started_at,
           finished_at,
           status,
           output_text,
           error_text,
           delivered_sinks_json,
           skipped_count
         FROM job_runs
         WHERE job_id = $1
         ORDER BY datetime(started_at) DESC
         LIMIT $2`,
        [jobId, limit],
      );

      return rows.map(hydrateRun);
    },

    async listTodayEntries(limit = 6): Promise<ScheduledTodayEntry[]> {
      const database = await getDatabase();
      const rows = await database.select<TodayEntryRow[]>(
        `SELECT
           r.id,
           r.job_id,
           r.trigger,
           r.scheduled_for,
           r.started_at,
           r.finished_at,
           r.status,
           r.output_text,
           r.error_text,
           r.delivered_sinks_json,
           r.skipped_count,
           j.name AS job_name
         FROM job_runs r
         JOIN jobs j ON j.id = r.job_id
         WHERE r.status = 'success'
         ORDER BY datetime(r.finished_at) DESC
         LIMIT 24`,
      );

      const entries: ScheduledTodayEntry[] = [];

      for (const row of rows) {
        const outputText = row.output_text?.trim();
        if (!outputText) {
          continue;
        }

        const todaySink = parseOutputSinks(row.delivered_sinks_json).find((sink) => sink.type === 'today-pane');
        if (!todaySink || todaySink.type !== 'today-pane') {
          continue;
        }

        entries.push({
          runId: row.id,
          jobId: row.job_id,
          jobName: row.job_name,
          section: todaySink.section,
          outputText,
          finishedAt: row.finished_at,
        });

        if (entries.length >= limit) {
          break;
        }
      }

      return entries;
    },
  };
};
