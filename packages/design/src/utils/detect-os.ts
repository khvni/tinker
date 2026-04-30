/**
 * OS detection utility.
 * Uses navigator.userAgentData (Chrome 100+, Edge 100+) where available,
 * falling back to navigator.userAgent for Safari/WebKit.
 * navigator.platform is deprecated but kept as last-resort fallback for
 * environments where neither API is available.
 */

export type DetectedOS = 'mac' | 'windows' | 'linux' | 'other';

const MAC_INDICATORS = /Mac|iPhone|iPod|iPad/i;
const WIN_INDICATORS = /Windows/i;
const LINUX_INDICATORS = /Linux/i;

// Minimal NavigatorUAData shape (not all browsers ship this in lib.dom.d.ts)
interface UADataValues {
  brands?: string[];
  platform?: string;
}

/**
 * Detect the current operating system using the High Entropy Values API
 * (navigator.userAgentData) where available, with progressive fallback to
 * navigator.userAgent and finally navigator.platform.
 */
export function detectOS(): DetectedOS {
  if (typeof navigator === 'undefined') {
    return 'other';
  }

  // Chrome 100+, Edge 100+: High Entropy Values API
  const uaData = (navigator as Navigator & { userAgentData?: UADataValues })
    .userAgentData;
  if (uaData) {
    const brands: string[] = uaData.brands ?? [];
    const ua: string = navigator.userAgent ?? '';
    const platformHint = uaData.platform ?? '';
    const combined = `${platformHint} ${ua} ${brands.join(' ')}`;
    if (MAC_INDICATORS.test(combined)) return 'mac';
    if (WIN_INDICATORS.test(combined)) return 'windows';
    if (LINUX_INDICATORS.test(combined)) return 'linux';
    return 'other';
  }

  // Legacy fallback: navigator.userAgent
  const ua = navigator.userAgent ?? '';
  if (MAC_INDICATORS.test(ua)) return 'mac';
  if (WIN_INDICATORS.test(ua)) return 'windows';
  if (LINUX_INDICATORS.test(ua)) return 'linux';

  // Last-resort: deprecated navigator.platform (still available in all browsers)
  const platform = (navigator as Navigator & { platform?: string }).platform ?? '';
  if (MAC_INDICATORS.test(platform)) return 'mac';
  if (WIN_INDICATORS.test(platform)) return 'windows';
  if (LINUX_INDICATORS.test(platform)) return 'linux';

  return 'other';
}

/** Returns true on macOS/iOS. Convenience for the common mac-vs-other split. */
export function isMac(): boolean {
  return detectOS() === 'mac';
}
