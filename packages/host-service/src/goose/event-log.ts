import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { GooseRunConfig, GooseRunEvent, GooseRunStatus, GooseRunSummary } from './types.js';

const RUN_FILE_SUFFIX = '.jsonl';
const META_FILE_SUFFIX = '.meta.json';

type RunMeta = {
  runId: string;
  config: GooseRunConfig;
  createdAt: string;
};

const isRunMeta = (value: unknown): value is RunMeta => {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['runId'] === 'string' &&
    typeof v['createdAt'] === 'string' &&
    typeof v['config'] === 'object' &&
    v['config'] !== null
  );
};

const isGooseRunEvent = (value: unknown): value is GooseRunEvent => {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['type'] === 'string' &&
    typeof v['runId'] === 'string' &&
    typeof v['timestamp'] === 'string'
  );
};

export type RunEventLog = {
  init(runId: string, config: GooseRunConfig): void;
  append(runId: string, event: GooseRunEvent): void;
  replay(runId: string): GooseRunEvent[];
  summary(runId: string): GooseRunSummary | null;
  list(): GooseRunSummary[];
};

export const createRunEventLog = (runsDir: string): RunEventLog => {
  mkdirSync(runsDir, { recursive: true });

  const eventsPath = (runId: string): string => join(runsDir, `${runId}${RUN_FILE_SUFFIX}`);
  const metaPath = (runId: string): string => join(runsDir, `${runId}${META_FILE_SUFFIX}`);

  const readMeta = (runId: string): RunMeta | null => {
    const p = metaPath(runId);
    if (!existsSync(p)) return null;
    try {
      const parsed: unknown = JSON.parse(readFileSync(p, 'utf8'));
      return isRunMeta(parsed) ? parsed : null;
    } catch {
      return null;
    }
  };

  const readEvents = (runId: string): GooseRunEvent[] => {
    const p = eventsPath(runId);
    if (!existsSync(p)) return [];
    const lines = readFileSync(p, 'utf8').split('\n').filter((l) => l.length > 0);
    const events: GooseRunEvent[] = [];
    for (const line of lines) {
      try {
        const parsed: unknown = JSON.parse(line);
        if (isGooseRunEvent(parsed)) {
          events.push(parsed);
        }
      } catch {
        // skip malformed lines
      }
    }
    return events;
  };

  const deriveStatus = (events: GooseRunEvent[]): GooseRunStatus => {
    for (let i = events.length - 1; i >= 0; i--) {
      const event = events[i];
      if (event !== undefined && event.type === 'status') {
        return event.status;
      }
    }
    return 'queued';
  };

  const deriveFinishedAt = (events: GooseRunEvent[], status: GooseRunStatus): string | null => {
    if (status !== 'completed' && status !== 'failed' && status !== 'aborted') {
      return null;
    }
    const last = events[events.length - 1];
    return last !== undefined ? last.timestamp : null;
  };

  return {
    init(runId, config) {
      const meta: RunMeta = { runId, config, createdAt: new Date().toISOString() };
      mkdirSync(runsDir, { recursive: true });
      appendFileSync(metaPath(runId), `${JSON.stringify(meta)}\n`, 'utf8');
    },

    append(runId, event) {
      appendFileSync(eventsPath(runId), `${JSON.stringify(event)}\n`, 'utf8');
    },

    replay(runId) {
      return readEvents(runId);
    },

    summary(runId) {
      const meta = readMeta(runId);
      if (meta === null) return null;

      const events = readEvents(runId);
      const status = deriveStatus(events);

      return {
        runId: meta.runId,
        status,
        config: meta.config,
        createdAt: meta.createdAt,
        finishedAt: deriveFinishedAt(events, status),
        eventCount: events.length,
      };
    },

    list() {
      if (!existsSync(runsDir)) return [];

      const files = readdirSync(runsDir).filter((f) => f.endsWith(META_FILE_SUFFIX));
      const summaries: GooseRunSummary[] = [];

      for (const file of files) {
        const runId = file.slice(0, -META_FILE_SUFFIX.length);
        const s = this.summary(runId);
        if (s !== null) {
          summaries.push(s);
        }
      }

      return summaries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
  };
};
