import nodePath from 'node:path';
import os from 'node:os';

export const dataDir = (): string => {
  const platform = process.platform;
  const home = os.homedir();
  if (platform === 'win32') {
    return process.env['APPDATA'] ?? nodePath.join(home, 'AppData', 'Roaming');
  }
  if (platform === 'darwin') {
    return nodePath.join(home, 'Library', 'Application Support');
  }
  return process.env['XDG_DATA_HOME'] ?? nodePath.join(home, '.local', 'share');
};

export const join = (...segments: string[]): string => nodePath.join(...segments);
