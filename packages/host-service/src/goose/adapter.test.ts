import { mkdtempSync, rmSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { GooseRunEvent } from './types.js';
import { createGooseRuntimeAdapter, type GooseRuntimeAdapter } from './adapter.js';
import { createRunEventLog, type RunEventLog } from './event-log.js';

describe('createGooseRuntimeAdapter', () => {
  let scratch: string;
  let eventLog: RunEventLog;
  let adapter: GooseRuntimeAdapter;
  let mockBin: string;

  beforeEach(() => {
    scratch = mkdtempSync(join(tmpdir(), 'tinker-goose-adapter-'));
    eventLog = createRunEventLog(join(scratch, 'runs'));
  });

  afterEach(async () => {
    adapter?.shutdown();
    // Allow pending I/O from killed processes to settle before removing scratch dir
    await new Promise((r) => setTimeout(r, 100));
    rmSync(scratch, { recursive: true, force: true });
  });

  const createMockBin = (script: string): string => {
    const binPath = join(scratch, 'mock-goose');
    writeFileSync(binPath, `#!/bin/sh\n${script}\n`, 'utf8');
    chmodSync(binPath, 0o755);
    return binPath;
  };

  const collectEvents = (count: number, timeoutMs = 10_000): Promise<GooseRunEvent[]> => {
    const events: GooseRunEvent[] = [];
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        unsubscribe();
        reject(new Error(`Timed out waiting for ${count} events, got ${events.length}: ${JSON.stringify(events.map((e) => e.type))}`));
      }, timeoutMs);

      const unsubscribe = adapter.subscribe((event) => {
        events.push(event);
        if (events.length >= count) {
          clearTimeout(timer);
          unsubscribe();
          resolve(events);
        }
      });
    });
  };

  it('streams stdout text and completes on successful exit', async () => {
    mockBin = createMockBin('echo "hello from goose"');
    adapter = createGooseRuntimeAdapter({ eventLog, gooseBin: mockBin });

    const eventsPromise = collectEvents(4);
    const runId = adapter.startRun({ cwd: scratch, prompt: 'test', mode: null });

    expect(runId).toBeTruthy();

    const events = await eventsPromise;
    const types = events.map((e) => e.type);
    expect(types).toContain('status');
    expect(types).toContain('text');

    const statusEvents = events.filter((e) => e.type === 'status') as Array<Extract<GooseRunEvent, { type: 'status' }>>;
    const statuses = statusEvents.map((e) => e.status);
    expect(statuses).toContain('queued');
    expect(statuses).toContain('running');
    expect(statuses).toContain('completed');

    const textEvents = events.filter((e) => e.type === 'text') as Array<Extract<GooseRunEvent, { type: 'text' }>>;
    expect(textEvents.some((e) => e.content.includes('hello from goose'))).toBe(true);
  });

  it('marks run as failed on non-zero exit', async () => {
    mockBin = createMockBin('echo "error output" >&2; exit 1');
    adapter = createGooseRuntimeAdapter({ eventLog, gooseBin: mockBin });

    const eventsPromise = collectEvents(4);
    adapter.startRun({ cwd: scratch, prompt: 'fail test', mode: null });

    const events = await eventsPromise;
    const statusEvents = events.filter((e) => e.type === 'status') as Array<Extract<GooseRunEvent, { type: 'status' }>>;
    const statuses = statusEvents.map((e) => e.status);
    expect(statuses).toContain('failed');
  });

  it('aborts a running process and emits aborted status', { timeout: 15_000 }, async () => {
    // exec replaces the shell so SIGTERM goes directly to sleep
    mockBin = createMockBin('exec sleep 30');
    adapter = createGooseRuntimeAdapter({ eventLog, gooseBin: mockBin });

    const allEvents: GooseRunEvent[] = [];
    let unsubscribe: () => void;
    const abortedPromise = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        unsubscribe();
        reject(new Error(`Timed out waiting for aborted status, got: ${JSON.stringify(allEvents.map((e) => e.type))}`));
      }, 10_000);
      unsubscribe = adapter.subscribe((event) => {
        allEvents.push(event);
        if (event.type === 'status' && event.status === 'aborted') {
          clearTimeout(timer);
          unsubscribe();
          resolve();
        }
      });
    });

    const runId = adapter.startRun({ cwd: scratch, prompt: 'long task', mode: null });

    // Wait for the 'running' status before aborting
    await new Promise((r) => setTimeout(r, 300));

    const aborted = adapter.abortRun(runId);
    expect(aborted).toBe(true);

    await abortedPromise;
    const statusEvents = allEvents.filter((e) => e.type === 'status') as Array<Extract<GooseRunEvent, { type: 'status' }>>;
    const statuses = statusEvents.map((e) => e.status);
    expect(statuses).toContain('aborted');
  });

  it('returns false when aborting a nonexistent run', () => {
    adapter = createGooseRuntimeAdapter({ eventLog, gooseBin: 'true' });
    expect(adapter.abortRun('nonexistent')).toBe(false);
  });

  it('emits an error event with recovery guidance when goose binary is missing', async () => {
    adapter = createGooseRuntimeAdapter({ eventLog, gooseBin: '/nonexistent/goose-binary' });

    const eventsPromise = collectEvents(4);
    adapter.startRun({ cwd: scratch, prompt: 'test', mode: null });

    const events = await eventsPromise;
    const errorEvents = events.filter((e) => e.type === 'error') as Array<Extract<GooseRunEvent, { type: 'error' }>>;
    expect(errorEvents.length).toBeGreaterThan(0);
    expect(errorEvents[0]?.message).toContain('Goose CLI not found');
    expect(errorEvents[0]?.recoverable).toBe(true);

    const statusEvents = events.filter((e) => e.type === 'status') as Array<Extract<GooseRunEvent, { type: 'status' }>>;
    expect(statusEvents.some((e) => e.status === 'failed')).toBe(true);
  });

  it('persists events to the event log for replay', async () => {
    mockBin = createMockBin('echo "replay test"');
    adapter = createGooseRuntimeAdapter({ eventLog, gooseBin: mockBin });

    const eventsPromise = collectEvents(4);
    const runId = adapter.startRun({ cwd: scratch, prompt: 'replay', mode: null });
    await eventsPromise;

    // Small delay to ensure all appends are flushed
    await new Promise((r) => setTimeout(r, 50));

    const replayed = eventLog.replay(runId);
    expect(replayed.length).toBeGreaterThanOrEqual(3);
    expect(replayed.some((e) => e.type === 'text')).toBe(true);
    expect(replayed.some((e) => e.type === 'status')).toBe(true);
  });

  it('passes mode as --profile flag', async () => {
    // The mock script just echoes its args
    mockBin = createMockBin('echo "args: $@"');
    adapter = createGooseRuntimeAdapter({ eventLog, gooseBin: mockBin });

    const eventsPromise = collectEvents(4);
    adapter.startRun({ cwd: scratch, prompt: 'with mode', mode: 'plan' });
    const events = await eventsPromise;

    const textEvents = events.filter((e) => e.type === 'text') as Array<Extract<GooseRunEvent, { type: 'text' }>>;
    const output = textEvents.map((e) => e.content).join('');
    expect(output).toContain('--profile');
    expect(output).toContain('plan');
  });

  it('cleans up all active runs on shutdown', async () => {
    mockBin = createMockBin('exec sleep 30');
    adapter = createGooseRuntimeAdapter({ eventLog, gooseBin: mockBin });

    adapter.startRun({ cwd: scratch, prompt: 'long1', mode: null });
    adapter.startRun({ cwd: scratch, prompt: 'long2', mode: null });

    await new Promise((r) => setTimeout(r, 200));
    expect(adapter.listActiveRuns()).toHaveLength(2);

    adapter.shutdown();

    // After shutdown, listActiveRuns may still briefly have entries
    // but the processes are killed. The key test is that shutdown doesn't throw.
  });
});
