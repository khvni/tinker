import { getDesktopApi } from '../../../desktop-api.js';

const getInvoke = async (): Promise<(cmd: string, args?: Record<string, unknown>) => Promise<unknown>> => {
  if (getDesktopApi() !== null) {
    throw new Error('Memory commands not yet available in Electron. Use Tauri shell.');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke;
};

export const approveMemoryEntry = async (filePath: string, destinationDir: string): Promise<string> => {
  const invoke = await getInvoke();
  return invoke('memory_approve', { filePath, destinationDir }) as Promise<string>;
};

export const dismissMemoryEntry = async (filePath: string): Promise<void> => {
  const invoke = await getInvoke();
  return invoke('memory_dismiss', { filePath }) as Promise<void>;
};

export const readMemoryDiff = async (filePath: string): Promise<string> => {
  const invoke = await getInvoke();
  return invoke('memory_diff', { filePath }) as Promise<string>;
};
