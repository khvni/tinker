import { describe, it, expect, vi, afterEach } from 'vitest';
import { detectOS, isMac } from './detect-os';

describe('detectOS', () => {
  // Helper to stub navigator with a given userAgent
  const withUA = (userAgent: string, userAgentData?: { brands?: string[]; platform?: string }) => {
    vi.stubGlobal('navigator', {
      userAgent,
      ...(userAgentData ? { userAgentData } : { platform: '' }),
    });
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns mac for macOS Chrome UA', () => {
    withUA(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );
    expect(detectOS()).toBe('mac');
  });

  it('returns mac for iOS Safari UA', () => {
    withUA(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
    );
    expect(detectOS()).toBe('mac');
  });

  it('returns windows for Windows Chrome UA', () => {
    withUA(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );
    expect(detectOS()).toBe('windows');
  });

  it('returns linux for Linux Chrome UA', () => {
    withUA(
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );
    expect(detectOS()).toBe('linux');
  });

  it('returns other for unknown UA', () => {
    withUA('Mozilla/5.0 (compatible; Unknown Bot)');
    expect(detectOS()).toBe('other');
  });

  it('prefers userAgentData platform over userAgent when both present', () => {
    withUA(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      { brands: [], platform: 'macOS' }
    );
    expect(detectOS()).toBe('mac');
  });

  it('returns other when navigator is undefined (SSR guard)', () => {
    vi.stubGlobal('navigator', undefined);
    expect(detectOS()).toBe('other');
  });

  it('isMac returns true only on macOS', () => {
    withUA(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );
    expect(isMac()).toBe(true);
  });

  it('isMac returns false on Windows', () => {
    withUA(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );
    expect(isMac()).toBe(false);
  });
});
