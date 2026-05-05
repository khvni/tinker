// @vitest-environment jsdom

// @ts-expect-error React uses this flag in tests.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import type { ScheduledJobRun, ScheduledJobStore } from '@tinker/shared-types';
import { MemorySweepDiagnosticsCard } from './MemorySweepDiagnosticsCard.js';

const buildStore = (overrides: Partial<ScheduledJobStore> = {}): ScheduledJobStore => ({
  listJobs: async () => [],
  getJob: async () => null,
  saveJob: async () => undefined,
  deleteJob: async () => undefined,
  listDueJobs: async () => [],
  recordRun: async () => undefined,
  listRuns: async () => [],
  listTodayEntries: async () => [],
  ...overrides,
});

describe('MemorySweepDiagnosticsCard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the empty state with a Run now button when there are no runs yet', () => {
    const markup = renderToStaticMarkup(
      <MemorySweepDiagnosticsCard
        memorySweepState={null}
        memorySweepBusy={false}
        memorySweepCanRun={true}
        memorySweepRevision={0}
        schedulerStore={buildStore()}
        onRunMemorySweep={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(markup).toContain('Daily memory sweep');
    expect(markup).toContain('Run now');
    expect(markup).toContain('Never run');
  });

  it('disables Run now and surfaces guidance when prerequisites are missing', () => {
    const markup = renderToStaticMarkup(
      <MemorySweepDiagnosticsCard
        memorySweepState={null}
        memorySweepBusy={false}
        memorySweepCanRun={false}
        memorySweepRevision={0}
        schedulerStore={buildStore()}
        onRunMemorySweep={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(markup).toContain('Connect a vault and a model');
    expect(markup).toContain('disabled');
  });

  it('shows the last error message from sweep state', () => {
    const markup = renderToStaticMarkup(
      <MemorySweepDiagnosticsCard
        memorySweepState={{
          key: 'daily-sweep',
          status: 'failed',
          lastStartedAt: '2026-04-22T04:00:00.000Z',
          lastCompletedAt: '2026-04-22T04:00:30.000Z',
          lastError: 'Vault read failed',
        }}
        memorySweepBusy={false}
        memorySweepCanRun={true}
        memorySweepRevision={1}
        schedulerStore={buildStore()}
        onRunMemorySweep={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(markup).toContain('Last run failed');
    expect(markup).toContain('Vault read failed');
  });

  it('renders recent run history rows fetched from the scheduler store', async () => {
    const runs: ScheduledJobRun[] = [
      {
        id: 'run-1',
        jobId: 'system:daily-memory-sweep',
        trigger: 'manual',
        scheduledFor: '2026-04-22T04:00:00.000Z',
        startedAt: '2026-04-22T04:00:00.000Z',
        finishedAt: '2026-04-22T04:00:30.000Z',
        status: 'success',
        outputText: 'Indexed 3 entities; flagged 0 stale.',
        errorText: null,
        deliveredSinks: [],
        skippedCount: 0,
      },
      {
        id: 'run-2',
        jobId: 'system:daily-memory-sweep',
        trigger: 'schedule',
        scheduledFor: '2026-04-21T04:00:00.000Z',
        startedAt: '2026-04-21T04:00:00.000Z',
        finishedAt: '2026-04-21T04:00:05.000Z',
        status: 'error',
        outputText: null,
        errorText: 'vault offline',
        deliveredSinks: [],
        skippedCount: 0,
      },
    ];

    const listRuns = vi.fn(async () => runs);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MemorySweepDiagnosticsCard
          memorySweepState={null}
          memorySweepBusy={false}
          memorySweepCanRun={true}
          memorySweepRevision={0}
          schedulerStore={buildStore({ listRuns })}
          onRunMemorySweep={vi.fn().mockResolvedValue(undefined)}
        />,
      );
    });

    expect(listRuns).toHaveBeenCalledWith('system:daily-memory-sweep', 5);
    const text = container.textContent ?? '';
    expect(text).toContain('Succeeded');
    expect(text).toContain('Failed');
    expect(text).toContain('vault offline');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('invokes onRunMemorySweep when Run now is clicked', async () => {
    const onRunMemorySweep = vi.fn(async () => undefined);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MemorySweepDiagnosticsCard
          memorySweepState={null}
          memorySweepBusy={false}
          memorySweepCanRun={true}
          memorySweepRevision={0}
          schedulerStore={buildStore()}
          onRunMemorySweep={onRunMemorySweep}
        />,
      );
    });

    const button = container.querySelector<HTMLButtonElement>('button');
    expect(button).not.toBeNull();
    expect(button?.disabled).toBe(false);

    await act(async () => {
      button?.click();
    });

    expect(onRunMemorySweep).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
