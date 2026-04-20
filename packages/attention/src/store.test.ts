import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FLASH_ACCENT_STYLES,
  FLASH_DURATION_MS,
  collectUnreadPaneIds,
  createAttentionStore,
  getFlashOpacity,
  selectAttentionSnapshot,
  selectWorkspaceAttentionSnapshot,
} from './store.js';

const WORKSPACE_ID = 'workspace-1';

describe('attention store decision table', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-20T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('notification-arrival on focused pane marks read without flash', () => {
    const store = createAttentionStore();
    store.getState().actions.hydrateWorkspace({
      workspaceId: WORKSPACE_ID,
      focusedPaneId: 'chat',
      unreadPaneIds: ['chat'],
    });

    store.getState().actions.signal({
      workspaceId: WORKSPACE_ID,
      paneId: 'chat',
      reason: 'notification-arrival',
    });

    const snapshot = selectAttentionSnapshot(store.getState());
    expect(snapshot.unreadPaneIds.size).toBe(0);
    expect(snapshot.activeFlash).toBeNull();
    expect(snapshot.focusedReadPaneId).toBe('chat');
  });

  it('notification-arrival on unfocused pane adds unread and blue flash', () => {
    const store = createAttentionStore();
    store.getState().actions.hydrateWorkspace({
      workspaceId: WORKSPACE_ID,
      focusedPaneId: 'today',
    });

    store.getState().actions.signal({
      workspaceId: WORKSPACE_ID,
      paneId: 'chat',
      reason: 'notification-arrival',
    });

    const snapshot = selectAttentionSnapshot(store.getState());
    expect(snapshot.unreadPaneIds.has('chat')).toBe(true);
    expect(snapshot.activeFlash?.accent).toBe('notification-blue');
    expect(snapshot.activeFlash?.paneId).toBe('chat');
  });

  it('navigation on focused pane does not flash', () => {
    const store = createAttentionStore();
    store.getState().actions.hydrateWorkspace({
      workspaceId: WORKSPACE_ID,
      focusedPaneId: 'chat',
    });

    store.getState().actions.signal({
      workspaceId: WORKSPACE_ID,
      paneId: 'chat',
      reason: 'navigation',
    });

    expect(selectAttentionSnapshot(store.getState()).activeFlash).toBeNull();
  });

  it('navigation on unfocused pane is suppressed when another pane is unread', () => {
    const store = createAttentionStore();
    store.getState().actions.hydrateWorkspace({
      workspaceId: WORKSPACE_ID,
      focusedPaneId: 'today',
      unreadPaneIds: ['scheduler'],
    });

    store.getState().actions.signal({
      workspaceId: WORKSPACE_ID,
      paneId: 'chat',
      reason: 'navigation',
    });

    expect(selectAttentionSnapshot(store.getState()).activeFlash).toBeNull();
  });

  it('navigation on unfocused pane flashes teal when no competing indicator exists', () => {
    const store = createAttentionStore();
    store.getState().actions.hydrateWorkspace({
      workspaceId: WORKSPACE_ID,
      focusedPaneId: 'today',
    });

    store.getState().actions.signal({
      workspaceId: WORKSPACE_ID,
      paneId: 'chat',
      reason: 'navigation',
    });

    const snapshot = selectAttentionSnapshot(store.getState());
    expect(snapshot.activeFlash?.accent).toBe('navigation-teal');
    expect(snapshot.activeFlash?.paneId).toBe('chat');
  });

  it('manual-unread-dismiss clears both unread sets, flashes blue, keeps focused read pane', () => {
    const store = createAttentionStore();
    store.getState().actions.hydrateWorkspace({
      workspaceId: WORKSPACE_ID,
      focusedPaneId: 'today',
      focusedReadPaneId: 'today',
      unreadPaneIds: ['chat'],
      manualUnreadPaneIds: ['chat'],
    });

    store.getState().actions.signal({
      workspaceId: WORKSPACE_ID,
      paneId: 'chat',
      reason: 'manual-unread-dismiss',
    });

    const snapshot = selectAttentionSnapshot(store.getState());
    expect(snapshot.unreadPaneIds.size).toBe(0);
    expect(snapshot.manualUnreadPaneIds.size).toBe(0);
    expect(snapshot.activeFlash?.accent).toBe('notification-blue');
    expect(snapshot.focusedReadPaneId).toBe('today');
  });

  it('notification-dismiss on focused pane clears unread and flashes blue', () => {
    const store = createAttentionStore();
    store.getState().actions.hydrateWorkspace({
      workspaceId: WORKSPACE_ID,
      focusedPaneId: 'chat',
      unreadPaneIds: ['chat'],
    });

    store.getState().actions.signal({
      workspaceId: WORKSPACE_ID,
      paneId: 'chat',
      reason: 'notification-dismiss',
    });

    const snapshot = selectAttentionSnapshot(store.getState());
    expect(snapshot.unreadPaneIds.size).toBe(0);
    expect(snapshot.activeFlash?.accent).toBe('notification-blue');
    expect(snapshot.activeFlash?.paneId).toBe('chat');
  });
});

