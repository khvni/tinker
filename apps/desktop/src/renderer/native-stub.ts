/**
 * No-op stubs for native Node/Electron modules when running in browser-only
 * mode (dev:web / visual tests). The app guards all native calls behind
 * `isDesktopRuntime()`, so these are never invoked at runtime in the browser.
 *
 * Exports a superset of named symbols imported across the codebase so esbuild
 * dependency scanning does not fail.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
const noop = (..._args: any[]): any => undefined;
const noopAsync = (..._args: any[]): Promise<any> => Promise.resolve(undefined);

// node:path
export const join = (...segments: string[]): string => segments.join('/');
export const resolve = (...segments: string[]): string => segments.join('/');
export const basename = (p: string): string => p.split('/').pop() ?? '';
export const dirname = (p: string): string => p.split('/').slice(0, -1).join('/');
export const extname = (p: string): string => {
  const base = basename(p);
  const idx = base.lastIndexOf('.');
  return idx > 0 ? base.slice(idx) : '';
};
export const sep = '/';

// node:os
export const homedir = (): string => '/tmp';
export const platform = (): string => 'linux';

// node:fs/promises
export const readFile = noopAsync;
export const writeFile = noopAsync;
export const appendFile = noopAsync;
export const readdir = noopAsync;
export const mkdir = noopAsync;
export const rm = noopAsync;
export const copyFile = noopAsync;
export const stat = noopAsync;
export const access = noopAsync;

// node:fs (sync)
export const watch = noop;
export const existsSync = (): boolean => false;

// node:child_process
export const execFile = noop;

// node:util
export const promisify = (fn: any): any => fn;

// better-sqlite3 (default export is a class constructor)
class StubDatabase {
  pragma(): undefined { return undefined; }
  prepare(): { run: typeof noop; all: typeof noop; get: typeof noop } {
    return { run: noop, all: noop, get: noop };
  }
  close(): void {}
}

// electron
export const app = { getPath: (): string => '/tmp' };

export default StubDatabase;
