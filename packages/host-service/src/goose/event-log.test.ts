import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { GooseRunConfig, GooseRunEvent } from './types.js';
import { createRunEventLog, type RunEventLog } from './event-log.js';

const makeConfig = (): GooseRunConfig => ({
  cwd: '/tmp/test-project',
  prompt: 'fix the tests',
  mode: null,
});

const makeTextEvent = (runId: string, content: string): GooseRunEvent => ({
  type: 'text',
  runId,
  content,
  stream: 'stdout',
  timestamp: new Date().toISOString(),
});

const makeStatusEvent = (runId: string, status: 'queued' | 'running' | 'completed' | 'failed' | 'aborted'): GooseRunEvent => ({
  type: 'status',
  runId,
  status,
  timestamp: new Date().toISOString(),
});

describe('createRunEventLog', () => {
  let scratch: string;
  let log: RunEventLog;

  beforeEach(() => {
    scratch = mkdtempSync(join(tmpdir(), 'tinker-event-log-'));
    log = createRunEventLog(scratch);
  });

  afterEach(() => {
    rmSync(scratch, { recursive: true, force: true });
  });

  it('initializes a run and returns an empty replay', () => {
    log.init('run-1', makeConfig());
    const events = log.replay('run-1');
    expect(events).toEqual([]);
  });

  it('appends and replays events in order', () => {
    const config = makeConfig();
    log.init('run-1', config);

    log.append('run-1', makeStatusEvent('run-1', 'queued'));
    log.append('run-1', makeStatusEvent('run-1', 'running'));
    log.append('run-1', makeTextEvent('run-1', 'hello'));
    log.append('run-1', makeStatusEvent('run-1', 'completed'));

    const events = log.replay('run-1');
    expect(events).toHaveLength(4);
    expect(events[0]?.type).toBe('status');
    expect(events[1]?.type).toBe('status');
    expect(events[2]?.type).toBe('text');
    expect(events[3]?.type).toBe('status');
  });

  it('returns an empty array for unknown run IDs', () => {
    expect(log.replay('nonexistent')).toEqual([]);
  });

  it('returns null summary for unknown run IDs', () => {
    expect(log.summary('nonexistent')).toBeNull();
  });

  it('derives status from the last status event', () => {
    const config = makeConfig();
    log.init('run-1', config);

    log.append('run-1', makeStatusEvent('run-1', 'queued'));
    log.append('run-1', makeStatusEvent('run-1', 'running'));

    const runningSum = log.summary('run-1');
    expect(runningSum?.status).toBe('running');
    expect(runningSum?.finishedAt).toBeNull();

    log.append('run-1', makeStatusEvent('run-1', 'completed'));
    const completedSum = log.summary('run-1');
    expect(completedSum?.status).toBe('completed');
    expect(completedSum?.finishedAt).toBeTruthy();
  });

  it('lists all runs', () => {
    log.init('run-a', makeConfig());
    log.append('run-a', makeStatusEvent('run-a', 'completed'));

    log.init('run-b', makeConfig());
    log.append('run-b', makeStatusEvent('run-b', 'running'));

    const list = log.list();
    expect(list).toHaveLength(2);
    const ids = list.map((s) => s.runId).sort();
    expect(ids).toEqual(['run-a', 'run-b']);
  });

  it('tracks event count correctly', () => {
    log.init('run-1', makeConfig());
    log.append('run-1', makeStatusEvent('run-1', 'queued'));
    log.append('run-1', makeTextEvent('run-1', 'output'));
    log.append('run-1', makeTextEvent('run-1', 'more output'));

    const summary = log.summary('run-1');
    expect(summary?.eventCount).toBe(3);
  });

  it('preserves config in summary', () => {
    const config: GooseRunConfig = { cwd: '/project', prompt: 'do stuff', mode: 'plan' };
    log.init('run-1', config);

    const summary = log.summary('run-1');
    expect(summary?.config).toEqual(config);
  });
});