describe('attention store behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-20T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('focus clears notification unread but preserves manual unread', () => {
    const store = createAttentionStore();
    store.getState().actions.hydrateWorkspace({
      workspaceId: WORKSPACE_ID,
      unreadPaneIds: ['chat'],
      manualUnreadPaneIds: ['chat'],
    });

    store.getState().actions.focusPane({
      workspaceId: WORKSPACE_ID,
      paneId: 'chat',
    });

    const snapshot = selectAttentionSnapshot(store.getState());
    expect(snapshot.unreadPaneIds.size).toBe(0);
    expect(snapshot.manualUnreadPaneIds.has('chat')).toBe(true);
    expect(collectUnreadPaneIds(snapshot).has('chat')).toBe(true);
    expect(snapshot.focusedReadPaneId).toBe('chat');
  });

  it('notification-dismiss preserves manual unread marker on same pane', () => {
    const store = createAttentionStore();
    store.getState().actions.hydrateWorkspace({
      workspaceId: WORKSPACE_ID,
      focusedPaneId: 'chat',
      unreadPaneIds: ['chat'],
      manualUnreadPaneIds: ['chat'],
    });

    store.getState().actions.signal({
      workspaceId: WORKSPACE_ID,
      paneId: 'chat',
      reason: 'notification-dismiss',
    });

    const snapshot = selectAttentionSnapshot(store.getState());
    expect(snapshot.unreadPaneIds.size).toBe(0);
    expect(snapshot.manualUnreadPaneIds.has('chat')).toBe(true);
    expect(collectUnreadPaneIds(snapshot).has('chat')).toBe(true);
  });

  it('manual unread marker participates in unread union count', () => {
    const store = createAttentionStore();
    store.getState().actions.activateWorkspace(WORKSPACE_ID);
    store.getState().actions.markPaneManualUnread({
      workspaceId: WORKSPACE_ID,
      paneId: 'chat',
    });

    const snapshot = selectAttentionSnapshot(store.getState());
    expect(snapshot.manualUnreadPaneIds.has('chat')).toBe(true);
    expect(collectUnreadPaneIds(snapshot).size).toBe(1);
  });

  it('active flash clears after flash duration', () => {
    const store = createAttentionStore();
    store.getState().actions.signal({
      workspaceId: WORKSPACE_ID,
      paneId: 'chat',
      reason: 'debug',
    });

    expect(selectAttentionSnapshot(store.getState()).activeFlash).not.toBeNull();
    vi.advanceTimersByTime(FLASH_DURATION_MS);
    expect(selectAttentionSnapshot(store.getState()).activeFlash).toBeNull();
  });

  it('keeps workspace state isolated per workspace id', () => {
    const store = createAttentionStore();
    store.getState().actions.signal({
      workspaceId: 'workspace-a',
      paneId: 'chat',
      reason: 'notification-arrival',
    });
    store.getState().actions.markPaneManualUnread({
      workspaceId: 'workspace-b',
      paneId: 'today',
    });

    const workspaceA = selectWorkspaceAttentionSnapshot(store.getState(), 'workspace-a');
    const workspaceB = selectWorkspaceAttentionSnapshot(store.getState(), 'workspace-b');

    expect(workspaceA.unreadPaneIds.has('chat')).toBe(true);
    expect(workspaceB.manualUnreadPaneIds.has('today')).toBe(true);
    expect(workspaceA.manualUnreadPaneIds.size).toBe(0);
    expect(workspaceB.unreadPaneIds.size).toBe(0);
  });

  it('uses accent opacity curve from cmux-inspired timing window', () => {
    expect(getFlashOpacity('notification-blue', 0)).toBe(0);
    expect(getFlashOpacity('notification-blue', 60)).toBeCloseTo(FLASH_ACCENT_STYLES['notification-blue'].peakOpacity / 2);
    expect(getFlashOpacity('navigation-teal', 200)).toBeCloseTo(FLASH_ACCENT_STYLES['navigation-teal'].peakOpacity);
    expect(getFlashOpacity('notification-blue', FLASH_DURATION_MS)).toBe(0);
  });
});
